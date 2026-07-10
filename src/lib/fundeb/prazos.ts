/**
 * Calendário dinâmico de janelas FUNDEB.
 *
 * Substitui o countdown fixo do Censo 27/mai/2026 (que já passou) por uma
 * lista de janelas com data, o que está em jogo e severidade calculada em
 * função de "hoje". Puro — roda no client e no server.
 */

export interface JanelaFundeb {
  key: string;
  data: string; // ISO yyyy-mm-dd
  titulo: string;
  descricao: string;
  /** O que o município perde se estourar a janela. */
  emJogo: string;
  /** Seções de compliance relacionadas (A-E). */
  secoes: string[];
}

/** Janelas regulatórias conhecidas. Ordem cronológica. */
export const JANELAS_FUNDEB: JanelaFundeb[] = [
  {
    key: 'condicionalidades_2026',
    data: '2026-08-31',
    titulo: 'Condicionalidades VAAR + SIMEC',
    descricao:
      'Prazo final para comprovar as 5 condicionalidades do VAAR (incluindo BNCC Computação) e registrar tudo no SIMEC com PAR atualizado.',
    emJogo: 'Complementação VAAR do exercício seguinte — em média R$ 710/aluno/ano em SP.',
    secoes: ['A', 'B', 'D'],
  },
  {
    key: 'ec135_2026',
    data: '2026-12-31',
    titulo: 'Plano de Expansão Integral (EC 135)',
    descricao:
      'Aprovação do plano municipal de expansão de vagas em tempo integral, com meta de 4% de novas vagas/ano.',
    emJogo: 'Conformidade com a EC 135 + captação PETI (R$ 1.693/aluno integral).',
    secoes: ['E'],
  },
  {
    key: 'censo_2027',
    data: '2027-05-26',
    titulo: 'Dia do Censo Escolar 2027',
    descricao:
      'Última quarta-feira de maio: fotografia oficial das matrículas que define TODO o FUNDEB de 2028. Reclassificações de cadastro precisam estar no Educacenso até esta data.',
    emJogo: 'Ganho garantido de cadastro (reclassificação, AEE, localidade, integral) do ciclo 2028.',
    secoes: ['C'],
  },
  {
    key: 'condicionalidades_2027',
    data: '2027-08-31',
    titulo: 'Condicionalidades VAAR 2027',
    descricao: 'Ciclo anual seguinte de comprovação das condicionalidades no SIMEC.',
    emJogo: 'Complementação VAAR do ciclo 2028.',
    secoes: ['A', 'B', 'D'],
  },
];

export type SeveridadePrazo = 'vencido' | 'critico' | 'atencao' | 'ok';

export interface JanelaComStatus extends JanelaFundeb {
  diasRestantes: number;
  severidade: SeveridadePrazo;
}

function diffDias(iso: string, hoje: Date): number {
  const alvo = new Date(`${iso}T23:59:59-03:00`);
  return Math.ceil((alvo.getTime() - hoje.getTime()) / 86_400_000);
}

export function severidade(diasRestantes: number): SeveridadePrazo {
  if (diasRestantes < 0) return 'vencido';
  if (diasRestantes <= 60) return 'critico';
  if (diasRestantes <= 180) return 'atencao';
  return 'ok';
}

/** Janelas futuras (e as vencidas há menos de 30 dias, para contexto), com countdown. */
export function janelasAtivas(hoje: Date = new Date()): JanelaComStatus[] {
  return JANELAS_FUNDEB.map((j) => {
    const diasRestantes = diffDias(j.data, hoje);
    return { ...j, diasRestantes, severidade: severidade(diasRestantes) };
  }).filter((j) => j.diasRestantes >= -30);
}

/** A janela mais urgente ainda aberta — o "relógio" do dashboard. */
export function proximaJanela(hoje: Date = new Date()): JanelaComStatus | null {
  return janelasAtivas(hoje).find((j) => j.diasRestantes >= 0) ?? null;
}

export function formatDataBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export const SEVERIDADE_COLORS: Record<SeveridadePrazo, string> = {
  vencido: '#6b7280',
  critico: '#ef4444',
  atencao: '#f59e0b',
  ok: '#22c55e',
};
