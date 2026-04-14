export const CATEGORIAS_FUNDEB = [
  { id: 'creche_integral', label: 'Creche Publica Integral', fator: 1.55, porAluno: 9242 },
  { id: 'creche_integral_conv', label: 'Creche Conveniada Integral', fator: 1.45, porAluno: 8646 },
  { id: 'creche_parcial', label: 'Creche Publica Parcial', fator: 1.25, porAluno: 7453 },
  { id: 'creche_parcial_conv', label: 'Creche Conveniada Parcial', fator: 1.15, porAluno: 6857 },
  { id: 'pre_integral', label: 'Pre-escola Publica Integral', fator: 1.50, porAluno: 8944 },
  { id: 'pre_integral_conv', label: 'Pre-escola Conveniada Integral', fator: 1.40, porAluno: 8348 },
  { id: 'pre_parcial', label: 'Pre-escola Publica Parcial', fator: 1.15, porAluno: 6857 },
  { id: 'pre_parcial_conv', label: 'Pre-escola Conveniada Parcial', fator: 1.05, porAluno: 6261 },
  { id: 'ef_inicial', label: 'EF Anos Iniciais Parcial (BASE)', fator: 1.00, porAluno: 5963 },
  { id: 'ef_final', label: 'EF Anos Finais Parcial', fator: 1.10, porAluno: 6559 },
  { id: 'ef_integral', label: 'EF Integral', fator: 1.50, porAluno: 8944 },
  { id: 'eja', label: 'EJA', fator: 1.00, porAluno: 5963 },
  { id: 'ed_esp_creche', label: 'Ed. Especial Creche', fator: 1.40, porAluno: 8348 },
  { id: 'ed_esp_pre', label: 'Ed. Especial Pre-Escola', fator: 1.40, porAluno: 8348 },
  { id: 'ed_esp_demais', label: 'Ed. Especial Demais', fator: 1.40, porAluno: 8348 },
  { id: 'aee', label: 'AEE (Dupla Matricula)', fator: 1.40, porAluno: 8348 },
];

export const MULTIPLICADORES = {
  campo: { label: 'Educacao do Campo', fator: 1.15 },
  indigena: { label: 'Indigena/Quilombola', fator: 1.40 },
};

export const COMPLIANCE_SECTIONS = [
  {
    id: 'A',
    name: '5 Condicionalidades VAAR',
    deadline: '31/08/2026',
    items: [
      { key: 'a1', text: 'Provimento por selecao/merito dos gestores escolares' },
      { key: 'a2', text: 'Participacao nas avaliacoes (SAEB, Prova Brasil)' },
      { key: 'a3', text: 'Reducao das desigualdades socioeconomicas' },
      { key: 'a4', text: 'Regime de colaboracao estado-municipio' },
      { key: 'a5', text: 'Referenciais curriculares alinhados a BNCC (inclui Computacao)' },
    ]
  },
  {
    id: 'B',
    name: 'BNCC Computacao',
    deadline: '31/08/2026',
    items: [
      { key: 'b1', text: 'Curriculo aprovado pelo CME' },
      { key: 'b2', text: 'Resolucao publicada em diario oficial' },
      { key: 'b3', text: 'Professores capacitados' },
      { key: 'b4', text: 'Material didatico adquirido' },
      { key: 'b5', text: 'Laboratorios/infraestrutura' },
      { key: 'b6', text: 'Registro no SIMEC' },
    ]
  },
  {
    id: 'C',
    name: 'Censo Escolar',
    deadline: '27/05/2026',
    items: [
      { key: 'c1', text: 'Todas matriculas registradas' },
      { key: 'c2', text: 'Categorias de matricula corretas' },
      { key: 'c3', text: 'AEE dupla matricula registrada' },
      { key: 'c4', text: 'Escolas rurais classificadas corretamente' },
    ]
  },
  {
    id: 'D',
    name: 'SIMEC',
    deadline: '31/08/2026',
    items: [
      { key: 'd1', text: 'PAR atualizado' },
      { key: 'd2', text: 'Condicionalidades registradas' },
      { key: 'd3', text: 'Documentacao anexada' },
    ]
  },
  {
    id: 'E',
    name: 'EC 135 - Escola Integral',
    deadline: '31/12/2026',
    items: [
      { key: 'e1', text: 'Meta de 4% novas vagas integrais/ano' },
      { key: 'e2', text: 'Plano de expansao aprovado' },
    ]
  },
];

export const VAAF_BASE = 5963; // R$/aluno base (EF Anos Iniciais Parcial)

// FUNDEB Parameters (national reference values 2026)
export const FUNDEB_PARAMS = {
  VAAF_BASE: 5962.79,
  VAAF_MIN_NACIONAL: 5962.79,
  VAAT_MIN_NACIONAL: 10194.38,
  VAAR_MEDIAN_SP: 710.24,
  VAAT_MEDIAN_SP: 500.50,
  PETI_POR_ALUNO: 1693.22,
  ANO_REFERENCIA: 2026,
} as const;

// Potential T2 conversions (partial -> integral) and VAAF gain per student
export const T2_CONVERSIONS = [
  { from: 'creche_parcial', to: 'creche_integral', ganho: 3912 },
  { from: 'pre_parcial', to: 'pre_integral', ganho: 2087 },
  { from: 'ef_inicial', to: 'ef_integral', ganho: 2981 },
  { from: 'ef_final', to: 'ef_integral', ganho: 2385 },
] as const;

export const ACTION_PLAN_WEEKS = [
  { semana: 1, label: 'Semana 1: Discovery e Diagnostico', dates: '7-11 Abr', color: '#3b82f6' },
  { semana: 2, label: 'Semana 2: Plano Aprovado + Inicio Execucao', dates: '14-18 Abr', color: '#8b5cf6' },
  { semana: 3, label: 'Semana 3: Execucao T3 (AEE) + T4 (Reclassificacao)', dates: '21-25 Abr', color: '#22c55e' },
  { semana: 4, label: 'Semana 4: Execucao T2 (Integral) + Parcerias', dates: '28 Abr - 2 Mai', color: '#06b6d4' },
  { semana: 5, label: 'Semana 5: Verificacao e Ajustes Finais', dates: '5-9 Mai', color: '#f59e0b' },
  { semana: 6, label: 'Semana 6: Travamento - Ultimo Check', dates: '12-23 Mai', color: '#ef4444' },
  { semana: 7, label: 'DIA DO CENSO: 27/Mai/2026', dates: '27 Mai', color: '#ef4444' },
];

export const ACTION_PLAN_PHASES = [
  { id: 'curto', label: 'Quick Wins', sublabel: 'Ate 27/Mai/2026', deadline: '27/05/2026', color: '#3b82f6' },
  { id: 'medio', label: 'Medio Prazo', sublabel: 'Ate 31/Ago/2026', deadline: '31/08/2026', color: '#8b5cf6' },
  { id: 'longo', label: 'Longo Prazo', sublabel: '2027+', deadline: '31/12/2027', color: '#06b6d4' },
];

export const MEDIUM_TERM_TASKS = [
  { key: 'medio_1', tarefa: 'Aprovar curriculo BNCC Computacao no CME', descricao: 'Submeter minuta de resolucao ao Conselho Municipal de Educacao e obter aprovacao formal', deadline: '30/06/2026' },
  { key: 'medio_2', tarefa: 'Publicar resolucao em Diario Oficial', descricao: 'Publicar a resolucao aprovada no Diario Oficial do municipio como comprovacao VAAR', deadline: '15/07/2026' },
  { key: 'medio_3', tarefa: 'Registrar condicionalidades VAAR no SIMEC', descricao: 'Acessar o SIMEC e registrar todas as 5 condicionalidades com documentacao comprobatoria', deadline: '31/08/2026' },
  { key: 'medio_4', tarefa: 'Atualizar PAR no SIMEC', descricao: 'Atualizar o Plano de Acoes Articuladas com as novas acoes e metas do FUNDEB', deadline: '31/08/2026' },
  { key: 'medio_5', tarefa: 'Iniciar formacao docente em Computacao', descricao: 'Programa de formacao continuada com minimo de 32h anuais para professores', deadline: '31/07/2026' },
  { key: 'medio_6', tarefa: 'Adquirir material didatico de Computacao', descricao: 'Realizar processo de aquisicao de materiais didaticos para o componente curricular', deadline: '31/08/2026' },
  { key: 'medio_7', tarefa: 'Implementar selecao por merito de gestores', descricao: 'Estabelecer processo de selecao/provimento por merito dos gestores escolares (Condicionalidade VAAR)', deadline: '31/08/2026' },
  { key: 'medio_8', tarefa: 'Garantir participacao nas avaliacoes SAEB', descricao: 'Assegurar que todas as escolas participem das avaliacoes nacionais (Prova Brasil/SAEB)', deadline: '31/08/2026' },
  { key: 'medio_9', tarefa: 'Regime de colaboracao estado-municipio', descricao: 'Formalizar instrumento de regime de colaboracao com o estado de SP para o FUNDEB', deadline: '31/08/2026' },
];

export const LONG_TERM_TASKS = [
  { key: 'longo_1', tarefa: 'Expandir escola integral (EC 135)', descricao: 'Atingir meta de 4% de novas vagas integrais/ano conforme EC 135/2025', deadline: '31/12/2027' },
  { key: 'longo_2', tarefa: 'Aprovar plano de expansao de vagas integrais', descricao: 'Elaborar e aprovar plano municipal de expansao da educacao integral com metas e cronograma', deadline: '31/12/2026' },
  { key: 'longo_3', tarefa: 'Adequar infraestrutura escolar', descricao: 'Investir na adequacao de laboratorios de informatica, bibliotecas e quadras esportivas', deadline: '31/12/2027' },
  { key: 'longo_4', tarefa: 'Implementar curriculo de Computacao pleno', descricao: 'Garantir implementacao do componente curricular de Computacao em todas as unidades escolares', deadline: '28/02/2027' },
  { key: 'longo_5', tarefa: 'Consolidar parcerias e conveniamentos', descricao: 'Revisar e formalizar todas as parcerias com instituicoes conveniadas para maximizar FUNDEB', deadline: '31/12/2027' },
];
