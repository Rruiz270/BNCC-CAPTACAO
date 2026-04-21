import { type NextRequest } from 'next/server';
import { getUser } from '@/lib/session';
import { sqlClient } from '@/lib/lead-ownership';
import { isAdmin } from '@/lib/roles';

export const dynamic = 'force-dynamic';

// GET /api/consultores
// Retorna lista de usuarios elegiveis para receber transferencias.
// - Consultor só vê outros consultores ativos+aprovados
// - Admin/gestor vê consultor + admin + gestor
export async function GET(_req: NextRequest) {
  const user = await getUser();
  if (!user) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  try {
    const sql = sqlClient();
    const rows = isAdmin(user.role)
      ? await sql.query(
          `SELECT id, COALESCE(display_name, name) AS name, email, role
             FROM crm.users
            WHERE is_active = TRUE
              AND approval_status = 'approved'
              AND role IN ('consultor', 'admin', 'gestor')
            ORDER BY COALESCE(display_name, name) ASC`,
          [],
        )
      : await sql.query(
          `SELECT id, COALESCE(display_name, name) AS name, email, role
             FROM crm.users
            WHERE is_active = TRUE
              AND approval_status = 'approved'
              AND role = 'consultor'
              AND id <> $1
            ORDER BY COALESCE(display_name, name) ASC`,
          [user.id],
        );

    const consultores = rows.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      name: (r.name ?? null) as string | null,
      email: (r.email ?? null) as string | null,
      role: String(r.role ?? 'consultor'),
    }));

    return Response.json({ consultores });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
