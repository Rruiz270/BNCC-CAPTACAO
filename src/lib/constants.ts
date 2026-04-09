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

export const ACTION_PLAN_WEEKS = [
  { semana: 1, label: 'Semana 1: Discovery e Diagnostico', dates: '7-11 Abr', color: '#3b82f6' },
  { semana: 2, label: 'Semana 2: Plano Aprovado + Inicio Execucao', dates: '14-18 Abr', color: '#8b5cf6' },
  { semana: 3, label: 'Semana 3: Execucao T3 (AEE) + T4 (Reclassificacao)', dates: '21-25 Abr', color: '#22c55e' },
  { semana: 4, label: 'Semana 4: Execucao T2 (Integral) + Parcerias', dates: '28 Abr - 2 Mai', color: '#06b6d4' },
  { semana: 5, label: 'Semana 5: Verificacao e Ajustes Finais', dates: '5-9 Mai', color: '#f59e0b' },
  { semana: 6, label: 'Semana 6: Travamento - Ultimo Check', dates: '12-23 Mai', color: '#ef4444' },
  { semana: 7, label: 'DIA DO CENSO: 27/Mai/2026', dates: '27 Mai', color: '#ef4444' },
];
