import { neon } from '@neondatabase/serverless';
import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const DATABASE_URL = process.env.DATABASE_URL!;

// GET /api/consultorias/[id]/resumo
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const consultoriaId = parseInt(id);

  try {
    const sql = neon(DATABASE_URL);

    // 1. Consultoria + Municipality (including T1-T6 and new columns)
    const cRows = await sql`
      SELECT c.id, c.status, c.start_date, c.end_date, c.notes,
             c.consultant_name, c.secretary_name, c.annotations,
             m.id as muni_id, m.nome, m.codigo_ibge, m.receita_total, m.total_matriculas,
             m.populacao, m.regiao, m.contribuicao, m.recursos_receber,
             m.vaat, m.vaar, m.ganho_perda, m.pot_total, m.pct_pot_total,
             m.pot_t1, m.pot_t2, m.pot_t3, m.pot_t4,
             m.pot_t5_vaar, m.pot_t5_vaat, m.pot_t6,
             m.cats_faltantes, m.estrategias_resumo, m.n_estrategias
      FROM fundeb.consultorias c
      JOIN fundeb.municipalities m ON m.id = c.municipality_id
      WHERE c.id = ${consultoriaId}
    `;

    if (cRows.length === 0) {
      return Response.json({ error: 'Consultoria nao encontrada' }, { status: 404 });
    }

    const c = cRows[0];
    const muniId = c.muni_id as number;

    // 2. All scenarios (not just target)
    const scenarioRows = await sql`
      SELECT id, nome, is_target, parametros, resultado, created_at
      FROM fundeb.scenarios
      WHERE consultoria_id = ${consultoriaId}
      ORDER BY is_target DESC, created_at DESC
    `;

    // 2b. Intake responses (for secretary name fallback)
    let intakeRespondentName: string | null = null;
    try {
      const intakeRows = await sql`
        SELECT ir.respondent_name
        FROM fundeb.intake_responses ir
        JOIN fundeb.intake_tokens it ON it.id = ir.token_id
        WHERE it.consultoria_id = ${consultoriaId}
        ORDER BY ir.submitted_at DESC
        LIMIT 1
      `;
      if (intakeRows.length > 0) {
        intakeRespondentName = intakeRows[0].respondent_name as string;
      }
    } catch { /* intake tables may not exist */ }

    // 3. Enrollments
    const enrollmentRows = await sql`
      SELECT id, categoria, categoria_label, fator_vaaf, quantidade, receita_estimada, ativa
      FROM fundeb.enrollments
      WHERE municipality_id = ${muniId}
      ORDER BY categoria
    `;

    // 4. Compliance items
    const complianceRows = await sql`
      SELECT id, section, section_name, item_key, item_text, status, evidence_url, notes, updated_at
      FROM fundeb.compliance_items
      WHERE municipality_id = ${muniId}
      ORDER BY section, item_key
    `;

    // 5. Action plans
    const actionRows = await sql`
      SELECT id, phase, semana, semana_label, task_key, tarefa, descricao, responsavel, status, due_date, notes, completed_at
      FROM fundeb.action_plans
      WHERE municipality_id = ${muniId}
      ORDER BY phase, semana, id
    `;

    // 6. Documents
    const docRows = await sql`
      SELECT id, tipo, titulo, status, versao, created_at, updated_at
      FROM fundeb.documents
      WHERE municipality_id = ${muniId}
      ORDER BY created_at DESC
    `;

    // 7. Snapshot
    const snapRows = await sql`
      SELECT id, hash, signed_by, signed_at, reason
      FROM audit.snapshots
      WHERE consultoria_id = ${consultoriaId}
      ORDER BY signed_at DESC
      LIMIT 1
    `;

    // --- Build response ---

    // Scenario target (first row is the target since we ordered by is_target DESC)
    const scenario = scenarioRows.find((s: Record<string, unknown>) => s.is_target) ?? null;
    const parametros = (scenario?.parametros ?? {}) as Record<string, unknown>;

    // Compute receita from enrollments (fator_vaaf is already R$/student)
    const receitaBase = enrollmentRows.reduce(
      (sum: number, e: Record<string, unknown>) => sum + (Number(e.quantidade) || 0) * (Number(e.fator_vaaf) || 0), 0
    );

    // Compute projected receita using scenario overrides
    const reclassificacoes = ((parametros.reclassificacoes ?? parametros) as Record<string, number>) || {};
    const receitaProjetada = enrollmentRows.reduce(
      (sum: number, e: Record<string, unknown>) => {
        const cat = e.categoria as string;
        const override = reclassificacoes[cat] as number | undefined;
        const qtd = override != null ? Number(override) : (Number(e.quantidade) || 0);
        return sum + qtd * (Number(e.fator_vaaf) || 0);
      }, 0
    );

    const delta = receitaProjetada - receitaBase;
    const deltaPct = receitaBase > 0 ? (delta / receitaBase) * 100 : 0;

    const cenarioAlvo = scenario ? {
      id: scenario.id,
      nome: scenario.nome,
      receitaBase,
      receitaProjetada,
      delta,
      deltaPct,
      reclassificacoes: parametros,
    } : null;

    // Compliance aggregation
    const compTotal = complianceRows.length;
    const compDone = complianceRows.filter((r: Record<string, unknown>) => r.status === 'done').length;
    const compLate = complianceRows.filter((r: Record<string, unknown>) => r.status === 'late').length;

    const sectionMap = new Map<string, { section: string; sectionName: string; total: number; done: number; items: unknown[] }>();
    for (const row of complianceRows) {
      const sec = row.section as string;
      if (!sectionMap.has(sec)) {
        sectionMap.set(sec, { section: sec, sectionName: row.section_name as string, total: 0, done: 0, items: [] });
      }
      const entry = sectionMap.get(sec)!;
      entry.total++;
      if (row.status === 'done') entry.done++;
      entry.items.push({
        id: row.id,
        itemKey: row.item_key,
        itemText: row.item_text,
        status: row.status,
        evidenceUrl: row.evidence_url,
        notes: row.notes,
      });
    }

    // Action plan aggregation by phase
    const phaseMap: Record<string, { total: number; done: number; tarefas: unknown[] }> = {
      curto: { total: 0, done: 0, tarefas: [] },
      medio: { total: 0, done: 0, tarefas: [] },
      longo: { total: 0, done: 0, tarefas: [] },
    };

    for (const row of actionRows) {
      const phase = (row.phase as string) || 'curto';
      if (!phaseMap[phase]) phaseMap[phase] = { total: 0, done: 0, tarefas: [] };
      phaseMap[phase].total++;
      if (row.status === 'done') phaseMap[phase].done++;
      phaseMap[phase].tarefas.push({
        id: row.id,
        taskKey: row.task_key,
        tarefa: row.tarefa,
        descricao: row.descricao,
        responsavel: row.responsavel,
        status: row.status,
        dueDate: row.due_date,
        notes: row.notes,
        completedAt: row.completed_at,
        semana: row.semana,
        semanaLabel: row.semana_label,
      });
    }

    // Categories with projected values from scenario
    const categorias = enrollmentRows.map((e: Record<string, unknown>) => {
      const cat = e.categoria as string;
      const qtdAtual = Number(e.quantidade) || 0;
      const fator = Number(e.fator_vaaf) || 1;
      const receitaAtual = Number(e.receita_estimada) || 0;

      // Check if scenario has override for this category
      // parametros is { reclassificacoes: { cat: newQtd, ... } }
      const reclassificacoes = (parametros.reclassificacoes ?? parametros) as Record<string, number>;
      const override = reclassificacoes[cat] as number | undefined;
      const qtdProjetada = override != null ? Number(override) : qtdAtual;
      // fator is already the full VAAF R$/student (e.g. 10131.14), NOT a multiplier
      const receitaProj = qtdProjetada * fator;
      const catDelta = receitaProj - receitaAtual;

      return {
        categoria: cat,
        label: e.categoria_label || cat,
        fator,
        qtdAtual,
        qtdProjetada,
        receitaAtual,
        receitaProjetada: receitaProj,
        delta: catDelta,
        ativa: e.ativa,
      };
    });

    // Acoes Censo 2026: curto prazo tasks marked as done
    const acoesCenso2026 = phaseMap.curto.tarefas.filter((t: unknown) => (t as Record<string, unknown>).status === 'done');

    // Roadmap 2027: medio/longo prazo tasks still pending
    const roadmap2027 = [
      ...phaseMap.medio.tarefas.filter((t: unknown) => (t as Record<string, unknown>).status !== 'done'),
      ...phaseMap.longo.tarefas.filter((t: unknown) => (t as Record<string, unknown>).status !== 'done'),
    ];

    // Documents
    const documentos = docRows.map((d: Record<string, unknown>) => ({
      id: d.id,
      tipo: d.tipo,
      titulo: d.titulo,
      status: d.status,
      versao: d.versao,
    }));

    // Snapshot
    const snapshot = snapRows.length > 0 ? {
      id: snapRows[0].id,
      hash: snapRows[0].hash,
      signedBy: snapRows[0].signed_by,
      signedAt: snapRows[0].signed_at,
      reason: snapRows[0].reason,
    } : null;

    // Build all scenarios list
    const allScenarios = scenarioRows.map((s: Record<string, unknown>) => ({
      id: s.id,
      nome: s.nome,
      isTarget: s.is_target,
      parametros: s.parametros,
      resultado: s.resultado,
      createdAt: s.created_at,
    }));

    return Response.json({
      consultoria: {
        id: c.id,
        status: c.status,
        startDate: c.start_date,
        endDate: c.end_date,
        notes: c.notes,
        consultantName: c.consultant_name,
        secretaryName: c.secretary_name || intakeRespondentName,
        annotations: c.annotations,
      },
      municipio: {
        id: muniId,
        nome: c.nome,
        codigoIbge: c.codigo_ibge,
        receitaTotal: receitaBase,
        totalMatriculas: Number(c.total_matriculas) || 0,
        populacao: c.populacao,
        regiao: c.regiao,
      },
      tierBreakdown: {
        t1: Number(c.pot_t1) || 0,
        t2: Number(c.pot_t2) || 0,
        t3: Number(c.pot_t3) || 0,
        t4: Number(c.pot_t4) || 0,
        t5Vaar: Number(c.pot_t5_vaar) || 0,
        t5Vaat: Number(c.pot_t5_vaat) || 0,
        t6: Number(c.pot_t6) || 0,
        catsFaltantes: c.cats_faltantes,
        estrategiasResumo: c.estrategias_resumo,
        nEstrategias: c.n_estrategias,
      },
      cenarioAlvo,
      cenarios: allScenarios,
      compliance: {
        total: compTotal,
        done: compDone,
        late: compLate,
        porSecao: Array.from(sectionMap.values()),
      },
      plano: phaseMap,
      categorias,
      documentos,
      snapshot,
      acoesCenso2026,
      roadmap2027,
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}
