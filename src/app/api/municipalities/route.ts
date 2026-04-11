import { neon } from '@neondatabase/serverless';
import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const DATABASE_URL = process.env.DATABASE_URL!;

// GET /api/municipalities
// Query params:
//   search  - text search on nome
//   limit   - results per page (default 50, max 200)
//   offset  - pagination offset (default 0)
//   sort    - column to sort by (default: nome)
//   order   - asc or desc (default: asc)
//   filter_gp - "gain" (ganho_perda > 0), "loss" (ganho_perda < 0), or omit for all

export async function GET(request: NextRequest) {
  try {
    const sql = neon(DATABASE_URL);
    const searchParams = request.nextUrl.searchParams;

    const search = searchParams.get('search') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50') || 50, 1000);
    const offset = parseInt(searchParams.get('offset') || '0') || 0;
    const sort = searchParams.get('sort') || 'nome';
    const order = searchParams.get('order') === 'desc' ? 'desc' : 'asc';
    const filterGp = searchParams.get('filter_gp'); // 'gain' | 'loss' | null

    // Validate sort column to prevent SQL injection
    const allowedSorts = [
      'nome', 'receita_total', 'ganho_perda', 'total_matriculas',
      'pot_total', 'pct_pot_total', 'categorias_ativas', 'nse',
      'n_faltantes', 'recursos_receber', 'vaat', 'vaar',
      'total_escolas', 'total_docentes', 'pct_internet', 'id'
    ];
    const safeSort = allowedSorts.includes(sort) ? sort : 'nome';
    const orderDir = order === 'desc' ? 'DESC' : 'ASC';

    // Build WHERE clauses
    const conditions: string[] = [];
    const queryParams: unknown[] = [];
    let paramIdx = 1;

    if (search) {
      conditions.push(`LOWER(nome) LIKE LOWER($${paramIdx})`);
      queryParams.push(`%${search}%`);
      paramIdx++;
    }

    if (filterGp === 'gain') {
      conditions.push(`ganho_perda > 0`);
    } else if (filterGp === 'loss') {
      conditions.push(`ganho_perda < 0`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total for pagination
    const countResult = await sql.query(
      `SELECT COUNT(*) as total FROM fundeb.municipalities ${whereClause}`,
      queryParams.length > 0 ? [...queryParams] : undefined
    );
    const total = parseInt(countResult[0]?.total as string) || 0;

    // Main query - using sql.unsafe() for the safe sort/order (already validated)
    const dataQueryParams = [...queryParams, limit, offset];
    const dataQuery = `
      SELECT
        id, nome, codigo_ibge, receita_total, contribuicao, recursos_receber,
        vaat, vaar, ganho_perda, total_matriculas, categorias_ativas,
        icms, ipva, ipi_exp, total_estado, fpm, itr, total_uniao,
        nse, coeficiente,
        ei_mat, ef_mat, dm_mat,
        hist_2022, hist_2023, hist_2024, hist_2025, hist_2026,
        pot_total, pct_pot_total, n_faltantes,
        total_escolas, escolas_municipais, escolas_rurais, total_docentes,
        pct_internet, pct_biblioteca,
        saeb_port_5, saeb_mat_5, saeb_port_9, saeb_mat_9
      FROM fundeb.municipalities
      ${whereClause}
      ORDER BY ${safeSort} ${orderDir} NULLS LAST
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;

    const rows = await sql.query(dataQuery, dataQueryParams);

    // Format response
    const municipalities = rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      nome: row.nome,
      codigoIbge: row.codigo_ibge,
      receitaTotal: row.receita_total,
      contribuicao: row.contribuicao,
      recursosReceber: row.recursos_receber,
      vaat: row.vaat,
      vaar: row.vaar,
      ganhoPerda: row.ganho_perda,
      totalMatriculas: row.total_matriculas,
      categoriasAtivas: row.categorias_ativas,
      nse: row.nse,
      coeficiente: row.coeficiente,
      eiMat: row.ei_mat,
      efMat: row.ef_mat,
      dmMat: row.dm_mat,
      hist: {
        '2022': row.hist_2022,
        '2023': row.hist_2023,
        '2024': row.hist_2024,
        '2025': row.hist_2025,
        '2026': row.hist_2026,
      },
      potTotal: row.pot_total,
      pctPotTotal: row.pct_pot_total,
      nFaltantes: row.n_faltantes,
      totalEscolas: row.total_escolas,
      escolasMunicipais: row.escolas_municipais,
      escolasRurais: row.escolas_rurais,
      totalDocentes: row.total_docentes,
      pctInternet: row.pct_internet,
      pctBiblioteca: row.pct_biblioteca,
      saeb: {
        port5: row.saeb_port_5,
        mat5: row.saeb_mat_5,
        port9: row.saeb_port_9,
        mat9: row.saeb_mat_9,
      },
      revenue: {
        icms: row.icms,
        ipva: row.ipva,
        ipiExp: row.ipi_exp,
        totalEstado: row.total_estado,
        fpm: row.fpm,
        itr: row.itr,
        totalUniao: row.total_uniao,
      },
    }));

    // Summary stats (no dynamic params needed)
    const stats = await sql`
      SELECT
        COUNT(*) as total_municipalities,
        SUM(CASE WHEN ganho_perda > 0 THEN 1 ELSE 0 END) as gaining,
        SUM(CASE WHEN ganho_perda < 0 THEN 1 ELSE 0 END) as losing,
        SUM(ganho_perda) as total_gp,
        SUM(pot_total) as total_pot,
        AVG(pct_pot_total) as avg_pot_pct,
        SUM(total_matriculas) as total_enrollments,
        SUM(receita_total) as total_revenue
      FROM fundeb.municipalities
    `;

    return Response.json({
      data: municipalities,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
        totalPages: Math.ceil(total / limit),
        currentPage: Math.floor(offset / limit) + 1,
      },
      stats: stats[0] ? {
        totalMunicipalities: parseInt(stats[0].total_municipalities as string),
        gaining: parseInt(stats[0].gaining as string),
        losing: parseInt(stats[0].losing as string),
        totalGanhoPerda: stats[0].total_gp,
        totalPotencial: stats[0].total_pot,
        avgPotPct: stats[0].avg_pot_pct,
        totalEnrollments: stats[0].total_enrollments,
        totalRevenue: stats[0].total_revenue,
      } : null,
      meta: {
        sort: safeSort,
        order,
        search: search || null,
        filterGp: filterGp || null,
      }
    });

  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error('Municipalities API error:', errMsg);
    return Response.json(
      { error: 'Failed to fetch municipalities', detail: errMsg },
      { status: 500 }
    );
  }
}
