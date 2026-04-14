import { pgSchema, serial, bigserial, text, integer, bigint, real, boolean, jsonb, timestamp, varchar } from 'drizzle-orm/pg-core';

export const fundebSchema = pgSchema('fundeb');
export const rawSchema = pgSchema('raw');
export const auditSchema = pgSchema('audit');

// municipalities - 645 SP cities
export const municipalities = fundebSchema.table('municipalities', {
  id: serial('id').primaryKey(),
  nome: text('nome').notNull(),
  codigoIbge: varchar('codigo_ibge', { length: 7 }).unique(),
  populacao: integer('populacao'),
  regiao: text('regiao'),
  // FUNDEB data
  receitaTotal: real('receita_total'),
  contribuicao: real('contribuicao'),
  recursosReceber: real('recursos_receber'),
  vaat: real('vaat'),
  vaar: real('vaar'),
  ganhoPerda: real('ganho_perda'),
  // Enrollment totals
  totalMatriculas: integer('total_matriculas'),
  categoriasAtivas: integer('categorias_ativas'),
  // Revenue breakdown
  icms: real('icms'),
  ipva: real('ipva'),
  ipiExp: real('ipi_exp'),
  totalEstado: real('total_estado'),
  fpm: real('fpm'),
  itr: real('itr'),
  totalUniao: real('total_uniao'),
  // Complementary
  destRemuneracao: real('dest_remuneracao'),
  destInfantil: real('dest_infantil'),
  destCapital: real('dest_capital'),
  // Education metrics
  nse: real('nse'),
  coeficiente: real('coeficiente'),
  idebAi: real('ideb_ai'),
  idebAf: real('ideb_af'),
  saebPort5: real('saeb_port_5'),
  saebMat5: real('saeb_mat_5'),
  saebPort9: real('saeb_port_9'),
  saebMat9: real('saeb_mat_9'),
  // Schools
  totalEscolas: integer('total_escolas'),
  escolasMunicipais: integer('escolas_municipais'),
  escolasRurais: integer('escolas_rurais'),
  totalDocentes: integer('total_docentes'),
  totalTurmas: integer('total_turmas'),
  // Infrastructure percentages (0-100)
  pctInternet: real('pct_internet'),
  pctBiblioteca: real('pct_biblioteca'),
  pctQuadra: real('pct_quadra'),
  pctLabInfo: real('pct_lab_info'),
  // Enrollment breakdowns by segment
  eiMat: real('ei_mat'),
  eiVal: real('ei_val'),
  efMat: real('ef_mat'),
  efVal: real('ef_val'),
  dmMat: real('dm_mat'),
  dmVal: real('dm_val'),
  // Historical FUNDEB revenue
  hist2022: real('hist_2022'),
  hist2023: real('hist_2023'),
  hist2024: real('hist_2024'),
  hist2025: real('hist_2025'),
  hist2026: real('hist_2026'),
  // Potential gains
  potTotal: real('pot_total'),
  pctPotTotal: real('pct_pot_total'),
  nFaltantes: integer('n_faltantes'),
  // Categories & potencial JSON
  cats: jsonb('cats'),
  potencial: jsonb('potencial'),
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// enrollments per category per municipality
export const enrollments = fundebSchema.table('enrollments', {
  id: serial('id').primaryKey(),
  municipalityId: integer('municipality_id').references(() => municipalities.id),
  categoria: text('categoria').notNull(), // e.g. 'creche_integral', 'creche_integral_conv', etc.
  categoriaLabel: text('categoria_label'), // human-readable
  fatorVaaf: real('fator_vaaf'),
  quantidade: integer('quantidade').default(0),
  quantidadeUrbana: integer('quantidade_urbana').default(0),
  quantidadeCampo: integer('quantidade_campo').default(0),
  receitaEstimada: real('receita_estimada'),
  ativa: boolean('ativa').default(false),
});

// schools
export const schools = fundebSchema.table('schools', {
  id: serial('id').primaryKey(),
  municipalityId: integer('municipality_id').references(() => municipalities.id),
  nome: text('nome').notNull(),
  codigoInep: varchar('codigo_inep', { length: 10 }),
  localizacao: text('localizacao'), // urbana/rural
  localizacaoDiferenciada: text('localizacao_diferenciada'), // TI/quilombola/null
  matriculas: integer('matriculas').default(0),
  docentes: integer('docentes').default(0),
  turmas: integer('turmas').default(0),
});

// compliance tracking
export const complianceItems = fundebSchema.table('compliance_items', {
  id: serial('id').primaryKey(),
  municipalityId: integer('municipality_id').references(() => municipalities.id),
  section: text('section').notNull(), // A-E
  sectionName: text('section_name'),
  itemKey: text('item_key').notNull(), // e.g. a1, a2, b1
  itemText: text('item_text').notNull(),
  status: text('status').default('pending'), // done, progress, pending, late
  evidenceUrl: text('evidence_url'),
  notes: text('notes'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// action plans
export const actionPlans = fundebSchema.table('action_plans', {
  id: serial('id').primaryKey(),
  municipalityId: integer('municipality_id').references(() => municipalities.id),
  phase: text('phase').default('curto'), // curto, medio, longo
  semana: integer('semana').notNull(), // 1-7 for curto, 0 for medio/longo
  semanaLabel: text('semana_label'),
  taskKey: text('task_key'), // unique key like curto_1_1, medio_1
  tarefa: text('tarefa').notNull(),
  descricao: text('descricao'),
  responsavel: text('responsavel'),
  status: text('status').default('pending'),
  dueDate: text('due_date'),
  notes: text('notes'),
  completedAt: timestamp('completed_at'),
});

// simulations
export const simulations = fundebSchema.table('simulations', {
  id: serial('id').primaryKey(),
  municipalityId: integer('municipality_id').references(() => municipalities.id),
  nome: text('nome'),
  parametros: jsonb('parametros'), // all slider values
  resultadoTotal: real('resultado_total'),
  resultadoGanho: real('resultado_ganho'),
  resultadoGanhoPct: real('resultado_ganho_pct'),
  createdAt: timestamp('created_at').defaultNow(),
});

// consultorias (advisory sessions)
export const consultorias = fundebSchema.table('consultorias', {
  id: serial('id').primaryKey(),
  municipalityId: integer('municipality_id').references(() => municipalities.id),
  status: text('status').default('active'), // active, paused, completed
  startDate: timestamp('start_date').defaultNow(),
  endDate: timestamp('end_date'),
  notes: text('notes'),
  consultantName: text('consultant_name'),
  secretaryName: text('secretary_name'),
  annotations: text('annotations'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// documents (minutas, curriculos, etc)
export const documents = fundebSchema.table('documents', {
  id: serial('id').primaryKey(),
  municipalityId: integer('municipality_id').references(() => municipalities.id),
  tipo: text('tipo').notNull(), // minuta_cme, curriculo_bncc, resolucao
  titulo: text('titulo'),
  conteudo: text('conteudo'), // HTML content
  status: text('status').default('rascunho'), // rascunho, aprovado, publicado
  versao: integer('versao').default(1),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// =====================================================
// WIZARD BLUEPRINT — novas tabelas
// =====================================================

// fundeb.wizard_progress — estado do wizard por sessao
export const wizardProgress = fundebSchema.table('wizard_progress', {
  id: serial('id').primaryKey(),
  consultoriaId: integer('consultoria_id')
    .notNull()
    .references(() => consultorias.id, { onDelete: 'cascade' }),
  step: integer('step').notNull(), // 0..9
  status: text('status').notNull().default('available'), // locked|available|in_progress|completed|blocked
  payload: jsonb('payload').default({}),
  blockReason: text('block_reason'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// fundeb.scenarios — simulacoes nomeadas (UC-P2.03)
export const scenarios = fundebSchema.table('scenarios', {
  id: serial('id').primaryKey(),
  consultoriaId: integer('consultoria_id')
    .notNull()
    .references(() => consultorias.id, { onDelete: 'cascade' }),
  nome: text('nome').notNull(),
  isTarget: boolean('is_target').default(false),
  parametros: jsonb('parametros').notNull(),
  resultado: jsonb('resultado'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// fundeb.approvals — trilha de aprovacao (UC-GE.03, UC-AU.02)
export const approvals = fundebSchema.table('approvals', {
  id: serial('id').primaryKey(),
  documentId: integer('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  requestedBy: text('requested_by').notNull(),
  requestedAt: timestamp('requested_at').defaultNow(),
  decidedBy: text('decided_by'),
  decidedAt: timestamp('decided_at'),
  decision: text('decision'), // pending|approved|rejected
  comment: text('comment'),
  documentVersion: integer('document_version').notNull(),
});

// fundeb.evidences — evidencias anexadas (UC-P1.04, UC-AU.04)
export const evidences = fundebSchema.table('evidences', {
  id: serial('id').primaryKey(),
  consultoriaId: integer('consultoria_id')
    .notNull()
    .references(() => consultorias.id, { onDelete: 'cascade' }),
  entityType: text('entity_type').notNull(), // 'compliance_item' | 'action_plan' | 'document'
  entityId: integer('entity_id').notNull(),
  url: text('url'),
  storageKey: text('storage_key'),
  filename: text('filename'),
  mimeType: text('mime_type'),
  contentHash: text('content_hash'),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  uploadedBy: text('uploaded_by'),
  uploadedAt: timestamp('uploaded_at').defaultNow(),
  notes: text('notes'),
});

// raw.imports — arquivos brutos (UC-P1.01, UC-AU.08)
export const rawImports = rawSchema.table('imports', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  source: text('source').notNull(), // censo_escolar|siope|fnde|ibge|local
  filename: text('filename'),
  contentHash: text('content_hash').notNull(),
  mimeType: text('mime_type'),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  uploadedBy: text('uploaded_by'),
  consultoriaId: integer('consultoria_id'),
  municipalityId: integer('municipality_id'),
  status: text('status').notNull().default('received'), // received|extracting|treating|cataloging|done|failed
  rowsTotal: integer('rows_total').default(0),
  rowsOk: integer('rows_ok').default(0),
  rowsRejected: integer('rows_rejected').default(0),
  errors: jsonb('errors').default([]),
  metadata: jsonb('metadata').default({}),
  startedAt: timestamp('started_at').defaultNow(),
  finishedAt: timestamp('finished_at'),
});

// raw.import_rows — linhas brutas
export const rawImportRows = rawSchema.table('import_rows', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  importId: bigint('import_id', { mode: 'number' }).notNull(),
  rowIndex: integer('row_index').notNull(),
  payload: jsonb('payload').notNull(),
  isValid: boolean('is_valid'),
  errors: jsonb('errors').default([]),
  treatedAt: timestamp('treated_at'),
  catalogedAt: timestamp('cataloged_at'),
});

// raw.lineage — rastreabilidade dado bruto -> estrutural (UC-AU.08)
export const rawLineage = rawSchema.table('lineage', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  targetSchema: text('target_schema').notNull(),
  targetTable: text('target_table').notNull(),
  targetId: bigint('target_id', { mode: 'number' }).notNull(),
  rawRowId: bigint('raw_row_id', { mode: 'number' }),
  importId: bigint('import_id', { mode: 'number' }),
  createdAt: timestamp('created_at').defaultNow(),
});

// intake_tokens — links enviados a secretarias
export const intakeTokens = fundebSchema.table('intake_tokens', {
  id: serial('id').primaryKey(),
  token: varchar('token', { length: 64 }).unique().notNull(),
  municipalityId: integer('municipality_id').references(() => municipalities.id),
  consultoriaId: integer('consultoria_id').references(() => consultorias.id),
  createdBy: text('created_by'),
  expiresAt: timestamp('expires_at').notNull(),
  respondedAt: timestamp('responded_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// intake_responses — respostas submetidas pelas secretarias
export const intakeResponses = fundebSchema.table('intake_responses', {
  id: serial('id').primaryKey(),
  tokenId: integer('token_id').references(() => intakeTokens.id),
  municipalityId: integer('municipality_id').references(() => municipalities.id),
  respondentName: text('respondent_name').notNull(),
  respondentRole: text('respondent_role'),
  respondentEmail: text('respondent_email'),
  data: jsonb('data'),
  submittedAt: timestamp('submitted_at').defaultNow(),
});

// audit.event_log — log imutavel (UC-AU.01)
export const auditEventLog = auditSchema.table('event_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  ts: timestamp('ts').notNull().defaultNow(),
  actorId: text('actor_id').notNull(),
  actorRole: text('actor_role'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: bigint('entity_id', { mode: 'number' }),
  consultoriaId: integer('consultoria_id'),
  beforeState: jsonb('before_state'),
  afterState: jsonb('after_state'),
  context: jsonb('context').default({}),
  requestId: text('request_id'),
});

// ── FUNDEB Reference Tables ─────────────────────────────────

// ref_fatores_ponderacao — official FNDE weighting factors by segment (325 rows, national)
export const refFatoresPonderacao = fundebSchema.table('ref_fatores_ponderacao', {
  id: serial('id').primaryKey(),
  descricao: text('descricao'),
  segmento: text('segmento').notNull().unique(),
  fpVaaf: real('fp_vaaf'),
  fpVaat: real('fp_vaat'),
  fMulti: real('f_multi').default(1.0),
  fpFinalVaaf: real('fp_final_vaaf'),
  fpFinalVaat: real('fp_final_vaat'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ref_inep_censo — INEP Census 2024 enrollments by education level (645 SP rows)
export const refInepCenso = fundebSchema.table('ref_inep_censo', {
  id: serial('id').primaryKey(),
  codigoIbge: varchar('codigo_ibge', { length: 7 }).unique(),
  municipalityId: integer('municipality_id').references(() => municipalities.id),
  uf: text('uf'),
  municipio: text('municipio'),
  matTotal: integer('mat_total'),
  matEiTotal: integer('mat_ei_total'),
  matCreche: integer('mat_creche'),
  matPreEscola: integer('mat_pre_escola'),
  matEfTotal: integer('mat_ef_total'),
  matEfAi: integer('mat_ef_ai'),
  matEfAf: integer('mat_ef_af'),
  matEmTotal: integer('mat_em_total'),
  matEmPropedeutico: integer('mat_em_propedeutico'),
  matEmNormal: integer('mat_em_normal'),
  matEmTecIntegrado: integer('mat_em_tec_integrado'),
  matProfTotal: integer('mat_prof_total'),
  matEjaTotal: integer('mat_eja_total'),
  matEjaFund: integer('mat_eja_fund'),
  matEjaMedio: integer('mat_eja_medio'),
  matEspecialTotal: integer('mat_especial_total'),
  matEspecialComum: integer('mat_especial_comum'),
  matEspecialExclusiva: integer('mat_especial_exclusiva'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ref_nse — socioeconomic weighting per municipality (645 SP rows)
export const refNse = fundebSchema.table('ref_nse', {
  id: serial('id').primaryKey(),
  codigoIbge: varchar('codigo_ibge', { length: 7 }).unique(),
  municipalityId: integer('municipality_id').references(() => municipalities.id),
  uf: text('uf'),
  nome: text('nome'),
  ponderadorNse: real('ponderador_nse'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ref_historico_stn — monthly STN transfers by origin (168 SP rows)
export const refHistoricoStn = fundebSchema.table('ref_historico_stn', {
  id: serial('id').primaryKey(),
  uf: text('uf').notNull(),
  ano: integer('ano').notNull(),
  nivel: text('nivel').notNull(),
  origem: text('origem').notNull(),
  jan: real('jan'),
  fev: real('fev'),
  mar: real('mar'),
  abr: real('abr'),
  mai: real('mai'),
  jun: real('jun'),
  jul: real('jul'),
  ago: real('ago'),
  sete: real('sete'),
  outu: real('outu'),
  novt: real('novt'),
  dezt: real('dezt'),
  totalAno: real('total_ano'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ref_matriculas_vaaf — enrollments × VAAF by category/locality (30,315 SP rows)
export const refMatriculasVaaf = fundebSchema.table('ref_matriculas_vaaf', {
  id: serial('id').primaryKey(),
  municipalityId: integer('municipality_id').references(() => municipalities.id),
  secao: text('secao'),
  categoria: text('categoria'),
  localidade: text('localidade'),
  matriculas: real('matriculas'),
  vaafValor: real('vaaf_valor'),
  subtotal: real('subtotal'),
  createdAt: timestamp('created_at').defaultNow(),
});

// audit.snapshots — snapshot imutavel (UC-AU.05, UC-AU.07)
export const auditSnapshots = auditSchema.table('snapshots', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  consultoriaId: integer('consultoria_id').notNull(),
  payload: jsonb('payload').notNull(),
  hash: text('hash').notNull(),
  signedAt: timestamp('signed_at').notNull().defaultNow(),
  signedBy: text('signed_by').notNull(),
  reason: text('reason'),
});
