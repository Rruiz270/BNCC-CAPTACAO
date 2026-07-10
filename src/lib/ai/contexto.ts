/**
 * Montagem de contexto do município para as features de IA.
 *
 * Server-only: consulta o Neon diretamente e devolve (a) um objeto
 * estruturado e (b) a serialização compacta usada nos prompts. Toda rota
 * /api/ai/* passa por aqui para que resumo, plano, chat e documentos
 * enxerguem exatamente os mesmos dados.
 */
import { neon } from '@neondatabase/serverless';
import { calculateGain, type GainResult, type MunicipalityInput } from '@/lib/fundeb/gain';
import { glossarioParaPrompt } from '@/lib/fundeb/glossario';
import { janelasAtivas, formatDataBR } from '@/lib/fundeb/prazos';

const sql = neon(process.env.DATABASE_URL!);

export interface ContextoMunicipio {
  municipality: Record<string, unknown>;
  gain: GainResult;
  compliance: Array<{ section: string; sectionName: string | null; total: number; done: number; pendentes: string[] }>;
  planoResumo: { curto: { total: number; done: number }; medio: { total: number; done: number }; longo: { total: number; done: number } };
  enrollmentsAtivas: Array<{ categoria: string; label: string | null; quantidade: number }>;
  categoriasFaltantes: string[];
}

export async function montarContextoMunicipio(idOrIbge: string | number): Promise<ContextoMunicipio | null> {
  const key = String(idOrIbge);
  const rows =
    /^\d{7}$/.test(key)
      ? await sql`SELECT * FROM fundeb.municipalities WHERE codigo_ibge = ${key}`
      : await sql`SELECT * FROM fundeb.municipalities WHERE id = ${parseInt(key) || 0}`;
  const m = rows[0];
  if (!m) return null;

  const [estado] = m.uf
    ? await sql`SELECT vaar_medio, vaat_medio, vaaf_medio FROM fundeb.estados WHERE uf = ${m.uf}`
    : [null];

  const compliance = await sql`
    SELECT section, section_name,
           COUNT(*)::int AS total,
           SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END)::int AS done,
           COALESCE(json_agg(item_text) FILTER (WHERE status <> 'done'), '[]'::json) AS pendentes
    FROM fundeb.compliance_items
    WHERE municipality_id = ${m.id}
    GROUP BY section, section_name
    ORDER BY section`;

  const plano = await sql`
    SELECT phase, COUNT(*)::int AS total,
           SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END)::int AS done
    FROM fundeb.action_plans
    WHERE municipality_id = ${m.id}
    GROUP BY phase`;

  const enrollments = await sql`
    SELECT categoria, categoria_label, quantidade, ativa
    FROM fundeb.enrollments
    WHERE municipality_id = ${m.id}
    ORDER BY quantidade DESC NULLS LAST`;

  const secaoA = compliance.find((c) => c.section === 'A');

  const muniInput: MunicipalityInput = {
    id: m.id as number,
    nome: m.nome as string,
    totalMatriculas: m.total_matriculas as number | null,
    receitaTotal: m.receita_total as number | null,
    vaat: m.vaat as number | null,
    vaar: m.vaar as number | null,
    potTotal: m.pot_total as number | null,
    idebAi: m.ideb_ai as number | null,
    idebAf: m.ideb_af as number | null,
    escolasRurais: m.escolas_rurais as number | null,
    eiMat: m.ei_mat as number | null,
    efMat: m.ef_mat as number | null,
    complianceASectionDone: (secaoA?.done as number) ?? null,
    complianceASectionTotal: (secaoA?.total as number) ?? null,
    vaarMedioUf: (estado?.vaar_medio as number) ?? null,
  };

  const gain = calculateGain(muniInput);

  const planoResumo = { curto: { total: 0, done: 0 }, medio: { total: 0, done: 0 }, longo: { total: 0, done: 0 } };
  for (const p of plano) {
    const fase = p.phase as 'curto' | 'medio' | 'longo';
    if (planoResumo[fase]) planoResumo[fase] = { total: p.total as number, done: p.done as number };
  }

  return {
    municipality: m,
    gain,
    compliance: compliance.map((c) => ({
      section: c.section as string,
      sectionName: c.section_name as string | null,
      total: c.total as number,
      done: c.done as number,
      pendentes: (c.pendentes as string[]) ?? [],
    })),
    planoResumo,
    enrollmentsAtivas: enrollments
      .filter((e) => e.ativa && (e.quantidade as number) > 0)
      .map((e) => ({ categoria: e.categoria as string, label: e.categoria_label as string | null, quantidade: e.quantidade as number })),
    categoriasFaltantes: enrollments
      .filter((e) => !e.ativa || !(e.quantidade as number))
      .map((e) => (e.categoria_label as string) ?? (e.categoria as string)),
  };
}

const brl = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v)
    ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
    : '—';

/** Serialização compacta do contexto para os prompts. */
export function contextoParaPrompt(ctx: ContextoMunicipio): string {
  const m = ctx.municipality;
  const g = ctx.gain;
  const linhas: string[] = [
    `## Município: ${m.nome} (${m.uf ?? 'UF?'}) — IBGE ${m.codigo_ibge ?? '?'}`,
    `População: ${m.populacao ?? '?'} · Matrículas municipais: ${m.total_matriculas ?? '?'} · Escolas: ${m.total_escolas ?? '?'} (${m.escolas_rurais ?? 0} rurais)`,
    `Receita FUNDEB atual: ${brl(m.receita_total)} · VAAT: ${brl(m.vaat)} · VAAR recebido: ${brl(m.vaar)}`,
    `IDEB Anos Iniciais: ${m.ideb_ai ?? '?'} · Anos Finais: ${m.ideb_af ?? '?'} · NSE: ${m.nse ?? '?'}`,
    '',
    `## Potencial de captação (engine calculateGain)`,
    `Ganho garantido (só cadastro): ${brl(g.ganhoGarantido)}`,
    `Potencial a destravar (VAAR): ${brl(g.potencialDestravar)} · Elegível VAAR hoje: ${g.vaar.elegivel ? 'SIM' : 'NÃO'} (compliance ${(g.vaar.complianceScore * 100).toFixed(0)}%, IDEB score ${(g.vaar.idebScore * 100).toFixed(0)}%)`,
    `Breakdown T1-T6: T1 reclassificação ${brl(m.pot_t1)} · T2 integral ${brl(m.pot_t2)} · T3 AEE ${brl(m.pot_t3)} · T4 localidade ${brl(m.pot_t4)} · T5 VAAR ${brl(m.pot_t5_vaar)} · T6 EC135 ${brl(m.pot_t6)}`,
    `Alunos em tempo integral: ~${g.peti.alunosIntegralAtual} (${m.t6_pct_integral ?? '?'}% da rede)`,
  ];

  if (ctx.categoriasFaltantes.length) {
    linhas.push('', `## Categorias FUNDEB sem matrícula declarada (${ctx.categoriasFaltantes.length})`, ctx.categoriasFaltantes.slice(0, 16).join('; '));
  }

  linhas.push('', '## Compliance (seções A-E)');
  for (const c of ctx.compliance) {
    linhas.push(`- Seção ${c.section} (${c.sectionName ?? ''}): ${c.done}/${c.total} concluídos${c.pendentes.length ? ` · pendentes: ${c.pendentes.slice(0, 6).join('; ')}` : ''}`);
  }

  const pr = ctx.planoResumo;
  linhas.push(
    '',
    `## Plano de ação`,
    `Curto prazo: ${pr.curto.done}/${pr.curto.total} · Médio: ${pr.medio.done}/${pr.medio.total} · Longo: ${pr.longo.done}/${pr.longo.total}`,
  );

  linhas.push('', '## Janelas regulatórias (hoje é ' + new Date().toLocaleDateString('pt-BR') + ')');
  for (const j of janelasAtivas()) {
    linhas.push(`- ${formatDataBR(j.data)} (${j.diasRestantes} dias): ${j.titulo} — em jogo: ${j.emJogo}`);
  }

  return linhas.join('\n');
}

/** Persona + base de conhecimento comum a todas as features de IA. */
export function systemPromptBase(): string {
  return `Você é o assistente de consultoria FUNDEB do Instituto i10 (plataforma BNCC-Captação).
Seu público são consultores i10 e gestores municipais de educação no Brasil. Responda sempre em português do Brasil, com números em formato brasileiro (R$ 1.234,56).

Princípios:
- Seja concreto e acionável: cada recomendação diz O QUE fazer, QUEM faz, ATÉ QUANDO e QUANTO vale em R$.
- Diferencie sempre "ganho garantido" (depende só de cadastro correto no Censo/sistemas) de "potencial a destravar" (VAAR, exige cumprir condicionalidades).
- Priorize pelo par (valor em R$, proximidade do prazo). Quick wins de cadastro vêm antes de políticas estruturais.
- Nunca invente números: use apenas os dados fornecidos no contexto. Se um dado faltar, diga que falta e como obtê-lo.
- Linguagem de gestor público, sem jargão sem explicação — na primeira menção de uma sigla, explique em meia linha.

Metodologia LEAN i10×APM (esteira padrão de consultoria, 6 fases):
1. Diagnóstico (semana 1) — dados públicos + intake da secretaria; 2. Aprovação do plano (semana 2);
3-4. Execução dos quick wins de cadastro (AEE, localidade, reclassificação, integral);
5. Verificação e ajustes; 6. Travamento — conferência final antes da janela regulatória.

Glossário FUNDEB (base legal incluída):
${glossarioParaPrompt()}`;
}
