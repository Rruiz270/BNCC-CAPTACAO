/**
 * Glossário FUNDEB — cada termo técnico usado na UI com explicação curta
 * (2-3 linhas, linguagem de gestor municipal) e base legal de origem.
 *
 * Consumido pelo componente <TermoTooltip termo="vaaf" /> e pelo system
 * prompt do assistente IA. Manter as chaves em minúsculo sem acento.
 */

export interface TermoGlossario {
  sigla: string;
  nome: string;
  explicacao: string;
  baseLegal?: string;
}

export const GLOSSARIO: Record<string, TermoGlossario> = {
  fundeb: {
    sigla: 'FUNDEB',
    nome: 'Fundo de Manutenção e Desenvolvimento da Educação Básica',
    explicacao:
      'Principal fonte de financiamento da educação básica pública. Cada aluno matriculado e corretamente declarado no Censo Escolar gera repasse anual ao município. Tornou-se permanente em 2020.',
    baseLegal: 'EC 108/2020 · Lei 14.113/2020',
  },
  vaaf: {
    sigla: 'VAAF',
    nome: 'Valor Aluno/Ano Fundo',
    explicacao:
      'Valor que cada aluno gera dentro do fundo estadual, ponderado pela etapa e jornada (ex.: creche integral vale fator 1,55; EF anos iniciais parcial é a base 1,00). Matrícula mal classificada no Censo = dinheiro perdido.',
    baseLegal: 'Lei 14.113/2020, art. 7º · Ponderações FNDE 2026',
  },
  vaat: {
    sigla: 'VAAT',
    nome: 'Valor Aluno/Ano Total',
    explicacao:
      'Complementação federal para redes cujo valor por aluno (considerando toda a receita educacional) fica abaixo do mínimo nacional. Beneficia municípios com menor capacidade fiscal — depende de dados corretos no SIOPE.',
    baseLegal: 'Lei 14.113/2020, art. 5º, II',
  },
  vaar: {
    sigla: 'VAAR',
    nome: 'Valor Aluno/Ano Resultado',
    explicacao:
      'Complementação federal (R$ 7,5 bi/ano) paga às redes que cumprem 5 condicionalidades de gestão e melhoram indicadores de aprendizagem. A maioria dos municípios não recebe por descumprir requisitos formais — não por falta de qualidade.',
    baseLegal: 'Lei 14.113/2020, art. 5º, III e art. 14',
  },
  condicionalidades: {
    sigla: 'Condicionalidades VAAR',
    nome: '5 requisitos para receber o VAAR',
    explicacao:
      '1) Gestores escolares selecionados por mérito; 2) participação ≥80% no SAEB; 3) redução de desigualdades socioeconômicas; 4) regime de colaboração com o estado; 5) currículo alinhado à BNCC, incluindo Computação. Prazo de comprovação: 31/ago/2026.',
    baseLegal: 'Lei 14.113/2020, art. 14 · Res. CIF',
  },
  peti: {
    sigla: 'PETI',
    nome: 'Programa de Educação em Tempo Integral',
    explicacao:
      'Repasse federal adicional (R$ 1.693,22/aluno em 2026) por aluno em jornada integral. Somado ao fator 1,50x do FUNDEB, faz o aluno integral valer ~50% mais que o parcial.',
    baseLegal: 'Lei 14.640/2023',
  },
  nse: {
    sigla: 'NSE',
    nome: 'Nível Socioeconômico',
    explicacao:
      'Indicador que ajusta a distribuição do VAAR: redes com alunos de menor nível socioeconômico recebem ponderação maior. Não é acionável pelo município — mas explica diferenças de repasse entre vizinhos.',
    baseLegal: 'Lei 14.113/2020, art. 14, §1º',
  },
  fator_campo: {
    sigla: 'Fator Campo 1,15',
    nome: 'Multiplicador de educação do campo',
    explicacao:
      'Aluno matriculado em escola rural corretamente classificada vale 15% a mais no FUNDEB. Escola rural cadastrada como urbana no Censo perde esse adicional — erro comum e reversível.',
    baseLegal: 'Decreto 10.656/2021',
  },
  fator_indigena: {
    sigla: 'Fator Indígena/Quilombola 1,40',
    nome: 'Multiplicador de localidade diferenciada',
    explicacao:
      'Aluno em escola indígena ou quilombola vale 40% a mais. Depende apenas do campo "localização diferenciada" correto no Censo Escolar.',
    baseLegal: 'Decreto 10.656/2021',
  },
  aee: {
    sigla: 'AEE',
    nome: 'Atendimento Educacional Especializado',
    explicacao:
      'Aluno da educação especial que frequenta o AEE no contraturno conta DUAS vezes no FUNDEB (dupla matrícula, fator 1,40 cada). Se o AEE não é registrado no Censo, o município recebe só metade.',
    baseLegal: 'Lei 14.113/2020 · Decreto 7.611/2011',
  },
  ideb: {
    sigla: 'IDEB',
    nome: 'Índice de Desenvolvimento da Educação Básica',
    explicacao:
      'Combina aprovação escolar com desempenho no SAEB (escala 0–10). Usado como proxy de evolução de resultados na elegibilidade do VAAR.',
    baseLegal: 'INEP',
  },
  saeb: {
    sigla: 'SAEB',
    nome: 'Sistema de Avaliação da Educação Básica',
    explicacao:
      'Avaliação nacional aplicada a cada 2 anos. Participação mínima de 80% dos alunos é condicionalidade do VAAR — escola que não aplica a prova pode custar a complementação do município inteiro.',
    baseLegal: 'Lei 14.113/2020, art. 14',
  },
  censo: {
    sigla: 'Censo Escolar',
    nome: 'Censo Escolar (Educacenso/INEP)',
    explicacao:
      'Fotografia oficial das matrículas na última quarta-feira de maio. É a base de cálculo de TODO o FUNDEB do ano seguinte: o que não está no Censo não gera repasse. Corrigir cadastro antes do dia do Censo é o quick win nº 1.',
    baseLegal: 'Portaria MEC 264/2007',
  },
  simec: {
    sigla: 'SIMEC',
    nome: 'Sistema Integrado de Monitoramento do MEC',
    explicacao:
      'Onde o município registra o PAR e comprova as condicionalidades do VAAR com documentação. Compliance feito mas não registrado no SIMEC = compliance inexistente para o FNDE.',
  },
  par: {
    sigla: 'PAR',
    nome: 'Plano de Ações Articuladas',
    explicacao:
      'Instrumento de planejamento da rede municipal dentro do SIMEC. Precisa estar atualizado e coerente com as ações declaradas nas condicionalidades.',
  },
  ec135: {
    sigla: 'EC 135',
    nome: 'Emenda Constitucional 135 — Escola Integral',
    explicacao:
      'Obriga a expansão de matrículas em tempo integral (meta de 4% de novas vagas/ano) com plano municipal aprovado. Além de obrigação, é a alavanca de maior ganho por aluno (fator 1,50x + PETI).',
    baseLegal: 'EC 135/2024',
  },
  bncc_computacao: {
    sigla: 'BNCC Computação',
    nome: 'Complemento de Computação da BNCC',
    explicacao:
      'Componente curricular obrigatório (pensamento computacional, mundo digital, cultura digital). Faz parte da condicionalidade V do VAAR. Pode ser implementado sem laboratório (atividades "desplugadas").',
    baseLegal: 'Parecer CNE/CEB 2/2022 · Res. CNE 1/2022',
  },
  siope: {
    sigla: 'SIOPE',
    nome: 'Sistema de Informações sobre Orçamentos Públicos em Educação',
    explicacao:
      'Declaração das receitas e despesas de educação do município. Dados inconsistentes no SIOPE podem travar a complementação VAAT.',
  },
  ganho_garantido: {
    sigla: 'Ganho garantido',
    nome: 'Ganho que depende só de cadastro',
    explicacao:
      'Recursos que o município passa a receber apenas corrigindo a declaração no Censo (reclassificação de matrículas, AEE, localidade, jornada). Não exige nova política pública nem investimento.',
  },
  potencial_destravar: {
    sigla: 'Potencial a destravar',
    nome: 'VAAR condicionado a compliance',
    explicacao:
      'Valor estimado de VAAR que o município passaria a receber cumprindo as 5 condicionalidades e a meta de IDEB. Exige projeto de gestão educacional, não só cadastro.',
  },
};

/** Busca tolerante: aceita 'VAAF', 'vaaf', 'Fator Campo 1,15' etc. */
export function getTermo(key: string): TermoGlossario | undefined {
  const k = key.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9_]/g, '_');
  return GLOSSARIO[k] ?? GLOSSARIO[key.toLowerCase()];
}

/** Glossário serializado para o system prompt do assistente IA. */
export function glossarioParaPrompt(): string {
  return Object.values(GLOSSARIO)
    .map((t) => `- ${t.sigla} (${t.nome}): ${t.explicacao}${t.baseLegal ? ` [${t.baseLegal}]` : ''}`)
    .join('\n');
}
