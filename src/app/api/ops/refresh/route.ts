import { neon } from '@neondatabase/serverless';
import { requireAdminApi } from '@/lib/guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const DATABASE_URL = process.env.DATABASE_URL!;

// POST /api/ops/refresh
// Chama ops.sp_refresh_ops_views() para atualizar as materialized views.
// Seguro de rodar a qualquer momento (best-effort dentro da SP).
export async function POST() {
  const gate = await requireAdminApi();
  if (gate) return gate;
  try {
    if (!DATABASE_URL) {
      return Response.json({ error: 'DATABASE_URL nao configurado' }, { status: 500 });
    }
    const sql = neon(DATABASE_URL);
    await sql.query('CALL ops.sp_refresh_ops_views()');

    // Audit (best-effort)
    try {
      await sql.query(
        `INSERT INTO audit.event_log (actor_id, actor_role, action, entity_type)
         VALUES ('system', 'sistema', 'ops.refresh', 'materialized_view')`
      );
    } catch {
      // ignore
    }

    return Response.json({ ok: true, refreshedAt: new Date().toISOString() });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
