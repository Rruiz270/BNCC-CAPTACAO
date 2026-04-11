import { neon } from '@neondatabase/serverless';
import { type NextRequest } from 'next/server';
import { runPipeline, type EtlSource, type ExtractInput } from '@/lib/etl/pipeline';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DATABASE_URL = process.env.DATABASE_URL!;

const VALID_SOURCES: readonly EtlSource[] = [
  'censo_escolar',
  'siope',
  'fnde',
  'ibge',
  'local',
];

// POST /api/etl/run
// body: {
//   source: 'censo_escolar'|'siope'|'fnde'|'ibge'|'local',
//   filename?: string,
//   uploadedBy?: string,
//   consultoriaId?: number,
//   municipalityId?: number,
//   rows: Array<Record<string, unknown>>,
//   metadata?: Record<string, unknown>
// }
export async function POST(req: NextRequest) {
  try {
    if (!DATABASE_URL) {
      return Response.json({ error: 'DATABASE_URL nao configurado' }, { status: 500 });
    }

    const body = (await req.json()) as Partial<ExtractInput> & { source?: string };
    if (!body || !body.source) {
      return Response.json({ error: 'source obrigatorio' }, { status: 400 });
    }
    if (!VALID_SOURCES.includes(body.source as EtlSource)) {
      return Response.json(
        { error: `source invalido. Valores: ${VALID_SOURCES.join(', ')}` },
        { status: 400 }
      );
    }
    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      return Response.json({ error: 'rows obrigatorio (array nao vazio)' }, { status: 400 });
    }

    const sql = neon(DATABASE_URL);

    const input: ExtractInput = {
      source: body.source as EtlSource,
      filename: body.filename,
      uploadedBy: body.uploadedBy,
      consultoriaId: body.consultoriaId ?? null,
      municipalityId: body.municipalityId ?? null,
      rows: body.rows as Array<Record<string, unknown>>,
      metadata: body.metadata,
    };

    const result = await runPipeline(sql, input);

    // Audit (best-effort)
    try {
      await sql.query(
        `INSERT INTO audit.event_log (actor_id, actor_role, action, entity_type, entity_id, consultoria_id, after_state)
         VALUES ($1, 'consultor', 'etl.pipeline.run', 'raw_import', $2, $3, $4::jsonb)`,
        [
          input.uploadedBy ?? 'anonymous',
          result.extract.importId,
          input.consultoriaId ?? null,
          JSON.stringify({
            source: input.source,
            rows_total: result.extract.rowsTotal,
            rows_ok: result.treat.rowsOk,
            rows_rejected: result.treat.rowsRejected,
            cataloged: result.catalog.cataloged,
            already_existed: result.extract.alreadyExists,
          }),
        ]
      );
    } catch {
      // ignore
    }

    return Response.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
