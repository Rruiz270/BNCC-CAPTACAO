/**
 * Radar de leads de consultoria FUNDEB (fundeb.leads).
 *
 * GET /api/leads?score=quente|morno|engajado|frio (opcional)
 *   → lista ordenada por pontos, com dados do município e status de
 *     consultoria existente (para não prospectar quem já é cliente).
 */
import { neon } from '@neondatabase/serverless';
import { requireAuthApi } from '@/lib/guard';

export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  const gate = await requireAuthApi();
  if (gate) return gate;

  const { searchParams } = new URL(request.url);
  const score = searchParams.get('score');

  try {
    const rows = score
      ? await sql`
          SELECT l.*, m.pot_total, m.total_matriculas, m.receita_total, m.recebe_vaar,
                 (SELECT COUNT(*)::int FROM fundeb.consultorias c
                   WHERE c.municipality_id = l.municipality_id AND c.status = 'active') AS consultorias_ativas
          FROM fundeb.leads l
          LEFT JOIN fundeb.municipalities m ON m.id = l.municipality_id
          WHERE l.score = ${score}
          ORDER BY l.pontos DESC NULLS LAST, l.nome`
      : await sql`
          SELECT l.*, m.pot_total, m.total_matriculas, m.receita_total, m.recebe_vaar,
                 (SELECT COUNT(*)::int FROM fundeb.consultorias c
                   WHERE c.municipality_id = l.municipality_id AND c.status = 'active') AS consultorias_ativas
          FROM fundeb.leads l
          LEFT JOIN fundeb.municipalities m ON m.id = l.municipality_id
          ORDER BY l.pontos DESC NULLS LAST, l.nome`;

    return Response.json({ leads: rows, total: rows.length });
  } catch {
    // Tabela pode não existir antes da migração rodar
    return Response.json({ leads: [], total: 0, warning: 'Tabela fundeb.leads ausente — rode /api/ops/migrate e scripts/import-leads.mjs' });
  }
}
