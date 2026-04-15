import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const DATABASE_URL = process.env.DATABASE_URL!;

const fmt = (v: number | null) => {
  if (v == null) return 'R$ 0';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

// GET /api/relatorios?municipalityId=X&consultoriaId=Y - generate HTML report
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const muniId = searchParams.get('municipalityId');
  const consultoriaIdParam = searchParams.get('consultoriaId');
  const reportType = searchParams.get('tipo') || 'inicial'; // 'inicial' or 'final'

  if (!muniId) return Response.json({ error: 'municipalityId required' }, { status: 400 });

  const sql = neon(DATABASE_URL);

  // Fetch all data
  const muniRows = await sql`SELECT * FROM fundeb.municipalities WHERE id = ${parseInt(muniId)}`;
  if (muniRows.length === 0) return Response.json({ error: 'not found' }, { status: 404 });
  const m = muniRows[0] as Record<string, unknown>;

  const enrollments = await sql`
    SELECT categoria_label, fator_vaaf, quantidade, quantidade_urbana, quantidade_campo, receita_estimada, ativa
    FROM fundeb.enrollments WHERE municipality_id = ${parseInt(muniId)} ORDER BY receita_estimada DESC NULLS LAST
  `;

  const compliance = await sql`
    SELECT section, section_name, item_key, item_text, status
    FROM fundeb.compliance_items WHERE municipality_id = ${parseInt(muniId)} ORDER BY section, item_key
  `;

  const actionPlans = await sql`
    SELECT phase, semana_label, tarefa, responsavel, status, due_date
    FROM fundeb.action_plans WHERE municipality_id = ${parseInt(muniId)} ORDER BY phase, semana
  `;

  // Consultoria-specific data (when consultoriaId is provided)
  let consultantName = '';
  let secretaryName = '';
  let annotations = '';
  let scenarios: Array<Record<string, unknown>> = [];

  if (consultoriaIdParam) {
    const cId = parseInt(consultoriaIdParam);
    try {
      const cRows = await sql`
        SELECT consultant_name, secretary_name, annotations
        FROM fundeb.consultorias WHERE id = ${cId}
      `;
      if (cRows.length > 0) {
        consultantName = (cRows[0].consultant_name as string) || '';
        secretaryName = (cRows[0].secretary_name as string) || '';
        annotations = (cRows[0].annotations as string) || '';
      }

      // Fallback: get secretary from intake
      if (!secretaryName) {
        try {
          const intakeRows = await sql`
            SELECT ir.respondent_name
            FROM fundeb.intake_responses ir
            JOIN fundeb.intake_tokens it ON it.id = ir.token_id
            WHERE it.consultoria_id = ${cId}
            ORDER BY ir.submitted_at DESC LIMIT 1
          `;
          if (intakeRows.length > 0) {
            secretaryName = (intakeRows[0].respondent_name as string) || '';
          }
        } catch { /* intake tables may not exist */ }
      }

      // Fetch all scenarios
      const scenarioRows = await sql`
        SELECT nome, is_target, parametros, resultado, created_at
        FROM fundeb.scenarios WHERE consultoria_id = ${cId}
        ORDER BY is_target DESC, created_at DESC
      `;
      scenarios = scenarioRows as Array<Record<string, unknown>>;
    } catch { /* consultoria columns may not exist yet */ }
  }

  const nome = m.nome as string;
  const receitaTotal = (m.receita_total as number) || 0;
  const potTotal = (m.pot_total as number) || 0;
  const pctPot = (m.pct_pot_total as number) || 0;
  const nFaltantes = (m.n_faltantes as number) || 0;
  const ganhoPerda = (m.ganho_perda as number) || 0;
  const totalMat = (m.total_matriculas as number) || 0;

  // T1-T6
  const t1 = (m.pot_t1 as number) || 0;
  const t2 = (m.pot_t2 as number) || 0;
  const t3 = (m.pot_t3 as number) || 0;
  const t4 = (m.pot_t4 as number) || 0;
  const t5vaar = (m.pot_t5_vaar as number) || 0;
  const t5vaat = (m.pot_t5_vaat as number) || 0;
  const t5 = t5vaar + t5vaat;
  const t6 = (m.pot_t6 as number) || 0;
  const totalTiers = t1 + t2 + t3 + t4 + t5 + t6;

  const hoje = new Date().toLocaleDateString('pt-BR');

  // Compliance aggregation
  const compTotal = compliance.length;
  const compDone = compliance.filter((c: Record<string, unknown>) => c.status === 'done').length;
  const compPct = compTotal > 0 ? Math.round((compDone / compTotal) * 100) : 0;

  // Action plan aggregation
  const apTotal = actionPlans.length;
  const apDone = actionPlans.filter((a: Record<string, unknown>) => a.status === 'done').length;
  const apPct = apTotal > 0 ? Math.round((apDone / apTotal) * 100) : 0;

  // Scenario comparison section
  const scenarioHtml = scenarios.length > 0 ? `<div class="section">
  <h2>8. Cenarios Simulados</h2>
  <table>
    <tr><th>Cenario</th><th>Alvo</th><th>Categorias</th><th>Receita Projetada</th><th>Ganho</th><th>%</th></tr>
    ${scenarios.map((s: Record<string, unknown>) => {
      const resultado = (s.resultado || {}) as Record<string, unknown>;
      const parametros = (s.parametros || {}) as Record<string, unknown>;
      const reclassificacoes = (parametros.reclassificacoes || parametros) as Record<string, unknown>;
      const nCats = Object.keys(reclassificacoes).length;
      const delta = (resultado.delta as number) || 0;
      const deltaPct = (resultado.deltaPct as number) || 0;
      const receitaProj = (resultado.receitaProjetada as number) || 0;
      return `<tr>
        <td><strong>${s.nome}</strong></td>
        <td>${s.is_target ? '<span class="badge done">ALVO</span>' : '-'}</td>
        <td>${nCats}</td>
        <td>${fmt(receitaProj)}</td>
        <td style="color:${delta >= 0 ? '#00A878' : '#e63946'}">${delta >= 0 ? '+' : ''}${fmt(delta)}</td>
        <td>${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%</td>
      </tr>`;
    }).join('')}
  </table>
</div>` : '';

  // Annotations section
  const annotationsHtml = annotations ? `<div class="section">
  <h2>9. Anotacoes da Consultoria</h2>
  <div style="background:#f8f9fa;border-radius:8px;padding:20px;border:1px solid #e9ecef;white-space:pre-wrap;font-size:13px;line-height:1.8">${annotations}</div>
</div>` : '';

  // Signature lines
  const signatureConsultant = consultantName || '________________________';
  const signatureSecretary = secretaryName || '________________________';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatorio FUNDEB - ${nome}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, sans-serif; color: #1a1a2e; line-height: 1.6; padding: 40px; max-width: 1000px; margin: 0 auto; }
  .header { text-align: center; border-bottom: 3px solid #0A2463; padding-bottom: 20px; margin-bottom: 30px; }
  .header h1 { font-size: 28px; color: #0A2463; }
  .header .subtitle { color: #666; font-size: 14px; margin-top: 5px; }
  .header .brand { color: #00B4D8; font-size: 12px; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 8px; }
  .section { margin-bottom: 30px; page-break-inside: avoid; }
  .section h2 { font-size: 18px; color: #0A2463; border-bottom: 2px solid #00B4D8; padding-bottom: 8px; margin-bottom: 15px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
  .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .kpi { background: #f8f9fa; border-radius: 8px; padding: 15px; text-align: center; border: 1px solid #e9ecef; }
  .kpi .label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  .kpi .value { font-size: 22px; font-weight: 700; color: #0A2463; margin-top: 4px; }
  .kpi .value.green { color: #00A878; }
  .kpi .value.red { color: #e63946; }
  .kpi .value.blue { color: #00B4D8; }
  .kpi .sub { font-size: 10px; color: #999; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #0A2463; color: white; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 8px 12px; border-bottom: 1px solid #e9ecef; }
  tr:nth-child(even) { background: #f8f9fa; }
  .tier-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .tier-bar .bar { flex: 1; height: 20px; background: #f0f0f0; border-radius: 4px; overflow: hidden; }
  .tier-bar .fill { height: 100%; border-radius: 4px; }
  .tier-bar .label { width: 200px; font-size: 12px; font-weight: 600; }
  .tier-bar .val { width: 120px; text-align: right; font-size: 13px; font-weight: 700; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .badge.done { background: #d4edda; color: #155724; }
  .badge.pending { background: #fff3cd; color: #856404; }
  .badge.progress { background: #d1ecf1; color: #0c5460; }
  .phase-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .phase-curto { background: #fff3cd; color: #92400e; border: 1px solid #fde68a; }
  .phase-medio { background: #dbeafe; color: #1e40af; border: 1px solid #93c5fd; }
  .phase-longo { background: #cffafe; color: #0e7490; border: 1px solid #67e8f9; }
  .alert-box { padding: 15px 20px; border-radius: 8px; margin-bottom: 15px; }
  .alert-urgent { background: #fef2f2; border: 2px solid #fca5a5; color: #991b1b; }
  .alert-info { background: #eff6ff; border: 1px solid #93c5fd; color: #1e40af; }
  .progress-bar { height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden; margin-top: 6px; }
  .progress-bar .fill { height: 100%; border-radius: 4px; background: #00A878; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; padding-top: 30px; border-top: 2px solid #e9ecef; }
  .sig-block { text-align: center; }
  .sig-block .line { border-top: 1px solid #999; padding-top: 8px; margin-top: 60px; font-size: 13px; font-weight: 600; }
  .sig-block .role { font-size: 11px; color: #666; margin-top: 2px; }
  .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 11px; }
  @media print { body { padding: 20px; } .section { page-break-inside: avoid; } }
</style>
</head>
<body>
<div class="header">
  <div class="brand">Instituto i10 - Plataforma FUNDEB</div>
  <h1>${reportType === 'final' ? 'Relatorio Final de Consultoria FUNDEB' : 'Relatorio Inicial de Consultoria FUNDEB'}</h1>
  <h2 style="color:#00B4D8; font-size:24px; margin-top:10px;">${nome}</h2>
  <div class="subtitle">Gerado em ${hoje} | Exercicio 2026 | Estado de Sao Paulo</div>
  <div style="font-size:11px;color:#999;margin-top:8px">Protocolo: i10-${consultoriaIdParam || muniId}-${Date.now().toString(36).toUpperCase()}</div>
</div>

<div class="section">
  <h2>1. Resumo Financeiro</h2>
  <div class="grid">
    <div class="kpi">
      <div class="label">Receita Total FUNDEB</div>
      <div class="value">${fmt(receitaTotal)}</div>
    </div>
    <div class="kpi">
      <div class="label">Potencial de Captacao</div>
      <div class="value green">+${fmt(potTotal)}</div>
      <div class="sub">${pctPot.toFixed(1)}% da receita atual</div>
    </div>
    <div class="kpi">
      <div class="label">Receita Otimizada</div>
      <div class="value blue">${fmt(receitaTotal + potTotal)}</div>
    </div>
  </div>
  <div class="grid4" style="margin-top:15px">
    <div class="kpi">
      <div class="label">Total Matriculas</div>
      <div class="value">${totalMat.toLocaleString('pt-BR')}</div>
    </div>
    <div class="kpi">
      <div class="label">Ganho/Perda</div>
      <div class="value ${ganhoPerda >= 0 ? 'green' : 'red'}">${fmt(ganhoPerda)}</div>
    </div>
    <div class="kpi">
      <div class="label">Categorias Faltantes</div>
      <div class="value red">${nFaltantes}</div>
    </div>
    <div class="kpi">
      <div class="label">VAAR</div>
      <div class="value">${fmt((m.vaar as number) || 0)}</div>
    </div>
  </div>
</div>

<div class="section" style="page-break-inside:avoid">
  <div class="alert-box alert-urgent">
    <strong>PRAZO CRITICO — Censo Escolar 2026</strong><br>
    <span style="font-size:13px">Data de referencia: <strong>27 de Maio de 2026</strong>. As acoes abaixo devem ser executadas ANTES desta data para que as matriculas sejam contabilizadas no FUNDEB 2027.</span>
  </div>
  <h2>2. Acoes para o Censo 2026 <span class="phase-badge phase-curto">Curto Prazo</span></h2>
  <table>
    <tr><th>#</th><th>Acao</th><th>Impacto</th><th>Responsavel</th></tr>
    <tr><td>1</td><td>Revisar e ativar categorias FUNDEB zeradas no Educacenso</td><td style="color:#00A878;font-weight:700">${fmt(t1)}</td><td>Secretaria de Educacao</td></tr>
    <tr><td>2</td><td>Reclassificar alunos de jornada parcial para integral (7h+)</td><td style="color:#00A878;font-weight:700">${fmt(t2)}</td><td>Direcao escolar</td></tr>
    <tr><td>3</td><td>Registrar dupla matricula AEE e educacao especial</td><td style="color:#00A878;font-weight:700">${fmt(t3)}</td><td>Coordenacao pedagogica</td></tr>
    <tr><td>4</td><td>Registrar alunos em escolas de campo/indigena com multiplicadores</td><td style="color:#00A878;font-weight:700">${fmt(t4)}</td><td>Secretaria de Educacao</td></tr>
    <tr><td>5</td><td>Validar todas as matriculas no sistema Educacenso antes de 27/mai</td><td>Validacao</td><td>Equipe tecnica</td></tr>
  </table>
  <div class="alert-box alert-info" style="margin-top:15px">
    <strong>Acoes de Medio Prazo</strong> <span class="phase-badge phase-medio">Medio Prazo — Ate Agosto 2026</span><br>
    <span style="font-size:12px">Atualizar curriculo com BNCC Computacao, aprovar no CME, registrar no SIMEC. Impacto: elegibilidade VAAR 2027 (${fmt((m.vaar as number) || 0)}).</span>
  </div>
  <div class="alert-box alert-info" style="margin-top:8px">
    <strong>Acoes de Longo Prazo</strong> <span class="phase-badge phase-longo">Longo Prazo — 2027+</span><br>
    <span style="font-size:12px">Expansao de escola integral (EC 135), otimizacao VAAR/VAAT, infraestrutura digital. Impacto estimado: ${fmt(t5 + t6)}/ano.</span>
  </div>
</div>

<div class="section">
  <h2>3. Potencial por Tier (T1-T6)</h2>
  <div class="grid" style="margin-bottom:15px">
    <div class="kpi">
      <div class="label">Potencial Total T1-T6</div>
      <div class="value green">${fmt(totalTiers)}</div>
    </div>
    <div class="kpi">
      <div class="label">VAAR</div>
      <div class="value">${fmt(t5vaar)}</div>
      <div class="sub">T5 - Complementacao federal</div>
    </div>
    <div class="kpi">
      <div class="label">VAAT</div>
      <div class="value">${fmt(t5vaat)}</div>
      <div class="sub">T5 - Complementacao federal</div>
    </div>
  </div>
  ${[
    { label: 'T1 - Categorias Zeradas', val: t1, color: '#ef4444', desc: 'Ativar categorias FUNDEB sem matriculas' },
    { label: 'T2 - Reclassificacao Integral', val: t2, color: '#f59e0b', desc: 'Converter parcial para integral (maior VAAF)' },
    { label: 'T3 - AEE/Ed. Especial', val: t3, color: '#8b5cf6', desc: 'Dupla matricula e educacao especial' },
    { label: 'T4 - Campo/Indigena', val: t4, color: '#22c55e', desc: 'Multiplicadores localizacao diferenciada' },
    { label: 'T5 - VAAR/VAAT', val: t5, color: '#3b82f6', desc: 'Complementacoes federais por condicionalidades' },
    { label: 'T6 - EC 135 Integral', val: t6, color: '#06b6d4', desc: 'Expansao escola integral obrigatoria' },
  ].map(t => {
    const maxVal = Math.max(t1, t2, t3, t4, t5, t6, 1);
    const pctW = Math.max((t.val / maxVal) * 100, 2);
    return `<div class="tier-bar">
      <div class="label" style="color:${t.color}">${t.label}</div>
      <div class="bar"><div class="fill" style="width:${pctW}%;background:${t.color}"></div></div>
      <div class="val" style="color:${t.color}">${fmt(t.val)}</div>
    </div>
    <div style="font-size:11px;color:#666;margin:-4px 0 12px 210px">${t.desc}</div>`;
  }).join('')}
  ${(m.cats_faltantes as string) ? `<div style="margin-top:10px;padding:10px;background:#fff3cd;border-radius:6px;font-size:12px"><strong>Categorias nao captadas:</strong> ${m.cats_faltantes}</div>` : ''}
  ${(m.estrategias_resumo as string) ? `<div style="margin-top:8px;padding:10px;background:#d4edda;border-radius:6px;font-size:12px"><strong>Estrategias identificadas (${(m.n_estrategias as number) || 0}):</strong> ${m.estrategias_resumo}</div>` : ''}
</div>

<div class="section">
  <h2>4. Evolucao Historica</h2>
  <table>
    <tr><th>Ano</th><th>Receita FUNDEB</th><th>Variacao</th></tr>
    ${['2022','2023','2024','2025','2026'].map((year, i) => {
      const val = (m[('hist_' + year) as string] as number) || 0;
      const prev = i > 0 ? ((m[('hist_' + ['2022','2023','2024','2025','2026'][i-1]) as string] as number) || 0) : 0;
      const variacao = i > 0 && prev > 0 ? ((val - prev) / prev * 100).toFixed(1) + '%' : '-';
      return `<tr><td><strong>${year}</strong></td><td>${fmt(val)}</td><td>${variacao}</td></tr>`;
    }).join('')}
  </table>
</div>

<div class="section">
  <h2>5. Matriculas por Categoria FUNDEB</h2>
  <table>
    <tr><th>Categoria</th><th>Qtd</th><th>Urbano</th><th>Campo</th><th>Valor/Aluno</th><th>Receita</th><th>Status</th></tr>
    ${enrollments.map((e: Record<string, unknown>) => `<tr>
      <td>${e.categoria_label}</td>
      <td>${e.quantidade}</td>
      <td>${e.quantidade_urbana}</td>
      <td>${e.quantidade_campo}</td>
      <td>${fmt(e.fator_vaaf as number)}</td>
      <td>${fmt(e.receita_estimada as number)}</td>
      <td><span class="badge ${e.ativa ? 'done' : 'pending'}">${e.ativa ? 'Ativa' : 'Inativa'}</span></td>
    </tr>`).join('')}
  </table>
</div>

${compliance.length > 0 ? `<div class="section">
  <h2>6. Status de Compliance</h2>
  <div class="grid" style="margin-bottom:15px">
    <div class="kpi">
      <div class="label">Total Itens</div>
      <div class="value">${compTotal}</div>
    </div>
    <div class="kpi">
      <div class="label">Concluidos</div>
      <div class="value green">${compDone}</div>
    </div>
    <div class="kpi">
      <div class="label">Progresso</div>
      <div class="value blue">${compPct}%</div>
      <div class="progress-bar"><div class="fill" style="width:${compPct}%"></div></div>
    </div>
  </div>
  <table>
    <tr><th>Secao</th><th>Item</th><th>Status</th></tr>
    ${compliance.map((c: Record<string, unknown>) => `<tr>
      <td>${c.section_name || c.section}</td>
      <td>${c.item_text}</td>
      <td><span class="badge ${c.status}">${c.status === 'done' ? 'Concluido' : c.status === 'progress' ? 'Em Andamento' : 'Pendente'}</span></td>
    </tr>`).join('')}
  </table>
</div>` : ''}

${actionPlans.length > 0 ? `<div class="section">
  <h2>7. Plano de Acao</h2>
  <div class="grid" style="margin-bottom:15px">
    <div class="kpi">
      <div class="label">Total Tarefas</div>
      <div class="value">${apTotal}</div>
    </div>
    <div class="kpi">
      <div class="label">Concluidas</div>
      <div class="value green">${apDone}</div>
    </div>
    <div class="kpi">
      <div class="label">Progresso</div>
      <div class="value blue">${apPct}%</div>
      <div class="progress-bar"><div class="fill" style="width:${apPct}%"></div></div>
    </div>
  </div>
  <table>
    <tr><th>Fase</th><th>Semana</th><th>Tarefa</th><th>Responsavel</th><th>Prazo</th><th>Status</th></tr>
    ${actionPlans.map((a: Record<string, unknown>) => `<tr>
      <td>${a.phase === 'curto' ? 'Quick Win' : a.phase === 'medio' ? 'Medio' : 'Longo'}</td>
      <td>${a.semana_label || '-'}</td>
      <td>${a.tarefa}</td>
      <td>${a.responsavel || '-'}</td>
      <td>${a.due_date || '-'}</td>
      <td><span class="badge ${a.status}">${a.status === 'done' ? 'Concluido' : a.status === 'progress' ? 'Em Andamento' : 'Pendente'}</span></td>
    </tr>`).join('')}
  </table>
</div>` : ''}

${scenarioHtml}

${annotationsHtml}

${reportType === 'final' ? `<div class="section">
  <h2>10. Analise Comparativa — Antes vs Depois <span class="phase-badge phase-longo">Relatorio Final</span></h2>
  <div class="alert-box alert-info">
    <strong>Este relatorio final compara o estado do municipio no inicio da consultoria com o estado atual.</strong><br>
    <span style="font-size:12px">Os ganhos efetivos serao realizados a partir do exercicio FUNDEB 2027, com base nas matriculas registradas no Censo 2026.</span>
  </div>
  <table>
    <tr><th>Indicador</th><th>Inicio da Consultoria</th><th>Situacao Atual</th><th>Variacao</th></tr>
    <tr>
      <td><strong>Receita FUNDEB</strong></td>
      <td>${fmt(receitaTotal)}</td>
      <td>${fmt(receitaTotal + potTotal)}</td>
      <td style="color:#00A878;font-weight:700">+${fmt(potTotal)}</td>
    </tr>
    <tr>
      <td><strong>Categorias Ativas</strong></td>
      <td>${enrollments.filter((e: Record<string, unknown>) => e.ativa).length} de ${enrollments.length}</td>
      <td>${enrollments.length} (meta)</td>
      <td>+${nFaltantes} categorias</td>
    </tr>
    <tr>
      <td><strong>Compliance</strong></td>
      <td>0%</td>
      <td>${compPct}%</td>
      <td style="color:#00A878">+${compPct}%</td>
    </tr>
    <tr>
      <td><strong>Plano de Acao</strong></td>
      <td>0%</td>
      <td>${apPct}%</td>
      <td style="color:#00A878">+${apPct}%</td>
    </tr>
  </table>
</div>

<div class="section">
  <h2>11. Oportunidades Nao Capturadas</h2>
  <p style="font-size:13px;color:#666;margin-bottom:15px">Itens identificados durante a consultoria que nao foram executados ate o fechamento. Representam potencial ainda disponivel para captura futura.</p>
  ${compliance.filter((c: Record<string, unknown>) => c.status !== 'done').length > 0 ? `<table>
    <tr><th>Item</th><th>Secao</th><th>Status</th></tr>
    ${compliance.filter((c: Record<string, unknown>) => c.status !== 'done').map((c: Record<string, unknown>) => `<tr>
      <td>${c.item_text}</td>
      <td>${c.section_name || c.section}</td>
      <td><span class="badge pending">Pendente</span></td>
    </tr>`).join('')}
  </table>` : '<p style="color:#00A878;font-weight:600">Todos os itens de compliance foram concluidos.</p>'}
</div>

<div class="section">
  <h2>12. Projecao 2027-2030 <span class="phase-badge phase-longo">Longo Prazo</span></h2>
  <p style="font-size:13px;color:#666;margin-bottom:15px">Projecao de ganhos FUNDEB com base nas otimizacoes implementadas e expansao de escola integral (EC 135 — 4%/ano).</p>
  <table>
    <tr><th>Ano</th><th>Receita Base</th><th>Ganho T1-T4</th><th>Ganho T5 (VAAR/VAAT)</th><th>Ganho T6 (EC 135)</th><th>Total Projetado</th></tr>
    ${[2027, 2028, 2029, 2030].map((ano, i) => {
      const t14 = t1 + t2 + t3 + t4;
      const t6Growth = t6 * (1 + (i * 0.04)); // 4% growth per year
      const projected = receitaTotal + t14 + t5 + t6Growth;
      return `<tr>
        <td><strong>${ano}</strong></td>
        <td>${fmt(receitaTotal)}</td>
        <td style="color:#00A878">${fmt(t14)}</td>
        <td style="color:#3b82f6">${fmt(t5)}</td>
        <td style="color:#06b6d4">${fmt(t6Growth)}</td>
        <td style="font-weight:700;color:#0A2463">${fmt(projected)}</td>
      </tr>`;
    }).join('')}
  </table>
</div>` : ''}

<div class="signatures">
  <div class="sig-block">
    <div class="line">${signatureConsultant}</div>
    <div class="role">Consultor i10</div>
  </div>
  <div class="sig-block">
    <div class="line">${signatureSecretary}</div>
    <div class="role">Secretario(a) Municipal / Gestor(a)</div>
  </div>
</div>

<div class="footer">
  <p>Relatorio gerado automaticamente pela Plataforma FUNDEB - Instituto i10</p>
  <p>Dados extraidos do FNDE, Censo Escolar/INEP, SICONFI e sistemas municipais | ${hoje}</p>
  <p style="margin-top:5px;font-size:10px">Este documento possui carater consultivo. Valores sujeitos a atualizacao conforme publicacoes oficiais do FNDE.</p>
</div>
</body>
</html>`;

  // Save to DB
  try {
    const metadata = {
      generated: hoje,
      consultoriaId: consultoriaIdParam ? parseInt(consultoriaIdParam) : null,
      consultantName: consultantName || null,
      secretaryName: secretaryName || null,
    };
    const titulo = reportType === 'final' ? `Relatorio Final FUNDEB - ${nome}` : `Relatorio Inicial FUNDEB - ${nome}`;
    await sql`INSERT INTO fundeb.relatorios (municipality_id, consultoria_id, tipo, titulo, html_content, metadata)
      VALUES (${parseInt(muniId)}, ${consultoriaIdParam ? parseInt(consultoriaIdParam) : null}, ${reportType}, ${titulo}, ${html}, ${JSON.stringify(metadata)}::jsonb)`;
  } catch { /* table may not exist */ }

  // Return based on accept header
  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/html')) {
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  return Response.json({ html, municipio: nome, generated: hoje });
}
