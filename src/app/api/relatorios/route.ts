import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const DATABASE_URL = process.env.DATABASE_URL!;

const fmt = (v: number | null) => {
  if (v == null) return 'R$ 0';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

// GET /api/relatorios?municipalityId=X - generate HTML report
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const muniId = searchParams.get('municipalityId');

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
    SELECT phase, semana_label, tarefa, status, due_date
    FROM fundeb.action_plans WHERE municipality_id = ${parseInt(muniId)} ORDER BY phase, semana
  `;

  let censusData: Record<string, unknown> | null = null;
  try {
    const census = await sql`SELECT raw_data FROM fundeb.census_data WHERE municipality_id = ${parseInt(muniId)} LIMIT 1`;
    censusData = census.length > 0 ? census[0].raw_data as Record<string, unknown> : null;
  } catch { /* table may not exist */ }

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
  const t5 = ((m.pot_t5_vaar as number) || 0) + ((m.pot_t5_vaat as number) || 0);
  const t6 = (m.pot_t6 as number) || 0;

  const hoje = new Date().toLocaleDateString('pt-BR');

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
  .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 11px; }
  @media print { body { padding: 20px; } .section { page-break-inside: avoid; } }
</style>
</head>
<body>
<div class="header">
  <div class="brand">Instituto i10 - Plataforma FUNDEB</div>
  <h1>Relatorio de Consultoria FUNDEB</h1>
  <h2 style="color:#00B4D8; font-size:24px; margin-top:10px;">${nome}</h2>
  <div class="subtitle">Gerado em ${hoje} | Exercicio 2026 | Estado de Sao Paulo</div>
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

<div class="section">
  <h2>2. Potencial por Tier (T1-T6)</h2>
  ${[
    { label: 'T1 - Categorias Zeradas', val: t1, color: '#ef4444' },
    { label: 'T2 - Reclassificacao Integral', val: t2, color: '#f59e0b' },
    { label: 'T3 - AEE/Ed. Especial', val: t3, color: '#8b5cf6' },
    { label: 'T4 - Campo/Indigena', val: t4, color: '#22c55e' },
    { label: 'T5 - VAAR/VAAT', val: t5, color: '#3b82f6' },
    { label: 'T6 - EC 135 Integral', val: t6, color: '#06b6d4' },
  ].map(t => {
    const maxVal = Math.max(t1, t2, t3, t4, t5, t6, 1);
    const pctW = Math.max((t.val / maxVal) * 100, 2);
    return `<div class="tier-bar">
      <div class="label" style="color:${t.color}">${t.label}</div>
      <div class="bar"><div class="fill" style="width:${pctW}%;background:${t.color}"></div></div>
      <div class="val" style="color:${t.color}">${fmt(t.val)}</div>
    </div>`;
  }).join('')}
  ${(m.cats_faltantes as string) ? `<div style="margin-top:10px;padding:10px;background:#fff3cd;border-radius:6px;font-size:12px"><strong>Categorias nao captadas:</strong> ${m.cats_faltantes}</div>` : ''}
</div>

<div class="section">
  <h2>3. Evolucao Historica</h2>
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
  <h2>4. Matriculas por Categoria FUNDEB</h2>
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
  <h2>5. Status de Compliance</h2>
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
  <h2>6. Plano de Acao</h2>
  <table>
    <tr><th>Fase</th><th>Semana</th><th>Tarefa</th><th>Prazo</th><th>Status</th></tr>
    ${actionPlans.map((a: Record<string, unknown>) => `<tr>
      <td>${a.phase === 'curto' ? 'Quick Win' : a.phase === 'medio' ? 'Medio' : 'Longo'}</td>
      <td>${a.semana_label || '-'}</td>
      <td>${a.tarefa}</td>
      <td>${a.due_date || '-'}</td>
      <td><span class="badge ${a.status}">${a.status === 'done' ? 'Concluido' : a.status === 'progress' ? 'Em Andamento' : 'Pendente'}</span></td>
    </tr>`).join('')}
  </table>
</div>` : ''}

<div class="footer">
  <p>Relatorio gerado automaticamente pela Plataforma FUNDEB - Instituto i10</p>
  <p>Dados extraidos do FNDE, Censo Escolar/INEP, SICONFI e sistemas municipais | ${hoje}</p>
</div>
</body>
</html>`;

  // Save to DB
  try {
    await sql`INSERT INTO fundeb.relatorios (municipality_id, tipo, titulo, html_content, metadata)
      VALUES (${parseInt(muniId)}, 'completo', ${'Relatorio FUNDEB - ' + nome}, ${html}, ${JSON.stringify({ generated: hoje })}::jsonb)`;
  } catch { /* table may not exist */ }

  // Return based on accept header
  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/html')) {
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  return Response.json({ html, municipio: nome, generated: hoje });
}
