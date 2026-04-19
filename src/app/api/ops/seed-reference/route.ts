import { neon } from '@neondatabase/serverless';
import { requireAdminApi } from '@/lib/guard';
import Database from 'better-sqlite3';
import path from 'path';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const FNDE_DATA = process.env.FNDE_DATA_PATH || '/Users/Raphael/fundeb-sp-2026/fnde_data_2026';
const SP_DATA = process.env.SP_DATA_PATH || '/Users/Raphael/fundeb-sp-2026';
const BATCH_SIZE = 200;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NeonSQL = any;

type SSEWriter = {
  write: (event: string, data: Record<string, unknown>) => void;
};

function createSSEStream() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController | null = null;

  const stream = new ReadableStream({
    start(c) { controller = c; },
  });

  const writer: SSEWriter = {
    write(event: string, data: Record<string, unknown>) {
      if (!controller) return;
      const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      controller.enqueue(encoder.encode(payload));
    },
  };

  const close = () => controller?.close();

  return { stream, writer, close };
}

// ── Build municipality lookup maps ──────────────────────────

async function buildMunicipalityMaps(sql: NeonSQL) {
  const rows = await sql.query('SELECT id, nome, codigo_ibge FROM fundeb.municipalities');
  const nameToId = new Map<string, number>();
  const ibgeToId = new Map<string, number>();
  for (const m of rows) {
    nameToId.set((m.nome as string).toLowerCase(), m.id as number);
    if (m.codigo_ibge) {
      ibgeToId.set(m.codigo_ibge as string, m.id as number);
    }
  }
  return { nameToId, ibgeToId, count: rows.length };
}

// ── SQL helpers ─────────────────────────────────────────────

function esc(val: string | null | undefined): string {
  if (val == null) return 'NULL';
  return `'${val.replace(/'/g, "''")}'`;
}

function num(val: number | null | undefined): string {
  if (val == null || isNaN(val as number)) return 'NULL';
  return String(val);
}

function intOrNull(val: unknown): string {
  if (val == null) return 'NULL';
  const n = Number(val);
  if (isNaN(n)) return 'NULL';
  return String(Math.round(n));
}

// ── Seed: fatores_ponderacao ────────────────────────────────

async function seedFatoresPonderacao(
  sql: NeonSQL,
  brDb: Database.Database,
  writer: SSEWriter,
) {
  writer.write('progress', { table: 'ref_fatores_ponderacao', status: 'starting' });

  await sql.query('DELETE FROM fundeb.ref_fatores_ponderacao');

  const rows = brDb.prepare('SELECT * FROM fatores_ponderacao').all() as Array<{
    descricao: string | null; segmento: string; fp_vaaf: number | null;
    fp_vaat: number | null; f_multi: number | null; fp_final_vaaf: number | null;
    fp_final_vaat: number | null;
  }>;

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const values = batch.map(r =>
      `(${esc(r.descricao)}, ${esc(r.segmento)}, ${num(r.fp_vaaf)}, ${num(r.fp_vaat)}, ${num(r.f_multi ?? 1.0)}, ${num(r.fp_final_vaaf)}, ${num(r.fp_final_vaat)})`
    ).join(',\n');

    await sql.query(`
      INSERT INTO fundeb.ref_fatores_ponderacao (descricao, segmento, fp_vaaf, fp_vaat, f_multi, fp_final_vaaf, fp_final_vaat)
      VALUES ${values}
      ON CONFLICT (segmento) DO UPDATE SET
        descricao = EXCLUDED.descricao,
        fp_vaaf = EXCLUDED.fp_vaaf,
        fp_vaat = EXCLUDED.fp_vaat,
        f_multi = EXCLUDED.f_multi,
        fp_final_vaaf = EXCLUDED.fp_final_vaaf,
        fp_final_vaat = EXCLUDED.fp_final_vaat
    `);
    inserted += batch.length;
  }

  writer.write('progress', { table: 'ref_fatores_ponderacao', status: 'done', rows: inserted });
  return inserted;
}

// ── Seed: inep_censo ────────────────────────────────────────

async function seedInepCenso(
  sql: NeonSQL,
  brDb: Database.Database,
  ibgeToId: Map<string, number>,
  writer: SSEWriter,
) {
  writer.write('progress', { table: 'ref_inep_censo', status: 'starting' });

  await sql.query('DELETE FROM fundeb.ref_inep_censo');

  const rows = brDb.prepare(
    `SELECT * FROM inep_censo_2024 WHERE uf = 'São Paulo'`
  ).all() as Array<Record<string, unknown>>;

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const cols = 'codigo_ibge, municipality_id, uf, municipio, mat_total, mat_ei_total, mat_creche, mat_pre_escola, mat_ef_total, mat_ef_ai, mat_ef_af, mat_em_total, mat_em_propedeutico, mat_em_normal, mat_em_tec_integrado, mat_prof_total, mat_eja_total, mat_eja_fund, mat_eja_medio, mat_especial_total, mat_especial_comum, mat_especial_exclusiva';
    const values = batch.map(r => {
      const ibge = String(r.codigo_ibge);
      const munId = ibgeToId.get(ibge);
      return `(${esc(ibge)}, ${munId ?? 'NULL'}, ${esc(r.uf as string)}, ${esc(r.municipio as string)}, ${intOrNull(r.mat_total)}, ${intOrNull(r.mat_ei_total)}, ${intOrNull(r.mat_creche)}, ${intOrNull(r.mat_pre_escola)}, ${intOrNull(r.mat_ef_total)}, ${intOrNull(r.mat_ef_ai)}, ${intOrNull(r.mat_ef_af)}, ${intOrNull(r.mat_em_total)}, ${intOrNull(r.mat_em_propedeutico)}, ${intOrNull(r.mat_em_normal)}, ${intOrNull(r.mat_em_tec_integrado)}, ${intOrNull(r.mat_prof_total)}, ${intOrNull(r.mat_eja_total)}, ${intOrNull(r.mat_eja_fund)}, ${intOrNull(r.mat_eja_medio)}, ${intOrNull(r.mat_especial_total)}, ${intOrNull(r.mat_especial_comum)}, ${intOrNull(r.mat_especial_exclusiva)})`;
    }).join(',\n');

    await sql.query(`
      INSERT INTO fundeb.ref_inep_censo (${cols})
      VALUES ${values}
      ON CONFLICT (codigo_ibge) DO NOTHING
    `);
    inserted += batch.length;
  }

  writer.write('progress', { table: 'ref_inep_censo', status: 'done', rows: inserted });
  return inserted;
}

// ── Seed: nse ───────────────────────────────────────────────

async function seedNse(
  sql: NeonSQL,
  brDb: Database.Database,
  ibgeToId: Map<string, number>,
  writer: SSEWriter,
) {
  writer.write('progress', { table: 'ref_nse', status: 'starting' });

  await sql.query('DELETE FROM fundeb.ref_nse');

  // codigo_ibge > 99 excludes state-level entry (codigo_ibge=35)
  const rows = brDb.prepare(
    `SELECT * FROM nse_municipio WHERE uf = 'SP' AND codigo_ibge > 99`
  ).all() as Array<{
    codigo_ibge: number; uf: string; nome: string; ponderador_nse: number | null;
  }>;

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const values = batch.map(r => {
      const ibge = String(r.codigo_ibge);
      const munId = ibgeToId.get(ibge);
      return `(${esc(ibge)}, ${munId ?? 'NULL'}, ${esc(r.uf)}, ${esc(r.nome)}, ${num(r.ponderador_nse)})`;
    }).join(',\n');

    await sql.query(`
      INSERT INTO fundeb.ref_nse (codigo_ibge, municipality_id, uf, nome, ponderador_nse)
      VALUES ${values}
      ON CONFLICT (codigo_ibge) DO UPDATE SET
        ponderador_nse = EXCLUDED.ponderador_nse
    `);
    inserted += batch.length;
  }

  writer.write('progress', { table: 'ref_nse', status: 'done', rows: inserted });
  return inserted;
}

// ── Seed: historico_stn ─────────────────────────────────────

async function seedHistoricoStn(
  sql: NeonSQL,
  brDb: Database.Database,
  writer: SSEWriter,
) {
  writer.write('progress', { table: 'ref_historico_stn', status: 'starting' });

  await sql.query('DELETE FROM fundeb.ref_historico_stn');

  const rows = brDb.prepare(
    `SELECT * FROM historico_stn_uf WHERE uf = 'SP'`
  ).all() as Array<{
    uf: string; ano: number; nivel: string; origem: string;
    jan: number | null; fev: number | null; mar: number | null;
    abr: number | null; mai: number | null; jun: number | null;
    jul: number | null; ago: number | null; sete: number | null;
    outu: number | null; novt: number | null; dezt: number | null;
    total_ano: number | null;
  }>;

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const values = batch.map(r =>
      `(${esc(r.uf)}, ${r.ano}, ${esc(r.nivel)}, ${esc(r.origem)}, ${num(r.jan)}, ${num(r.fev)}, ${num(r.mar)}, ${num(r.abr)}, ${num(r.mai)}, ${num(r.jun)}, ${num(r.jul)}, ${num(r.ago)}, ${num(r.sete)}, ${num(r.outu)}, ${num(r.novt)}, ${num(r.dezt)}, ${num(r.total_ano)})`
    ).join(',\n');

    await sql.query(`
      INSERT INTO fundeb.ref_historico_stn (uf, ano, nivel, origem, jan, fev, mar, abr, mai, jun, jul, ago, sete, outu, novt, dezt, total_ano)
      VALUES ${values}
      ON CONFLICT (uf, ano, nivel, origem) DO UPDATE SET
        jan = EXCLUDED.jan, fev = EXCLUDED.fev, mar = EXCLUDED.mar,
        abr = EXCLUDED.abr, mai = EXCLUDED.mai, jun = EXCLUDED.jun,
        jul = EXCLUDED.jul, ago = EXCLUDED.ago, sete = EXCLUDED.sete,
        outu = EXCLUDED.outu, novt = EXCLUDED.novt, dezt = EXCLUDED.dezt,
        total_ano = EXCLUDED.total_ano
    `);
    inserted += batch.length;
  }

  writer.write('progress', { table: 'ref_historico_stn', status: 'done', rows: inserted });
  return inserted;
}

// ── Seed: matriculas_vaaf ───────────────────────────────────

async function seedMatriculasVaaf(
  sql: NeonSQL,
  spDb: Database.Database,
  nameToId: Map<string, number>,
  writer: SSEWriter,
) {
  writer.write('progress', { table: 'ref_matriculas_vaaf', status: 'starting' });

  await sql.query('DELETE FROM fundeb.ref_matriculas_vaaf');

  // Build local municipio_id -> municipalities.id mapping via name
  const spMunicipios = spDb.prepare('SELECT id, nome FROM municipios').all() as Array<{
    id: number; nome: string;
  }>;
  const localIdToMunId = new Map<number, number>();
  let unmapped = 0;
  for (const m of spMunicipios) {
    const munId = nameToId.get(m.nome.toLowerCase());
    if (munId) {
      localIdToMunId.set(m.id, munId);
    } else {
      unmapped++;
    }
  }

  if (unmapped > 0) {
    writer.write('warning', { table: 'ref_matriculas_vaaf', unmappedMunicipios: unmapped });
  }

  const rows = spDb.prepare('SELECT * FROM matriculas_vaaf').all() as Array<{
    municipio_id: number; secao: string | null; categoria: string | null;
    localidade: string | null; matriculas: number | null;
    vaaf_valor: number | null; subtotal: number | null;
  }>;

  let inserted = 0;
  let skipped = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const validRows: string[] = [];

    for (const r of batch) {
      const munId = localIdToMunId.get(r.municipio_id);
      if (!munId) { skipped++; continue; }
      validRows.push(
        `(${munId}, ${esc(r.secao)}, ${esc(r.categoria)}, ${esc(r.localidade)}, ${num(r.matriculas)}, ${num(r.vaaf_valor)}, ${num(r.subtotal)})`
      );
    }

    if (validRows.length > 0) {
      await sql.query(`
        INSERT INTO fundeb.ref_matriculas_vaaf (municipality_id, secao, categoria, localidade, matriculas, vaaf_valor, subtotal)
        VALUES ${validRows.join(',\n')}
      `);
      inserted += validRows.length;
    }

    if ((i / BATCH_SIZE) % 10 === 0) {
      writer.write('progress', {
        table: 'ref_matriculas_vaaf',
        status: 'inserting',
        inserted,
        total: rows.length,
      });
    }
  }

  writer.write('progress', {
    table: 'ref_matriculas_vaaf', status: 'done', rows: inserted, skipped,
  });
  return inserted;
}

// ── Route handler ───────────────────────────────────────────

const VALID_TABLES = [
  'ref_fatores_ponderacao',
  'ref_inep_censo',
  'ref_nse',
  'ref_historico_stn',
  'ref_matriculas_vaaf',
] as const;

export async function POST(request: Request) {
  const gate = await requireAdminApi();
  if (gate) return gate;
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    return Response.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }

  const url = new URL(request.url);
  const tablesParam = url.searchParams.get('tables') || 'all';
  const requestedTables = tablesParam === 'all'
    ? [...VALID_TABLES]
    : tablesParam.split(',').filter(t => VALID_TABLES.includes(t as typeof VALID_TABLES[number]));

  if (requestedTables.length === 0) {
    return Response.json({ error: 'No valid tables specified', valid: VALID_TABLES }, { status: 400 });
  }

  const { stream, writer, close } = createSSEStream();

  const run = async () => {
    const results: Record<string, number> = {};
    let brDb: Database.Database | null = null;
    let spDb: Database.Database | null = null;

    try {
      const sql = neon(DATABASE_URL);
      writer.write('start', { tables: requestedTables, timestamp: new Date().toISOString() });

      // Open SQLite connections
      const brPath = path.join(FNDE_DATA, 'fundeb_2026_br.db');
      const spPath = path.join(SP_DATA, 'fundeb_sp_2026.db');

      const needsBr = requestedTables.some(t =>
        ['ref_fatores_ponderacao', 'ref_inep_censo', 'ref_nse', 'ref_historico_stn'].includes(t)
      );
      const needsSp = requestedTables.includes('ref_matriculas_vaaf');

      if (needsBr) {
        brDb = new Database(brPath, { readonly: true });
        writer.write('info', { message: `Opened BR database: ${brPath}` });
      }
      if (needsSp) {
        spDb = new Database(spPath, { readonly: true });
        writer.write('info', { message: `Opened SP database: ${spPath}` });
      }

      // Build municipality lookup
      const { nameToId, ibgeToId, count: munCount } = await buildMunicipalityMaps(sql);
      writer.write('info', { message: `Loaded ${munCount} municipalities from Neon` });

      // Seed tables sequentially
      for (const table of requestedTables) {
        try {
          switch (table) {
            case 'ref_fatores_ponderacao':
              results[table] = await seedFatoresPonderacao(sql, brDb!, writer);
              break;
            case 'ref_inep_censo':
              results[table] = await seedInepCenso(sql, brDb!, ibgeToId, writer);
              break;
            case 'ref_nse':
              results[table] = await seedNse(sql, brDb!, ibgeToId, writer);
              break;
            case 'ref_historico_stn':
              results[table] = await seedHistoricoStn(sql, brDb!, writer);
              break;
            case 'ref_matriculas_vaaf':
              results[table] = await seedMatriculasVaaf(sql, spDb!, nameToId, writer);
              break;
          }
        } catch (err) {
          writer.write('error', { table, message: String(err) });
        }
      }

      // Audit (best-effort)
      try {
        await sql.query(
          `INSERT INTO audit.event_log (actor_id, actor_role, action, entity_type, entity_id, after_state)
           VALUES ('system', 'sistema', 'seed.reference', 'migration', NULL, '${JSON.stringify(results).replace(/'/g, "''")}'::jsonb)`
        );
      } catch { /* ignore */ }

      writer.write('done', { results, timestamp: new Date().toISOString() });
    } catch (err) {
      writer.write('error', { message: String(err) });
    } finally {
      brDb?.close();
      spDb?.close();
      close();
    }
  };

  run();

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
