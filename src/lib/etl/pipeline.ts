// Onda 2 - Pipeline ETL (Extracao -> Treat -> Catalog)
// Referencia: docs/blueprint/BLUEPRINT.md (Step 2 Discovery) e
//             docs/blueprint/DATA-MODEL-DELTAS.md (schema raw.*)
//
// Este modulo e um esqueleto. Cada fase tem contrato claro e pode ser
// evoluida em Onda 3 (Discovery) para regras reais por fonte de dados.

import { createHash } from 'node:crypto';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sql = any;

export type EtlSource = 'censo_escolar' | 'siope' | 'fnde' | 'ibge' | 'local';

export interface ExtractInput {
  source: EtlSource;
  filename?: string;
  uploadedBy?: string;
  consultoriaId?: number | null;
  municipalityId?: number | null;
  rows: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
}

export interface ExtractOutput {
  importId: number;
  rowsTotal: number;
  contentHash: string;
  alreadyExists: boolean;
}

export interface TreatOutput {
  importId: number;
  rowsOk: number;
  rowsRejected: number;
  errors: Array<{ rowIndex: number; reason: string }>;
}

export interface CatalogOutput {
  importId: number;
  cataloged: number;
  lineageRows: number;
}

export interface PipelineResult {
  extract: ExtractOutput;
  treat: TreatOutput;
  catalog: CatalogOutput;
}

// ── Helpers ─────────────────────────────────────────────────────────────
function canonicalHash(
  rows: Array<Record<string, unknown>>,
  source: string,
  consultoriaId: number | null,
  municipalityId: number | null,
): string {
  const h = createHash('sha256');
  h.update(source);
  h.update('\n');
  h.update(`consultoria:${consultoriaId ?? 'null'}`);
  h.update('\n');
  h.update(`municipality:${municipalityId ?? 'null'}`);
  h.update('\n');
  // Ordenacao estavel: cada linha como JSON com chaves ordenadas
  for (const row of rows) {
    const keys = Object.keys(row).sort();
    const sorted: Record<string, unknown> = {};
    for (const k of keys) sorted[k] = row[k];
    h.update(JSON.stringify(sorted));
    h.update('\n');
  }
  return h.digest('hex');
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ── 1. Extract ──────────────────────────────────────────────────────────
// Grava o import (metadados + linhas brutas) em raw.imports/raw.import_rows.
// Dedupe por content_hash: se ja existir, devolve o importId existente.
export async function extract(sql: Sql, input: ExtractInput): Promise<ExtractOutput> {
  const rows = input.rows.filter(isPlainObject);
  if (rows.length === 0) {
    throw new Error('extract: rows vazio ou nao objeto');
  }

  const hash = canonicalHash(
    rows,
    input.source,
    input.consultoriaId ?? null,
    input.municipalityId ?? null,
  );

  // Dedup: se ja existir, retorna o id
  const existing = await sql.query(
    `SELECT id, rows_total FROM raw.imports WHERE content_hash = $1 LIMIT 1`,
    [hash]
  );
  if (existing.length > 0) {
    return {
      importId: Number(existing[0].id),
      rowsTotal: Number(existing[0].rows_total ?? rows.length),
      contentHash: hash,
      alreadyExists: true,
    };
  }

  const inserted = await sql.query(
    `INSERT INTO raw.imports (
       source, filename, content_hash, uploaded_by,
       consultoria_id, municipality_id, status, rows_total, metadata
     ) VALUES ($1, $2, $3, $4, $5, $6, 'extracting', $7, $8::jsonb)
     RETURNING id`,
    [
      input.source,
      input.filename ?? null,
      hash,
      input.uploadedBy ?? null,
      input.consultoriaId ?? null,
      input.municipalityId ?? null,
      rows.length,
      JSON.stringify(input.metadata ?? {}),
    ]
  );
  const importId = Number(inserted[0].id);

  // Insert das linhas brutas em lote de 200
  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const values: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any[] = [];
    chunk.forEach((row, j) => {
      const idx = j * 3;
      values.push(`($${idx + 1}, $${idx + 2}, $${idx + 3}::jsonb)`);
      params.push(importId, i + j, JSON.stringify(row));
    });
    await sql.query(
      `INSERT INTO raw.import_rows (import_id, row_index, payload) VALUES ${values.join(',')}`,
      params
    );
  }

  await sql.query(
    `UPDATE raw.imports SET status = 'received', rows_total = $1 WHERE id = $2`,
    [rows.length, importId]
  );

  return { importId, rowsTotal: rows.length, contentHash: hash, alreadyExists: false };
}

// ── 2. Treat ────────────────────────────────────────────────────────────
// Valida e marca cada raw.import_rows como is_valid = true/false.
// Regras minimas (placeholder): payload nao vazio e contem ao menos uma chave.
// Em Onda 3 estas regras viram por fonte (censo, siope, etc).
export async function treat(sql: Sql, importId: number): Promise<TreatOutput> {
  await sql.query(`UPDATE raw.imports SET status = 'treating' WHERE id = $1`, [importId]);

  const rows = await sql.query(
    `SELECT id, row_index, payload FROM raw.import_rows WHERE import_id = $1 ORDER BY row_index`,
    [importId]
  );

  let ok = 0;
  let rejected = 0;
  const errors: Array<{ rowIndex: number; reason: string }> = [];

  for (const row of rows) {
    const payload = row.payload as Record<string, unknown> | null;
    const reasons: string[] = [];
    if (!payload || typeof payload !== 'object') reasons.push('payload vazio');
    else if (Object.keys(payload).length === 0) reasons.push('payload sem chaves');

    const isValid = reasons.length === 0;
    if (isValid) ok++;
    else {
      rejected++;
      errors.push({ rowIndex: Number(row.row_index), reason: reasons.join(', ') });
    }

    await sql.query(
      `UPDATE raw.import_rows
          SET is_valid = $1,
              errors = $2::jsonb,
              treated_at = NOW()
        WHERE id = $3`,
      [isValid, JSON.stringify(reasons), row.id]
    );
  }

  await sql.query(
    `UPDATE raw.imports
        SET status = 'cataloging',
            rows_ok = $1,
            rows_rejected = $2,
            errors = $3::jsonb
      WHERE id = $4`,
    [ok, rejected, JSON.stringify(errors.slice(0, 50)), importId]
  );

  return { importId, rowsOk: ok, rowsRejected: rejected, errors };
}

// ── 3. Catalog ──────────────────────────────────────────────────────────
// Fase de catalogacao: marca rows validas como cataloged_at e (placeholder)
// cria linhagem em raw.lineage apontando para a consultoria. Onda 3 evolui
// para gravar em fundeb.enrollments e ligar categorias FUNDEB.
export async function catalog(sql: Sql, importId: number): Promise<CatalogOutput> {
  const imp = await sql.query(
    `SELECT municipality_id FROM raw.imports WHERE id = $1`,
    [importId]
  );
  if (imp.length === 0) throw new Error(`catalog: import ${importId} nao encontrado`);
  const municipalityId: number | null = imp[0].municipality_id ?? null;

  const validRows = await sql.query(
    `SELECT id FROM raw.import_rows WHERE import_id = $1 AND is_valid = TRUE`,
    [importId]
  );

  let lineageRows = 0;
  for (const row of validRows) {
    await sql.query(
      `UPDATE raw.import_rows SET cataloged_at = NOW() WHERE id = $1`,
      [row.id]
    );

    if (municipalityId !== null) {
      await sql.query(
        `INSERT INTO raw.lineage (target_schema, target_table, target_id, raw_row_id, import_id)
         VALUES ('fundeb', 'municipalities', $1, $2, $3)`,
        [municipalityId, row.id, importId]
      );
      lineageRows++;
    }
  }

  await sql.query(
    `UPDATE raw.imports SET status = 'done', finished_at = NOW() WHERE id = $1`,
    [importId]
  );

  return { importId, cataloged: validRows.length, lineageRows };
}

// ── Orchestrator ────────────────────────────────────────────────────────
export async function runPipeline(sql: Sql, input: ExtractInput): Promise<PipelineResult> {
  const ext = await extract(sql, input);
  // Dedup hit: import com mesmo hash ja existe.
  // Se o import anterior completou treat+catalog (rows_ok > 0), retorna os counts reais.
  // Se ficou num estado incompleto (rows_ok = 0 com rows_total > 0), re-executa treat+catalog.
  if (ext.alreadyExists) {
    const imp = await sql.query(
      `SELECT rows_ok, rows_rejected, rows_total FROM raw.imports WHERE id = $1`,
      [ext.importId]
    );
    const rowsOk = Number(imp[0]?.rows_ok ?? 0);
    const rowsTotal = Number(imp[0]?.rows_total ?? 0);

    // Import incompleto — re-executa treat + catalog
    if (rowsOk === 0 && rowsTotal > 0) {
      // Limpa linhagem e cataloged_at para evitar duplicatas na re-execucao
      await sql.query(`DELETE FROM raw.lineage WHERE import_id = $1`, [ext.importId]);
      await sql.query(
        `UPDATE raw.import_rows SET cataloged_at = NULL WHERE import_id = $1`,
        [ext.importId]
      );
      const tre = await treat(sql, ext.importId);
      const cat = await catalog(sql, ext.importId);
      return { extract: ext, treat: tre, catalog: cat };
    }

    // Import ja completo — le os counts reais
    const catCount = await sql.query(
      `SELECT COUNT(*)::int AS n FROM raw.import_rows
        WHERE import_id = $1 AND cataloged_at IS NOT NULL`,
      [ext.importId]
    );
    const linCount = await sql.query(
      `SELECT COUNT(*)::int AS n FROM raw.lineage WHERE import_id = $1`,
      [ext.importId]
    );
    return {
      extract: ext,
      treat: {
        importId: ext.importId,
        rowsOk,
        rowsRejected: Number(imp[0]?.rows_rejected ?? 0),
        errors: [],
      },
      catalog: {
        importId: ext.importId,
        cataloged: Number(catCount[0]?.n ?? 0),
        lineageRows: Number(linCount[0]?.n ?? 0),
      },
    };
  }
  const tre = await treat(sql, ext.importId);
  const cat = await catalog(sql, ext.importId);
  return { extract: ext, treat: tre, catalog: cat };
}
