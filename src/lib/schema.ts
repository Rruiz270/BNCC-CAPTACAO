import { pgSchema, serial, text, integer, real, boolean, jsonb, timestamp, varchar } from 'drizzle-orm/pg-core';

export const fundebSchema = pgSchema('fundeb');

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
