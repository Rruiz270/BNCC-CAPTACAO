import { neon } from '@neondatabase/serverless';
import { requireAdminApi } from '@/lib/guard';
import { DDL_STATEMENTS, SP_STATEMENTS } from '@/lib/db/migrations';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DATABASE_URL = process.env.DATABASE_URL!;

type StmtResult = {
  index: number;
  kind: 'ddl' | 'sp';
  ok: boolean;
  summary: string;
  error?: string;
};

function summarize(stmt: string): string {
  // Pega a primeira linha nao vazia e encurta para 120 chars
  const first = stmt.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? '';
  return first.length > 120 ? first.slice(0, 117) + '...' : first;
}

async function runStatements(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sql: any,
  statements: readonly string[],
  kind: 'ddl' | 'sp'
): Promise<StmtResult[]> {
  const results: StmtResult[] = [];
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      await sql.query(stmt);
      results.push({ index: i, kind, ok: true, summary: summarize(stmt) });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ index: i, kind, ok: false, summary: summarize(stmt), error: msg });
    }
  }
  return results;
}

// POST /api/ops/migrate - aplica DDL + SPs da Onda 2 (idempotente)
export async function POST() {
  const gate = await requireAdminApi();
  if (gate) return gate;
  try {
    if (!DATABASE_URL) {
      return Response.json({ error: 'DATABASE_URL nao configurado' }, { status: 500 });
    }
    const sql = neon(DATABASE_URL);

    const ddlResults = await runStatements(sql, DDL_STATEMENTS, 'ddl');
    const spResults = await runStatements(sql, SP_STATEMENTS, 'sp');
    const all = [...ddlResults, ...spResults];

    const okCount = all.filter((r) => r.ok).length;
    const failCount = all.length - okCount;

    // Audit (best-effort)
    try {
      await sql.query(
        `INSERT INTO audit.event_log (actor_id, actor_role, action, entity_type, entity_id, after_state)
         VALUES ('system', 'sistema', 'migrate.onda2', 'migration', NULL, $1::jsonb)`,
        [JSON.stringify({ ok: okCount, fail: failCount })]
      );
    } catch {
      // ignore — audit.event_log pode nao existir se o DDL do proprio log falhou
    }

    return Response.json({
      ok: failCount === 0,
      counts: {
        total: all.length,
        ok: okCount,
        fail: failCount,
        ddl: ddlResults.length,
        sps: spResults.length,
      },
      results: all,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}

// GET /api/ops/migrate - retorna o estado atual (quais objetos existem)
export async function GET() {
  const gate = await requireAdminApi();
  if (gate) return gate;
  try {
    if (!DATABASE_URL) {
      return Response.json({ error: 'DATABASE_URL nao configurado' }, { status: 500 });
    }
    const sql = neon(DATABASE_URL);

    const schemas = await sql.query(
      `SELECT schema_name FROM information_schema.schemata
        WHERE schema_name IN ('fundeb','raw','audit','ops')
        ORDER BY schema_name`
    );

    const tables = await sql.query(
      `SELECT table_schema, table_name FROM information_schema.tables
        WHERE table_schema IN ('fundeb','raw','audit')
          AND table_name IN (
            'wizard_progress','scenarios','approvals','evidences',
            'imports','import_rows','lineage',
            'event_log','snapshots'
          )
        ORDER BY table_schema, table_name`
    );

    const matViews = await sql.query(
      `SELECT schemaname, matviewname FROM pg_matviews
        WHERE schemaname = 'ops'
        ORDER BY matviewname`
    );

    const sps = await sql.query(
      `SELECT n.nspname AS schema, p.proname AS name
         FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname IN ('fundeb','audit','ops')
          AND p.proname IN (
            'sp_recalcular_potencial',
            'sp_atualizar_compliance',
            'sp_consolidar_plano_acao',
            'sp_gerar_minuta',
            'sp_audit_log',
            'sp_snapshot_sessao',
            'sp_refresh_ops_views'
          )
        ORDER BY n.nspname, p.proname`
    );

    return Response.json({
      schemas,
      tables,
      materializedViews: matViews,
      storedProcedures: sps,
      pending: {
        ddlCount: DDL_STATEMENTS.length,
        spCount: SP_STATEMENTS.length,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
