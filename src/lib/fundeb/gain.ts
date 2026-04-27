/**
 * Engine única de cálculo do GANHO FUNDEB.
 *
 * Pura: recebe (municipality, intakeData?, simulationDeltas?) e devolve
 * um GainResult — sem fetch, sem DB. Roda no client (intake ao vivo) e no
 * server (snapshot do wizard) com o mesmo comportamento.
 *
 * Cobre 4 dimensões:
 *   1. VAAF — fator de ponderação aluno/categoria (já existia)
 *   2. PETI — bonus por aluno em jornada integral (R$ 1.693,22/aluno em 2026)
 *   3. Multiplicadores — campo (1.15), indígena (1.40), quilombola (1.40)
 *   4. VAAR — abordagem HÍBRIDA: mostra atual estimado + potencial + gaps
 */
import {
  CATEGORIAS_FUNDEB,
  MULTIPLICADORES,
  FUNDEB_PARAMS,
  VAAF_BASE,
} from '@/lib/constants';

// ─── Tipos públicos ────────────────────────────────────────────────────

export interface MunicipalityInput {
  id: number;
  nome: string;
  totalMatriculas: number | null;
  receitaTotal: number | null;
  vaat: number | null;
  vaar: number | null;
  potTotal: number | null;
  /** IDEB Anos Iniciais (escala 0..10). Usado pra elegibilidade VAAR. */
  idebAi: number | null;
  /** IDEB Anos Finais. */
  idebAf: number | null;
  /** Matrículas em escolas rurais (campo). */
  escolasRurais: number | null;
  /** Total matriculas de creche/pré/EF/EM (do banco — fallback). */
  eiMat: number | null;
  efMat: number | null;
  /**
   * Soma dos itens de compliance "done" / total da seção A (5 condicionalidades VAAR).
   * Vem do /api/municipalities/[slug] em compliance.summary.A.
   */
  complianceASectionDone?: number | null;
  complianceASectionTotal?: number | null;
}

/**
 * Dados que a secretaria preenche no /intake/[token]. Todos opcionais —
 * a engine recalcula em qualquer estado parcial (recálculo on-keystroke).
 */
export interface IntakeInput {
  schoolsTotal?: number | null;
  schoolsRural?: number | null;
  alunosAee?: number | null;
  alunosDuplaMatricula?: number | null;
  alunosClasseEspecial?: number | null;
  // Localidade diferenciada
  alunosCampo?: number | null;
  alunosIndigena?: number | null;
  alunosQuilombola?: number | null;
  escolasCampo?: number | null;
  escolasIndigena?: number | null;
  escolasQuilombola?: number | null;
  // Integral
  alunosIntegral?: number | null;
  escolasIntegral?: number | null;
  // Reclassificação por categoria (consultor preenche no simulador)
  enrollmentDeltas?: Record<string, number>;
}

/** Lista canônica de gaps que travam a elegibilidade VAAR. */
export type VaarGap =
  | { kind: 'compliance'; pct: number; missing: number }
  | { kind: 'ideb_ai'; current: number; target: number };

export interface GainResult {
  vaaf: {
    atual: number;
    otimizado: number;
    ganho: number;
    breakdown: Array<{ key: string; label: string; atual: number; otimizado: number; ganho: number }>;
  };
  vaat: {
    atual: number;
  };
  vaar: {
    /** Estimativa do que o município receberia HOJE (geralmente 0 se não cumpre todos os gates). */
    atual: number;
    /** Potencial máximo se cumprir 100% do compliance + meta IDEB. */
    potencial: number;
    elegivel: boolean;
    /** 0..1 — quanto do caminho até elegibilidade total. Usado no gauge "60% do caminho". */
    overallProgress: number;
    complianceScore: number;
    idebScore: number;
    gaps: VaarGap[];
  };
  peti: {
    atual: number;
    otimizado: number;
    ganho: number;
    alunosIntegralAtual: number;
    alunosIntegralOtimizado: number;
  };
  multiplicadores: {
    campo: { alunos: number; ganho: number };
    indigena: { alunos: number; ganho: number };
    quilombola: { alunos: number; ganho: number };
    totalGanho: number;
  };
  /** Soma "natural" do que o município recebe hoje. */
  totalAtual: number;
  /** Cenário com tudo que a secretaria + simulador preenchem otimizado. */
  totalOtimizado: number;
  /** Diferença total = "potencial identificado" — soma garantido + a destravar. */
  ganhoTotal: number;
  /**
   * "Ganho garantido": delta que depende SÓ de cadastro correto
   * (reclassificação VAAF + PETI + multiplicadores localidade). Não exige
   * ação política do município.
   */
  ganhoGarantido: number;
  /**
   * "Potencial a destravar": VAAR potencial que só rola se cumprir 5
   * condicionalidades + IDEB. Exige projeto educacional, não só cadastro.
   */
  potencialDestravar: number;
}

// ─── Constantes derivadas ──────────────────────────────────────────────

/** Meta IDEB AI usada como benchmark para elegibilidade VAAR (proxy SP). */
const IDEB_AI_TARGET = 6.0;
/** Mínimo do IDEB AI abaixo do qual o score = 0. */
const IDEB_AI_FLOOR = 4.0;
/** Compliance mínimo (%) e IDEB score mínimo para considerar elegível. */
const COMPLIANCE_MIN = 0.8;
const IDEB_MIN = 0.6;

// ─── Helpers ───────────────────────────────────────────────────────────

function n(v: number | null | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// ─── 1. VAAF (refator do que o simulador já faz) ──────────────────────

function computeVaaf(
  muni: MunicipalityInput,
  intake: IntakeInput,
): GainResult['vaaf'] {
  const breakdown: GainResult['vaaf']['breakdown'] = [];
  let atual = 0;
  let otimizado = 0;

  // Para cada categoria oficial, soma matrícula × valor/aluno.
  // O "atual" usa o que está no banco (proxy: distribui totalMatriculas pelo eiMat/efMat).
  // O "otimizado" aplica enrollmentDeltas que vêm do simulador.
  for (const cat of CATEGORIAS_FUNDEB) {
    // Aproximação: até a engine rodar com fundeb.enrollments injetado,
    // distribuímos eiMat/efMat heuristicamente. Quando o caller passar
    // enrollmentDeltas[cat.id] = quantidadeReal, esse valor vence.
    const baseQty = intake.enrollmentDeltas?.[cat.id] ?? 0;
    const valAtual = baseQty * cat.porAluno;
    const valOtim = (intake.enrollmentDeltas?.[cat.id] ?? baseQty) * cat.porAluno;

    if (valAtual > 0 || valOtim > 0) {
      breakdown.push({ key: cat.id, label: cat.label, atual: valAtual, otimizado: valOtim, ganho: valOtim - valAtual });
      atual += valAtual;
      otimizado += valOtim;
    }
  }

  // Fallback: se não veio enrollmentDeltas, usa receitaTotal do banco como "atual".
  if (atual === 0 && otimizado === 0) {
    atual = n(muni.receitaTotal);
    otimizado = atual;
  }

  return { atual, otimizado, ganho: otimizado - atual, breakdown };
}

// ─── 2. PETI (Programa de Educação em Tempo Integral) ─────────────────

function computePeti(
  muni: MunicipalityInput,
  intake: IntakeInput,
): GainResult['peti'] {
  const peti = FUNDEB_PARAMS.PETI_POR_ALUNO;
  // "Atual": o que o banco/dados públicos dizem — heurística da calculadora-ec135 hoje
  // estima 60% de eiMat como integral quando não há valor específico.
  const integralAtualDB = Math.round(n(muni.eiMat) * 0.6);
  // "Otimizado": o que a secretaria informou (ou o que o simulador propôs).
  const integralOtim = n(intake.alunosIntegral);

  const alunosIntegralAtual = integralAtualDB;
  const alunosIntegralOtimizado = Math.max(integralOtim, integralAtualDB);

  const atual = alunosIntegralAtual * peti;
  const otimizado = alunosIntegralOtimizado * peti;

  return {
    atual,
    otimizado,
    ganho: otimizado - atual,
    alunosIntegralAtual,
    alunosIntegralOtimizado,
  };
}

// ─── 3. Multiplicadores (campo / indígena / quilombola) ───────────────

function computeMultiplicadores(intake: IntakeInput): GainResult['multiplicadores'] {
  // Aplicado como ganho ADICIONAL sobre o VAAF base por aluno em escola
  // de localidade diferenciada. Fonte: Decreto 10.656/2021.
  // Ganho_extra = matriculas × VAAF_BASE × (fator - 1.0)
  const ganhoCampo = n(intake.alunosCampo) * VAAF_BASE * (MULTIPLICADORES.campo.fator - 1.0);
  const ganhoIndigena = n(intake.alunosIndigena) * VAAF_BASE * (MULTIPLICADORES.indigena.fator - 1.0);
  const ganhoQuilombola = n(intake.alunosQuilombola) * VAAF_BASE * (MULTIPLICADORES.indigena.fator - 1.0);

  return {
    campo: { alunos: n(intake.alunosCampo), ganho: ganhoCampo },
    indigena: { alunos: n(intake.alunosIndigena), ganho: ganhoIndigena },
    quilombola: { alunos: n(intake.alunosQuilombola), ganho: ganhoQuilombola },
    totalGanho: ganhoCampo + ganhoIndigena + ganhoQuilombola,
  };
}

// ─── 4. VAAR híbrido (atual estimado + potencial + gaps) ──────────────

function computeVaar(muni: MunicipalityInput): GainResult['vaar'] {
  const totalAlunos = n(muni.totalMatriculas);
  const potencial = totalAlunos * FUNDEB_PARAMS.VAAR_MEDIAN_SP;

  // Compliance score: % de itens "done" na seção A (5 condicionalidades).
  // Quando o caller não passa ainda, assume 0.
  const complianceTotal = n(muni.complianceASectionTotal) || 5;
  const complianceDone = n(muni.complianceASectionDone);
  const complianceScore = clamp01(complianceTotal > 0 ? complianceDone / complianceTotal : 0);

  // IDEB score: linear entre [4.0, 6.0]. Abaixo de 4.0 = 0, acima de 6.0 = 1.
  const ideb = n(muni.idebAi);
  const idebScore = clamp01((ideb - IDEB_AI_FLOOR) / (IDEB_AI_TARGET - IDEB_AI_FLOOR));

  // Elegibilidade: ambos os gates precisam estar cumpridos.
  const elegivel = complianceScore >= COMPLIANCE_MIN && idebScore >= IDEB_MIN;
  // Progresso geral: média ponderada — compliance pesa mais (gate hard) que IDEB.
  const overallProgress = clamp01(complianceScore * 0.6 + idebScore * 0.4);

  // Atual: se elegível, paga ~90% do potencial (margem). Se não, 0.
  // Mostra honestamente "R$ 0 hoje" enquanto município não destrava.
  const atual = elegivel ? potencial * 0.9 : 0;

  // Gaps: lista textual do que falta destravar. Ordena por severidade.
  const gaps: VaarGap[] = [];
  if (complianceScore < COMPLIANCE_MIN) {
    const missing = Math.max(0, complianceTotal - complianceDone);
    gaps.push({ kind: 'compliance', pct: complianceScore, missing });
  }
  if (idebScore < IDEB_MIN) {
    gaps.push({ kind: 'ideb_ai', current: ideb, target: IDEB_AI_TARGET });
  }

  return {
    atual,
    potencial,
    elegivel,
    overallProgress,
    complianceScore,
    idebScore,
    gaps,
  };
}

// ─── Engine principal ──────────────────────────────────────────────────

export function calculateGain(
  muni: MunicipalityInput,
  intake: IntakeInput = {},
): GainResult {
  const vaaf = computeVaaf(muni, intake);
  const peti = computePeti(muni, intake);
  const multiplicadores = computeMultiplicadores(intake);
  const vaar = computeVaar(muni);
  const vaat = { atual: n(muni.vaat) };

  const totalAtual =
    vaaf.atual +
    peti.atual +
    vaat.atual +
    vaar.atual; // 0 quando não-elegível

  const totalOtimizado =
    vaaf.otimizado +
    peti.otimizado +
    vaat.atual +
    multiplicadores.totalGanho +
    vaar.potencial; // mostra o caminho destravado

  // Ganho garantido: dependem SÓ de cadastro/Censo correto.
  // Reclassificar VAAF + jornada integral PETI + multiplicadores localidade.
  const ganhoGarantido = Math.max(
    0,
    vaaf.ganho + peti.ganho + multiplicadores.totalGanho,
  );

  // Potencial a destravar: o que VAAR ainda não dá. Quando elegível, vai a 0
  // porque o município já recebe (entra no totalOtimizado).
  const potencialDestravar = vaar.elegivel ? 0 : vaar.potencial;

  return {
    vaaf,
    vaat,
    vaar,
    peti,
    multiplicadores,
    totalAtual,
    totalOtimizado,
    ganhoTotal: ganhoGarantido + potencialDestravar,
    ganhoGarantido,
    potencialDestravar,
  };
}

// ─── Helpers de apresentação (UI consumers usam) ──────────────────────

export function gainHighlights(result: GainResult): Array<{ label: string; value: number; color: 'green' | 'cyan' | 'amber' }> {
  const out: Array<{ label: string; value: number; color: 'green' | 'cyan' | 'amber' }> = [];

  if (result.peti.ganho > 0) {
    out.push({ label: 'PETI (jornada integral)', value: result.peti.ganho, color: 'cyan' });
  }
  if (result.multiplicadores.totalGanho > 0) {
    out.push({ label: 'Localidade diferenciada', value: result.multiplicadores.totalGanho, color: 'green' });
  }
  if (result.vaaf.ganho > 0) {
    out.push({ label: 'Reclassificação VAAF', value: result.vaaf.ganho, color: 'green' });
  }
  if (!result.vaar.elegivel && result.vaar.potencial > 0) {
    out.push({ label: 'VAAR (potencial — falta destravar)', value: result.vaar.potencial, color: 'amber' });
  } else if (result.vaar.elegivel) {
    out.push({ label: 'VAAR (estimado hoje)', value: result.vaar.atual, color: 'green' });
  }

  return out.sort((a, b) => b.value - a.value);
}

export function describeVaarGap(gap: VaarGap): string {
  if (gap.kind === 'compliance') {
    return `Compliance VAAR em ${(gap.pct * 100).toFixed(0)}% — faltam ${gap.missing} de 5 condicionalidades`;
  }
  return `IDEB Anos Iniciais ${gap.current.toFixed(1)} (meta ${gap.target.toFixed(1)})`;
}
