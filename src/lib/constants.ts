export const CATEGORIAS_FUNDEB = [
  { id: 'creche_integral', label: 'Creche Pública Integral', fator: 1.55, porAluno: 9242 },
  { id: 'creche_integral_conv', label: 'Creche Conveniada Integral', fator: 1.45, porAluno: 8646 },
  { id: 'creche_parcial', label: 'Creche Pública Parcial', fator: 1.25, porAluno: 7453 },
  { id: 'creche_parcial_conv', label: 'Creche Conveniada Parcial', fator: 1.15, porAluno: 6857 },
  { id: 'pre_integral', label: 'Pré-escola Pública Integral', fator: 1.50, porAluno: 8944 },
  { id: 'pre_integral_conv', label: 'Pré-escola Conveniada Integral', fator: 1.40, porAluno: 8348 },
  { id: 'pre_parcial', label: 'Pré-escola Pública Parcial', fator: 1.15, porAluno: 6857 },
  { id: 'pre_parcial_conv', label: 'Pré-escola Conveniada Parcial', fator: 1.05, porAluno: 6261 },
  { id: 'ef_inicial', label: 'EF Anos Iniciais Parcial (BASE)', fator: 1.00, porAluno: 5963 },
  { id: 'ef_final', label: 'EF Anos Finais Parcial', fator: 1.10, porAluno: 6559 },
  { id: 'ef_integral', label: 'EF Integral', fator: 1.50, porAluno: 8944 },
  { id: 'eja', label: 'EJA', fator: 1.00, porAluno: 5963 },
  { id: 'ed_esp_creche', label: 'Ed. Especial Creche', fator: 1.40, porAluno: 8348 },
  { id: 'ed_esp_pre', label: 'Ed. Especial Pré-Escola', fator: 1.40, porAluno: 8348 },
  { id: 'ed_esp_demais', label: 'Ed. Especial Demais', fator: 1.40, porAluno: 8348 },
  { id: 'aee', label: 'AEE (Dupla Matrícula)', fator: 1.40, porAluno: 8348 },
];

export const MULTIPLICADORES = {
  campo: { label: 'Educação do Campo', fator: 1.15 },
  indigena: { label: 'Indígena/Quilombola', fator: 1.40 },
};

export const COMPLIANCE_SECTIONS = [
  {
    id: 'A',
    name: '5 Condicionalidades VAAR',
    deadline: '31/08/2026',
    items: [
      { key: 'a1', text: 'Provimento por seleção/mérito dos gestores escolares' },
      { key: 'a2', text: 'Participação nas avaliações (SAEB, Prova Brasil)' },
      { key: 'a3', text: 'Redução das desigualdades socioeconômicas' },
      { key: 'a4', text: 'Regime de colaboração estado-município' },
      { key: 'a5', text: 'Referenciais curriculares alinhados à BNCC (inclui Computação)' },
    ]
  },
  {
    id: 'B',
    name: 'BNCC Computação',
    deadline: '31/08/2026',
    items: [
      { key: 'b1', text: 'Currículo aprovado pelo CME' },
      { key: 'b2', text: 'Resolução publicada em diário oficial' },
      { key: 'b3', text: 'Professores capacitados' },
      { key: 'b4', text: 'Material didático adquirido' },
      { key: 'b5', text: 'Laboratórios/infraestrutura' },
      { key: 'b6', text: 'Registro no SIMEC' },
    ]
  },
  {
    id: 'C',
    name: 'Censo Escolar',
    deadline: '26/05/2027',
    items: [
      { key: 'c1', text: 'Todas matrículas registradas' },
      { key: 'c2', text: 'Categorias de matrícula corretas' },
      { key: 'c3', text: 'AEE dupla matrícula registrada' },
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
      { key: 'd3', text: 'Documentação anexada' },
    ]
  },
  {
    id: 'E',
    name: 'EC 135 - Escola Integral',
    deadline: '31/12/2026',
    items: [
      { key: 'e1', text: 'Meta de 4% novas vagas integrais/ano' },
      { key: 'e2', text: 'Plano de expansão aprovado' },
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

// Esteira LEAN i10×APM: 7 semanas relativas ao início da consultoria,
// travando na próxima janela regulatória (ver src/lib/fundeb/prazos.ts).
export const ACTION_PLAN_WEEKS = [
  { semana: 1, label: 'Semana 1: Discovery e Diagnóstico', dates: 'semana 1', color: '#3b82f6' },
  { semana: 2, label: 'Semana 2: Plano Aprovado + Início Execução', dates: 'semana 2', color: '#8b5cf6' },
  { semana: 3, label: 'Semana 3: Execução T3 (AEE) + T4 (Reclassificação)', dates: 'semana 3', color: '#22c55e' },
  { semana: 4, label: 'Semana 4: Execução T2 (Integral) + Parcerias', dates: 'semana 4', color: '#06b6d4' },
  { semana: 5, label: 'Semana 5: Verificação e Ajustes Finais', dates: 'semana 5', color: '#f59e0b' },
  { semana: 6, label: 'Semana 6: Travamento - Último Check', dates: 'semana 6', color: '#ef4444' },
  { semana: 7, label: 'Semana 7: Janela regulatória - conferência final', dates: 'semana 7', color: '#ef4444' },
];

export const ACTION_PLAN_PHASES = [
  { id: 'curto', label: 'Quick Wins', sublabel: 'Até 27/Mai/2026', deadline: '27/05/2026', color: '#3b82f6' },
  { id: 'medio', label: 'Médio Prazo', sublabel: 'Até 31/Ago/2026', deadline: '31/08/2026', color: '#8b5cf6' },
  { id: 'longo', label: 'Longo Prazo', sublabel: '2027+', deadline: '31/12/2027', color: '#06b6d4' },
];

export const MEDIUM_TERM_TASKS = [
  { key: 'medio_1', tarefa: 'Aprovar currículo BNCC Computação no CME', descricao: 'Submeter minuta de resolução ao Conselho Municipal de Educação e obter aprovação formal', deadline: '30/06/2026' },
  { key: 'medio_2', tarefa: 'Publicar resolução em Diário Oficial', descricao: 'Publicar a resolução aprovada no Diário Oficial do município como comprovação VAAR', deadline: '15/07/2026' },
  { key: 'medio_3', tarefa: 'Registrar condicionalidades VAAR no SIMEC', descricao: 'Acessar o SIMEC e registrar todas as 5 condicionalidades com documentação comprobatória', deadline: '31/08/2026' },
  { key: 'medio_4', tarefa: 'Atualizar PAR no SIMEC', descricao: 'Atualizar o Plano de Ações Articuladas com as novas ações e metas do FUNDEB', deadline: '31/08/2026' },
  { key: 'medio_5', tarefa: 'Iniciar formação docente em Computação', descricao: 'Programa de formação continuada com mínimo de 32h anuais para professores', deadline: '31/07/2026' },
  { key: 'medio_6', tarefa: 'Adquirir material didático de Computação', descricao: 'Realizar processo de aquisição de materiais didáticos para o componente curricular', deadline: '31/08/2026' },
  { key: 'medio_7', tarefa: 'Implementar seleção por mérito de gestores', descricao: 'Estabelecer processo de seleção/provimento por mérito dos gestores escolares (Condicionalidade VAAR)', deadline: '31/08/2026' },
  { key: 'medio_8', tarefa: 'Garantir participação nas avaliações SAEB', descricao: 'Assegurar que todas as escolas participem das avaliações nacionais (Prova Brasil/SAEB)', deadline: '31/08/2026' },
  { key: 'medio_9', tarefa: 'Regime de colaboração estado-município', descricao: 'Formalizar instrumento de regime de colaboração com o estado de SP para o FUNDEB', deadline: '31/08/2026' },
];

export const LONG_TERM_TASKS = [
  { key: 'longo_1', tarefa: 'Expandir escola integral (EC 135)', descricao: 'Atingir meta de 4% de novas vagas integrais/ano conforme EC 135/2025', deadline: '31/12/2027' },
  { key: 'longo_2', tarefa: 'Aprovar plano de expansão de vagas integrais', descricao: 'Elaborar e aprovar plano municipal de expansão da educação integral com metas e cronograma', deadline: '31/12/2026' },
  { key: 'longo_3', tarefa: 'Adequar infraestrutura escolar', descricao: 'Investir na adequação de laboratórios de informática, bibliotecas e quadras esportivas', deadline: '31/12/2027' },
  { key: 'longo_4', tarefa: 'Implementar currículo de Computação pleno', descricao: 'Garantir implementação do componente curricular de Computação em todas as unidades escolares', deadline: '28/02/2027' },
  { key: 'longo_5', tarefa: 'Consolidar parcerias e conveniamentos', descricao: 'Revisar e formalizar todas as parcerias com instituições conveniadas para maximizar FUNDEB', deadline: '31/12/2027' },
];
