import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
const DATABASE_URL = process.env.DATABASE_URL!;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await ctx.params;
    const sql = neon(DATABASE_URL);

    // Validate token
    let access;
    try {
      const rows = await sql`
        SELECT ma.*, m.nome, m.receita_total, m.pot_total, m.total_matriculas,
               m.ganho_perda, m.vaar, m.vaat, m.hist_2022, m.hist_2023, m.hist_2024, m.hist_2025, m.hist_2026
        FROM fundeb.municipio_access ma
        JOIN fundeb.municipalities m ON m.id = ma.municipality_id
        WHERE ma.access_token = ${token}
          AND (ma.expires_at IS NULL OR ma.expires_at > NOW())
      `;
      if (rows.length === 0) {
        return Response.json({ error: 'Token invalido ou expirado' }, { status: 403 });
      }
      access = rows[0];
    } catch {
      // Table may not exist
      return Response.json({ error: 'Sistema de acesso nao configurado' }, { status: 500 });
    }

    const muniId = access.municipality_id;

    // Update last access
    try {
      await sql`UPDATE fundeb.municipio_access SET last_access = NOW() WHERE access_token = ${token}`;
    } catch { /* ignore */ }

    // Fetch compliance
    const compRows = await sql`
      SELECT section, section_name,
        COUNT(*)::int as total,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END)::int as done
      FROM fundeb.compliance_items
      WHERE municipality_id = ${muniId}
      GROUP BY section, section_name
      ORDER BY section
    `;

    // Fetch action plans
    const planRows = await sql`
      SELECT phase, tarefa, status, due_date
      FROM fundeb.action_plans
      WHERE municipality_id = ${muniId}
      ORDER BY phase, semana
    `;

    return Response.json({
      municipio: access.nome,
      receitaTotal: access.receita_total || 0,
      potTotal: access.pot_total || 0,
      totalMatriculas: access.total_matriculas || 0,
      financials: {
        ganhoPerda: access.ganho_perda || 0,
        vaar: access.vaar || 0,
        vaat: access.vaat || 0,
      },
      historico: {
        '2022': access.hist_2022 || 0,
        '2023': access.hist_2023 || 0,
        '2024': access.hist_2024 || 0,
        '2025': access.hist_2025 || 0,
        '2026': access.hist_2026 || 0,
      },
      compliance: compRows.map((r: Record<string, unknown>) => ({
        section: r.section,
        sectionName: r.section_name || r.section,
        total: r.total || 0,
        done: r.done || 0,
      })),
      actionPlans: planRows.map((r: Record<string, unknown>) => ({
        phase: r.phase,
        tarefa: r.tarefa,
        status: r.status,
        dueDate: r.due_date,
      })),
      lastUpdated: new Date().toLocaleDateString('pt-BR'),
    });
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
