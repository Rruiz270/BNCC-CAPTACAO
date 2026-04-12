import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

const DATABASE_URL = process.env.DATABASE_URL!;

// GET /api/municipalities/[slug]
// slug can be the numeric ID or IBGE code
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const sql = neon(DATABASE_URL);

    // Try to find by ID (numeric) or by IBGE code
    const isNumeric = /^\d+$/.test(slug);
    let municipality;

    if (isNumeric && slug.length <= 4) {
      // Short numeric = internal ID
      const result = await sql`
        SELECT * FROM fundeb.municipalities WHERE id = ${parseInt(slug)}
      `;
      municipality = result[0];
    } else if (isNumeric && slug.length === 7) {
      // 7-digit = IBGE code
      const result = await sql`
        SELECT * FROM fundeb.municipalities WHERE codigo_ibge = ${slug}
      `;
      municipality = result[0];
    } else {
      // Try ID first, then IBGE code
      const byId = await sql`
        SELECT * FROM fundeb.municipalities WHERE id = ${parseInt(slug) || 0}
      `;
      if (byId.length > 0) {
        municipality = byId[0];
      } else {
        const byCode = await sql`
          SELECT * FROM fundeb.municipalities WHERE codigo_ibge = ${slug}
        `;
        municipality = byCode[0];
      }
    }

    if (!municipality) {
      return Response.json(
        { error: 'Municipality not found', slug },
        { status: 404 }
      );
    }

    const muniId = municipality.id;

    // Fetch enrollments for this municipality
    const enrollments = await sql`
      SELECT
        id, categoria, categoria_label, fator_vaaf,
        quantidade, quantidade_urbana, quantidade_campo,
        receita_estimada, ativa
      FROM fundeb.enrollments
      WHERE municipality_id = ${muniId}
      ORDER BY receita_estimada DESC NULLS LAST
    `;

    // Fetch schools summary
    const schoolsSummary = await sql`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN localizacao = 'urbana' THEN 1 ELSE 0 END) as urbanas,
        SUM(CASE WHEN localizacao = 'rural' THEN 1 ELSE 0 END) as rurais,
        SUM(matriculas) as total_matriculas,
        SUM(docentes) as total_docentes,
        SUM(turmas) as total_turmas
      FROM fundeb.schools
      WHERE municipality_id = ${muniId}
    `;

    // Fetch compliance status
    const compliance = await sql`
      SELECT
        section, section_name, item_key, item_text, status, evidence_url, notes, updated_at
      FROM fundeb.compliance_items
      WHERE municipality_id = ${muniId}
      ORDER BY section, item_key
    `;

    // Fetch census data (full cross-reference row as JSONB)
    // Wrapped in try/catch because the table may not exist yet
    let censusData = null;
    try {
      const censusRows = await sql`
        SELECT raw_data FROM fundeb.census_data WHERE municipality_id = ${muniId} LIMIT 1
      `;
      censusData = censusRows.length > 0 ? censusRows[0].raw_data : null;
    } catch {
      // Table doesn't exist yet — census data not seeded
    }

    // Fetch action plans
    const actionPlans = await sql`
      SELECT
        id, semana, semana_label, tarefa, responsavel, status, due_date, completed_at
      FROM fundeb.action_plans
      WHERE municipality_id = ${muniId}
      ORDER BY semana, id
    `;

    // Compute enrollment summary
    const activeEnrollments = enrollments.filter((e: Record<string, unknown>) => e.ativa);
    const inactiveEnrollments = enrollments.filter((e: Record<string, unknown>) => !e.ativa);
    const totalEnrollmentRevenue = enrollments.reduce(
      (sum: number, e: Record<string, unknown>) => sum + ((e.receita_estimada as number) || 0), 0
    );

    // Compute compliance summary
    const complianceBySection: Record<string, { total: number; done: number; progress: number; pending: number }> = {};
    for (const item of compliance) {
      const sec = item.section as string;
      if (!complianceBySection[sec]) {
        complianceBySection[sec] = { total: 0, done: 0, progress: 0, pending: 0 };
      }
      complianceBySection[sec].total++;
      const st = item.status as string;
      if (st === 'done') complianceBySection[sec].done++;
      else if (st === 'progress') complianceBySection[sec].progress++;
      else complianceBySection[sec].pending++;
    }

    // Format the response
    const m = municipality;
    const response = {
      id: m.id,
      nome: m.nome,
      codigoIbge: m.codigo_ibge,
      populacao: m.populacao,
      regiao: m.regiao,

      // FUNDEB financials
      financials: {
        receitaTotal: m.receita_total,
        contribuicao: m.contribuicao,
        recursosReceber: m.recursos_receber,
        vaat: m.vaat,
        vaar: m.vaar,
        ganhoPerda: m.ganho_perda,
        destRemuneracao: m.dest_remuneracao,
        destInfantil: m.dest_infantil,
        destCapital: m.dest_capital,
        coeficiente: m.coeficiente,
        nse: m.nse,
      },

      // Revenue breakdown
      revenue: {
        icms: m.icms,
        ipva: m.ipva,
        ipiExp: m.ipi_exp,
        totalEstado: m.total_estado,
        fpm: m.fpm,
        itr: m.itr,
        totalUniao: m.total_uniao,
      },

      // Historical FUNDEB revenue
      historico: {
        '2022': m.hist_2022,
        '2023': m.hist_2023,
        '2024': m.hist_2024,
        '2025': m.hist_2025,
        '2026': m.hist_2026,
      },

      // Enrollment aggregates
      enrollmentSummary: {
        totalMatriculas: m.total_matriculas,
        categoriasAtivas: m.categorias_ativas,
        eiMat: m.ei_mat,
        eiVal: m.ei_val,
        efMat: m.ef_mat,
        efVal: m.ef_val,
        dmMat: m.dm_mat,
        dmVal: m.dm_val,
        activeCategories: activeEnrollments.length,
        inactiveCategories: inactiveEnrollments.length,
        totalEnrollmentRevenue,
      },

      // Detailed enrollments
      enrollments: enrollments.map((e: Record<string, unknown>) => ({
        id: e.id,
        categoria: e.categoria,
        categoriaLabel: e.categoria_label,
        fatorVaaf: e.fator_vaaf,
        quantidade: e.quantidade,
        quantidadeUrbana: e.quantidade_urbana,
        quantidadeCampo: e.quantidade_campo,
        receitaEstimada: e.receita_estimada,
        ativa: e.ativa,
      })),

      // Potencial de captacao
      potencial: {
        potTotal: m.pot_total,
        pctPotTotal: m.pct_pot_total,
        nFaltantes: m.n_faltantes,
        detalhes: m.potencial, // Full JSON with T1-T6 breakdowns
      },

      // Schools
      schools: {
        total: parseInt(schoolsSummary[0]?.total as string) || m.total_escolas || 0,
        municipais: m.escolas_municipais || null,
        urbanas: parseInt(schoolsSummary[0]?.urbanas as string) || 0,
        rurais: parseInt(schoolsSummary[0]?.rurais as string) || m.escolas_rurais || 0,
        totalMatriculas: parseInt(schoolsSummary[0]?.total_matriculas as string) || 0,
        totalDocentes: parseInt(schoolsSummary[0]?.total_docentes as string) || m.total_docentes || 0,
        totalTurmas: parseInt(schoolsSummary[0]?.total_turmas as string) || 0,
      },

      // Infrastructure
      infrastructure: {
        pctInternet: m.pct_internet,
        pctBiblioteca: m.pct_biblioteca,
        pctQuadra: m.pct_quadra,
        pctLabInfo: m.pct_lab_info,
      },

      // Education quality
      educationMetrics: {
        idebAi: m.ideb_ai,
        idebAf: m.ideb_af,
        saebPort5: m.saeb_port_5,
        saebMat5: m.saeb_mat_5,
        saebPort9: m.saeb_port_9,
        saebMat9: m.saeb_mat_9,
      },

      // Compliance
      compliance: {
        items: compliance.map((c: Record<string, unknown>) => ({
          section: c.section,
          sectionName: c.section_name,
          itemKey: c.item_key,
          itemText: c.item_text,
          status: c.status,
          evidenceUrl: c.evidence_url,
          notes: c.notes,
          updatedAt: c.updated_at,
        })),
        summary: complianceBySection,
      },

      // Action plans
      actionPlans: actionPlans.map((a: Record<string, unknown>) => ({
        id: a.id,
        semana: a.semana,
        semanaLabel: a.semana_label,
        tarefa: a.tarefa,
        responsavel: a.responsavel,
        status: a.status,
        dueDate: a.due_date,
        completedAt: a.completed_at,
      })),

      // Raw category data (for simulator)
      cats: m.cats,

      // Census cross-reference data (all 99 columns as JSONB)
      censusData: censusData ?? null,

      // T1-T6 potencial breakdown
      pot_t1: m.pot_t1 ?? null,
      pot_t2: m.pot_t2 ?? null,
      pot_t3: m.pot_t3 ?? null,
      pot_t4: m.pot_t4 ?? null,
      pot_t5_vaar: m.pot_t5_vaar ?? null,
      pot_t5_vaat: m.pot_t5_vaat ?? null,
      pot_t6: m.pot_t6 ?? null,
      estrategias_resumo: m.estrategias_resumo ?? null,
      cats_faltantes: m.cats_faltantes ?? null,
      cats_ativas_list: m.cats_ativas_list ?? null,
      n_estrategias: m.n_estrategias ?? null,
      crescimento_4anos: m.crescimento_4anos ?? null,
      recebe_vaar: m.recebe_vaar ?? null,
      recebe_vaat: m.recebe_vaat ?? null,
      quick_win_score: m.quick_win_score ?? null,
      t4_has_campo: m.t4_has_campo ?? null,
      t4_has_ind: m.t4_has_ind ?? null,
      t4_ganho_campo: m.t4_ganho_campo ?? null,
      t4_ganho_ind: m.t4_ganho_ind ?? null,
      t2_ganho: m.t2_ganho ?? null,
      t6_pct_integral: m.t6_pct_integral ?? null,
      t6_mat_integral: m.t6_mat_integral ?? null,

      // Timestamps
      createdAt: m.created_at,
      updatedAt: m.updated_at,
    };

    return Response.json(response);

  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error('Municipality detail API error:', errMsg);
    return Response.json(
      { error: 'Failed to fetch municipality', detail: errMsg },
      { status: 500 }
    );
  }
}
