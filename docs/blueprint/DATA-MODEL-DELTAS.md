# DATA MODEL DELTAS — Tabelas novas para o Wizard

> DDL Postgres para suportar o wizard, auditoria, snapshots e camada bruta. Compatível com a base atual (`fundeb.*`). Pode ser aplicado incrementalmente sem quebrar o que já existe.

## Schemas

```sql
-- Já existe
-- CREATE SCHEMA IF NOT EXISTS fundeb;

-- Novos
CREATE SCHEMA IF NOT EXISTS raw;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS ops;
```

| Schema | Propósito |
|---|---|
| `fundeb` | Estrutural (já existe) |
| `raw` | Camada bruta — append-only de tudo que entra |
| `audit` | Trilha imutável de eventos e snapshots |
| `ops` | Views materializadas para consumo do app |

---

## 1. Schema `raw` — Camada Bruta

### `raw.imports`

Cada arquivo/conjunto de dados que entra no sistema.

```sql
CREATE TABLE IF NOT EXISTS raw.imports (
  id              BIGSERIAL PRIMARY KEY,
  source          TEXT NOT NULL,                  -- 'censo_escolar' | 'siope' | 'fnde' | 'ibge' | 'local'
  filename        TEXT,
  content_hash    TEXT NOT NULL,                  -- sha256 do arquivo
  mime_type       TEXT,
  size_bytes      BIGINT,
  uploaded_by     TEXT,                           -- email/id do consultor
  consultoria_id  INTEGER REFERENCES fundeb.consultorias(id) ON DELETE SET NULL,
  municipality_id INTEGER REFERENCES fundeb.municipalities(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'received', -- received | extracting | treating | cataloging | done | failed
  rows_total      INTEGER DEFAULT 0,
  rows_ok         INTEGER DEFAULT 0,
  rows_rejected   INTEGER DEFAULT 0,
  errors          JSONB DEFAULT '[]'::jsonb,
  metadata        JSONB DEFAULT '{}'::jsonb,
  started_at      TIMESTAMP DEFAULT NOW(),
  finished_at     TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_raw_imports_consultoria ON raw.imports(consultoria_id);
CREATE INDEX IF NOT EXISTS idx_raw_imports_municipality ON raw.imports(municipality_id);
CREATE INDEX IF NOT EXISTS idx_raw_imports_status ON raw.imports(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_raw_imports_hash ON raw.imports(content_hash);
```

### `raw.import_rows`

Linhas brutas do arquivo, normalizadas para JSONB para suportar qualquer formato.

```sql
CREATE TABLE IF NOT EXISTS raw.import_rows (
  id          BIGSERIAL PRIMARY KEY,
  import_id   BIGINT NOT NULL REFERENCES raw.imports(id) ON DELETE CASCADE,
  row_index   INTEGER NOT NULL,
  payload     JSONB NOT NULL,
  is_valid    BOOLEAN DEFAULT NULL,    -- null = não validado, true = ok, false = rejeitado
  errors      JSONB DEFAULT '[]'::jsonb,
  treated_at  TIMESTAMP,
  cataloged_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_raw_import_rows_import ON raw.import_rows(import_id);
CREATE INDEX IF NOT EXISTS idx_raw_import_rows_valid ON raw.import_rows(is_valid);
```

### `raw.lineage`

Liga uma linha do banco estrutural (`fundeb.*`) à(s) linha(s) brutas que a originaram. Suporta UC-AU.08 (rastrear origem da métrica).

```sql
CREATE TABLE IF NOT EXISTS raw.lineage (
  id              BIGSERIAL PRIMARY KEY,
  target_schema   TEXT NOT NULL,        -- 'fundeb'
  target_table    TEXT NOT NULL,        -- 'enrollments', 'municipalities', 'schools'
  target_id       BIGINT NOT NULL,      -- id da linha alvo
  raw_row_id      BIGINT REFERENCES raw.import_rows(id) ON DELETE SET NULL,
  import_id       BIGINT REFERENCES raw.imports(id) ON DELETE SET NULL,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lineage_target ON raw.lineage(target_schema, target_table, target_id);
CREATE INDEX IF NOT EXISTS idx_lineage_raw_row ON raw.lineage(raw_row_id);
```

---

## 2. Schema `fundeb` — Acréscimos

### `fundeb.wizard_progress`

Estado do wizard por sessão de consultoria.

```sql
CREATE TABLE IF NOT EXISTS fundeb.wizard_progress (
  id              SERIAL PRIMARY KEY,
  consultoria_id  INTEGER NOT NULL REFERENCES fundeb.consultorias(id) ON DELETE CASCADE,
  step            INTEGER NOT NULL,                          -- 0..9
  status          TEXT NOT NULL DEFAULT 'available',         -- locked | available | in_progress | completed | blocked
  payload         JSONB DEFAULT '{}'::jsonb,                 -- estado da etapa (formulários, escolhas)
  block_reason    TEXT,
  started_at      TIMESTAMP,
  completed_at    TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_wizard_progress_step
  ON fundeb.wizard_progress(consultoria_id, step);

CREATE INDEX IF NOT EXISTS idx_wizard_progress_consultoria
  ON fundeb.wizard_progress(consultoria_id);
```

### `fundeb.scenarios`

Simulações nomeadas vinculadas à consultoria (UC-P2.03).

```sql
CREATE TABLE IF NOT EXISTS fundeb.scenarios (
  id              SERIAL PRIMARY KEY,
  consultoria_id  INTEGER NOT NULL REFERENCES fundeb.consultorias(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  is_target       BOOLEAN DEFAULT FALSE,                 -- só um por consultoria
  parametros      JSONB NOT NULL,                        -- {categoria_id: novas_matriculas, multiplicadores: {...}}
  resultado       JSONB,                                 -- {receita_total, ganho, ganho_pct, por_categoria: [...]}
  created_by      TEXT,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scenarios_consultoria ON fundeb.scenarios(consultoria_id);

-- Garantia de no máximo 1 cenário-alvo por consultoria
CREATE UNIQUE INDEX IF NOT EXISTS uq_scenarios_target_per_consultoria
  ON fundeb.scenarios(consultoria_id) WHERE is_target = TRUE;
```

### `fundeb.approvals`

Trilha de aprovação de documentos (UC-GE.03, UC-AU.02).

```sql
CREATE TABLE IF NOT EXISTS fundeb.approvals (
  id              SERIAL PRIMARY KEY,
  document_id     INTEGER NOT NULL REFERENCES fundeb.documents(id) ON DELETE CASCADE,
  requested_by    TEXT NOT NULL,
  requested_at    TIMESTAMP DEFAULT NOW(),
  decided_by      TEXT,
  decided_at      TIMESTAMP,
  decision        TEXT,                                  -- pending | approved | rejected
  comment         TEXT,
  document_version INTEGER NOT NULL                      -- versão aprovada/rejeitada
);

CREATE INDEX IF NOT EXISTS idx_approvals_document ON fundeb.approvals(document_id);
CREATE INDEX IF NOT EXISTS idx_approvals_decision ON fundeb.approvals(decision);
```

### `fundeb.evidences`

Evidências anexadas a itens de compliance ou tarefas (UC-P1.04, UC-AU.04).

```sql
CREATE TABLE IF NOT EXISTS fundeb.evidences (
  id                SERIAL PRIMARY KEY,
  consultoria_id    INTEGER NOT NULL REFERENCES fundeb.consultorias(id) ON DELETE CASCADE,
  entity_type       TEXT NOT NULL,                       -- 'compliance_item' | 'action_plan' | 'document'
  entity_id         INTEGER NOT NULL,
  url               TEXT,                                -- link externo
  storage_key       TEXT,                                -- chave de upload (se aplicável)
  filename          TEXT,
  mime_type         TEXT,
  content_hash      TEXT,
  size_bytes        BIGINT,
  uploaded_by       TEXT,
  uploaded_at       TIMESTAMP DEFAULT NOW(),
  notes             TEXT
);

CREATE INDEX IF NOT EXISTS idx_evidences_entity
  ON fundeb.evidences(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_evidences_consultoria
  ON fundeb.evidences(consultoria_id);
```

---

## 3. Schema `audit` — Trilha imutável

### `audit.event_log`

Log append-only de toda alteração relevante (UC-AU.01).

```sql
CREATE TABLE IF NOT EXISTS audit.event_log (
  id              BIGSERIAL PRIMARY KEY,
  ts              TIMESTAMP NOT NULL DEFAULT NOW(),
  actor_id        TEXT NOT NULL,                         -- email/id
  actor_role      TEXT,                                  -- consultor | coordenador | auditor | sistema
  action          TEXT NOT NULL,                         -- session.opened, compliance.item.changed, ...
  entity_type     TEXT NOT NULL,                         -- 'consultoria' | 'compliance_item' | 'document' | ...
  entity_id       BIGINT,
  consultoria_id  INTEGER REFERENCES fundeb.consultorias(id) ON DELETE SET NULL,
  before_state    JSONB,
  after_state     JSONB,
  context         JSONB DEFAULT '{}'::jsonb,             -- ip, user agent, request id, step do wizard
  request_id      TEXT
);

CREATE INDEX IF NOT EXISTS idx_event_log_consultoria
  ON audit.event_log(consultoria_id);
CREATE INDEX IF NOT EXISTS idx_event_log_entity
  ON audit.event_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_event_log_action
  ON audit.event_log(action);
CREATE INDEX IF NOT EXISTS idx_event_log_ts
  ON audit.event_log(ts DESC);

-- Bloqueia UPDATE/DELETE para garantir imutabilidade
CREATE OR REPLACE FUNCTION audit.event_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit.event_log is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_event_log_no_update ON audit.event_log;
CREATE TRIGGER trg_event_log_no_update
  BEFORE UPDATE OR DELETE ON audit.event_log
  FOR EACH ROW EXECUTE FUNCTION audit.event_log_immutable();
```

### `audit.snapshots`

Snapshot imutável da consultoria ao encerrar (UC-AU.05, UC-AU.07).

```sql
CREATE TABLE IF NOT EXISTS audit.snapshots (
  id              BIGSERIAL PRIMARY KEY,
  consultoria_id  INTEGER NOT NULL REFERENCES fundeb.consultorias(id),
  payload         JSONB NOT NULL,                        -- dump completo: dados, compliance, plano, documentos
  hash            TEXT NOT NULL,                         -- sha256 do payload canônico
  signed_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  signed_by       TEXT NOT NULL,
  reason          TEXT                                   -- 'closing' | 'milestone' | 'on_demand'
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_snapshots_hash ON audit.snapshots(hash);
CREATE INDEX IF NOT EXISTS idx_snapshots_consultoria
  ON audit.snapshots(consultoria_id);

DROP TRIGGER IF EXISTS trg_snapshots_no_update ON audit.snapshots;
CREATE TRIGGER trg_snapshots_no_update
  BEFORE UPDATE OR DELETE ON audit.snapshots
  FOR EACH ROW EXECUTE FUNCTION audit.event_log_immutable();
```

---

## 4. Schema `ops` — Views Operacionais

> Materializadas (refresh sob demanda via SP) para leitura rápida pelo app. Mais detalhe em `STORED-PROCEDURES.md`.

```sql
-- KPIs por consultoria
CREATE MATERIALIZED VIEW IF NOT EXISTS ops.v_consultoria_kpis AS
SELECT
  c.id AS consultoria_id,
  c.municipality_id,
  m.nome AS municipio,
  COALESCE(comp.pct_done, 0) AS compliance_pct,
  COALESCE(plan.pct_done, 0) AS plano_pct,
  m.pot_total,
  m.pct_pot_total,
  m.ganho_perda
FROM fundeb.consultorias c
JOIN fundeb.municipalities m ON m.id = c.municipality_id
LEFT JOIN (
  SELECT municipality_id,
    ROUND(100.0 * SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0)) AS pct_done
  FROM fundeb.compliance_items GROUP BY municipality_id
) comp ON comp.municipality_id = c.municipality_id
LEFT JOIN (
  SELECT municipality_id,
    ROUND(100.0 * SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0)) AS pct_done
  FROM fundeb.action_plans GROUP BY municipality_id
) plan ON plan.municipality_id = c.municipality_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ops_consultoria_kpis
  ON ops.v_consultoria_kpis(consultoria_id);

-- Compliance por seção
CREATE MATERIALIZED VIEW IF NOT EXISTS ops.v_compliance_progresso AS
SELECT
  municipality_id,
  section,
  section_name,
  COUNT(*) AS total,
  SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
  ROUND(100.0 * SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0)) AS pct
FROM fundeb.compliance_items
GROUP BY municipality_id, section, section_name;

CREATE INDEX IF NOT EXISTS idx_ops_compliance_muni
  ON ops.v_compliance_progresso(municipality_id);

-- Ranking de oportunidades por categoria (top potencial)
CREATE MATERIALIZED VIEW IF NOT EXISTS ops.v_potencial_categoria AS
SELECT
  e.municipality_id,
  e.categoria,
  e.categoria_label,
  e.fator_vaaf,
  e.quantidade,
  e.ativa,
  (5963 * e.fator_vaaf) AS valor_por_aluno,
  CASE WHEN e.ativa = FALSE THEN 1 ELSE 0 END AS ordem_inativa
FROM fundeb.enrollments e;

CREATE INDEX IF NOT EXISTS idx_ops_pot_cat_muni
  ON ops.v_potencial_categoria(municipality_id);
```

---

## 5. Script de Migração (idempotente)

Salvar como `drizzle/0001_wizard_blueprint.sql` ou aplicar via `psql`:

```sql
-- =====================================================
-- 0001_wizard_blueprint.sql
-- Adiciona estrutura do wizard, auditoria e camada bruta.
-- Idempotente: pode rodar várias vezes.
-- =====================================================
BEGIN;

CREATE SCHEMA IF NOT EXISTS raw;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS ops;

-- (cole aqui o DDL das seções 1, 2, 3 e 4 acima na ordem)

COMMIT;
```

---

## 6. Drizzle ORM (TypeScript) — Adições a `src/lib/schema.ts`

Compatível com o que já existe. Mantém o `pgSchema('fundeb')` e adiciona schemas separados.

```ts
import {
  pgSchema,
  serial,
  bigserial,
  text,
  integer,
  bigint,
  boolean,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core';

import { municipalities, consultorias, documents } from './schema'; // re-uso

export const rawSchema   = pgSchema('raw');
export const auditSchema = pgSchema('audit');

// raw.imports
export const rawImports = rawSchema.table('imports', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  source: text('source').notNull(),
  filename: text('filename'),
  contentHash: text('content_hash').notNull(),
  mimeType: text('mime_type'),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  uploadedBy: text('uploaded_by'),
  consultoriaId: integer('consultoria_id').references(() => consultorias.id),
  municipalityId: integer('municipality_id').references(() => municipalities.id),
  status: text('status').notNull().default('received'),
  rowsTotal: integer('rows_total').default(0),
  rowsOk: integer('rows_ok').default(0),
  rowsRejected: integer('rows_rejected').default(0),
  errors: jsonb('errors').default([]),
  metadata: jsonb('metadata').default({}),
  startedAt: timestamp('started_at').defaultNow(),
  finishedAt: timestamp('finished_at'),
});

// raw.import_rows
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

// fundeb.wizard_progress
import { fundebSchema } from './schema';

export const wizardProgress = fundebSchema.table('wizard_progress', {
  id: serial('id').primaryKey(),
  consultoriaId: integer('consultoria_id')
    .notNull()
    .references(() => consultorias.id, { onDelete: 'cascade' }),
  step: integer('step').notNull(),
  status: text('status').notNull().default('available'),
  payload: jsonb('payload').default({}),
  blockReason: text('block_reason'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// fundeb.scenarios
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

// fundeb.approvals
export const approvals = fundebSchema.table('approvals', {
  id: serial('id').primaryKey(),
  documentId: integer('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  requestedBy: text('requested_by').notNull(),
  requestedAt: timestamp('requested_at').defaultNow(),
  decidedBy: text('decided_by'),
  decidedAt: timestamp('decided_at'),
  decision: text('decision'),
  comment: text('comment'),
  documentVersion: integer('document_version').notNull(),
});

// fundeb.evidences
export const evidences = fundebSchema.table('evidences', {
  id: serial('id').primaryKey(),
  consultoriaId: integer('consultoria_id')
    .notNull()
    .references(() => consultorias.id, { onDelete: 'cascade' }),
  entityType: text('entity_type').notNull(),
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

// audit.event_log
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

// audit.snapshots
export const auditSnapshots = auditSchema.table('snapshots', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  consultoriaId: integer('consultoria_id').notNull(),
  payload: jsonb('payload').notNull(),
  hash: text('hash').notNull(),
  signedAt: timestamp('signed_at').notNull().defaultNow(),
  signedBy: text('signed_by').notNull(),
  reason: text('reason'),
});
```

---

## 7. Mapeamento UC ↔ Tabela

| Caso de Uso | Tabela(s) |
|---|---|
| UC-ES.01 | `fundeb.consultorias` |
| UC-ES.02 | `fundeb.wizard_progress` |
| UC-ES.04 | `fundeb.compliance_items` + `fundeb.evidences` |
| UC-ES.05 | `fundeb.documents` |
| UC-ES.06 | `audit.snapshots` |
| UC-P1.01 | `raw.imports`, `raw.import_rows` |
| UC-P1.02 | `raw.import_rows`, `fundeb.enrollments`, `raw.lineage` |
| UC-P1.04 | `fundeb.evidences` |
| UC-P2.03 | `fundeb.scenarios` |
| UC-P2.05 | `fundeb.documents` (+ trigger versionar) |
| UC-GE.03 | `fundeb.approvals` |
| UC-AU.01 | `audit.event_log` |
| UC-AU.02 | `audit.event_log` + `fundeb.approvals` |
| UC-AU.03 | `fundeb.documents` (com versão) + `audit.event_log` |
| UC-AU.05 | `audit.snapshots` |
| UC-AU.07 | `audit.snapshots.hash` |
| UC-AU.08 | `raw.lineage` |

---

## 8. Considerações de Operação

- **Imutabilidade**: triggers em `audit.event_log` e `audit.snapshots` impedem `UPDATE`/`DELETE`. A correção de erros se dá por **novo evento compensatório**, nunca por edição do log.
- **Refresh das views**: as `MATERIALIZED VIEW` em `ops.*` são atualizadas pela SP `sp_recalcular_potencial` e por `REFRESH MATERIALIZED VIEW CONCURRENTLY` agendado.
- **Hash de snapshot**: `sha256` sobre o JSONB canônico (chaves ordenadas) — calculado no app e gravado no banco.
- **Idempotência**: todo o DDL usa `IF NOT EXISTS` para permitir reaplicação.
- **Lineage opcional**: `raw.lineage` pode ser preenchido só para os 645 municípios estratégicos no início, e expandido depois.

---

## 9. Próximos artefatos

- `STORED-PROCEDURES.md` — implementação SQL/PLPGSQL das SPs que operam sobre estas tabelas.
- `WIZARD-ESQUELETO.md` *(opcional)* — guia de implementação Onda 1 (já entregue como código no PR do esqueleto).
