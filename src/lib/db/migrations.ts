// Onda 2 - Migracoes do blueprint wizard FUNDEB
// Referencia: docs/blueprint/DATA-MODEL-DELTAS.md e STORED-PROCEDURES.md
//
// Cada entrada e um statement SQL idempotente que pode ser re-executado com seguranca.
// Ordem importa: schemas -> tabelas -> indices -> triggers -> views -> SPs.

export const DDL_STATEMENTS: readonly string[] = [
  // ── Schemas ─────────────────────────────────────────────────────────────
  `CREATE SCHEMA IF NOT EXISTS raw`,
  `CREATE SCHEMA IF NOT EXISTS audit`,
  `CREATE SCHEMA IF NOT EXISTS ops`,

  // Extensao necessaria para sp_snapshot_sessao (digest/sha256)
  `CREATE EXTENSION IF NOT EXISTS pgcrypto`,

  // ── raw.imports ─────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS raw.imports (
    id              BIGSERIAL PRIMARY KEY,
    source          TEXT NOT NULL,
    filename        TEXT,
    content_hash    TEXT NOT NULL,
    mime_type       TEXT,
    size_bytes      BIGINT,
    uploaded_by     TEXT,
    consultoria_id  INTEGER REFERENCES fundeb.consultorias(id) ON DELETE SET NULL,
    municipality_id INTEGER REFERENCES fundeb.municipalities(id) ON DELETE SET NULL,
    status          TEXT NOT NULL DEFAULT 'received',
    rows_total      INTEGER DEFAULT 0,
    rows_ok         INTEGER DEFAULT 0,
    rows_rejected   INTEGER DEFAULT 0,
    errors          JSONB DEFAULT '[]'::jsonb,
    metadata        JSONB DEFAULT '{}'::jsonb,
    started_at      TIMESTAMP DEFAULT NOW(),
    finished_at     TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_raw_imports_consultoria ON raw.imports(consultoria_id)`,
  `CREATE INDEX IF NOT EXISTS idx_raw_imports_municipality ON raw.imports(municipality_id)`,
  `CREATE INDEX IF NOT EXISTS idx_raw_imports_status ON raw.imports(status)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_raw_imports_hash ON raw.imports(content_hash)`,

  // ── raw.import_rows ─────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS raw.import_rows (
    id           BIGSERIAL PRIMARY KEY,
    import_id    BIGINT NOT NULL REFERENCES raw.imports(id) ON DELETE CASCADE,
    row_index    INTEGER NOT NULL,
    payload      JSONB NOT NULL,
    is_valid     BOOLEAN DEFAULT NULL,
    errors       JSONB DEFAULT '[]'::jsonb,
    treated_at   TIMESTAMP,
    cataloged_at TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_raw_import_rows_import ON raw.import_rows(import_id)`,
  `CREATE INDEX IF NOT EXISTS idx_raw_import_rows_valid ON raw.import_rows(is_valid)`,

  // ── raw.lineage ─────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS raw.lineage (
    id            BIGSERIAL PRIMARY KEY,
    target_schema TEXT NOT NULL,
    target_table  TEXT NOT NULL,
    target_id     BIGINT NOT NULL,
    raw_row_id    BIGINT REFERENCES raw.import_rows(id) ON DELETE SET NULL,
    import_id     BIGINT REFERENCES raw.imports(id) ON DELETE SET NULL,
    created_at    TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_lineage_target ON raw.lineage(target_schema, target_table, target_id)`,
  `CREATE INDEX IF NOT EXISTS idx_lineage_raw_row ON raw.lineage(raw_row_id)`,

  // ── fundeb.wizard_progress ──────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS fundeb.wizard_progress (
    id             SERIAL PRIMARY KEY,
    consultoria_id INTEGER NOT NULL REFERENCES fundeb.consultorias(id) ON DELETE CASCADE,
    step           INTEGER NOT NULL,
    status         TEXT NOT NULL DEFAULT 'available',
    payload        JSONB DEFAULT '{}'::jsonb,
    block_reason   TEXT,
    started_at     TIMESTAMP,
    completed_at   TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_wizard_progress_step ON fundeb.wizard_progress(consultoria_id, step)`,
  `CREATE INDEX IF NOT EXISTS idx_wizard_progress_consultoria ON fundeb.wizard_progress(consultoria_id)`,

  // ── fundeb.scenarios ────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS fundeb.scenarios (
    id             SERIAL PRIMARY KEY,
    consultoria_id INTEGER NOT NULL REFERENCES fundeb.consultorias(id) ON DELETE CASCADE,
    nome           TEXT NOT NULL,
    is_target      BOOLEAN DEFAULT FALSE,
    parametros     JSONB NOT NULL,
    resultado      JSONB,
    created_by     TEXT,
    created_at     TIMESTAMP DEFAULT NOW(),
    updated_at     TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_scenarios_consultoria ON fundeb.scenarios(consultoria_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_scenarios_target_per_consultoria
     ON fundeb.scenarios(consultoria_id) WHERE is_target = TRUE`,

  // ── fundeb.approvals ────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS fundeb.approvals (
    id               SERIAL PRIMARY KEY,
    document_id      INTEGER NOT NULL REFERENCES fundeb.documents(id) ON DELETE CASCADE,
    requested_by     TEXT NOT NULL,
    requested_at     TIMESTAMP DEFAULT NOW(),
    decided_by       TEXT,
    decided_at       TIMESTAMP,
    decision         TEXT,
    comment          TEXT,
    document_version INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_approvals_document ON fundeb.approvals(document_id)`,
  `CREATE INDEX IF NOT EXISTS idx_approvals_decision ON fundeb.approvals(decision)`,

  // ── fundeb.evidences ────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS fundeb.evidences (
    id             SERIAL PRIMARY KEY,
    consultoria_id INTEGER NOT NULL REFERENCES fundeb.consultorias(id) ON DELETE CASCADE,
    entity_type    TEXT NOT NULL,
    entity_id      INTEGER NOT NULL,
    url            TEXT,
    storage_key    TEXT,
    filename       TEXT,
    mime_type      TEXT,
    content_hash   TEXT,
    size_bytes     BIGINT,
    uploaded_by    TEXT,
    uploaded_at    TIMESTAMP DEFAULT NOW(),
    notes          TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_evidences_entity ON fundeb.evidences(entity_type, entity_id)`,
  `CREATE INDEX IF NOT EXISTS idx_evidences_consultoria ON fundeb.evidences(consultoria_id)`,

  // ── audit.event_log ─────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS audit.event_log (
    id             BIGSERIAL PRIMARY KEY,
    ts             TIMESTAMP NOT NULL DEFAULT NOW(),
    actor_id       TEXT NOT NULL,
    actor_role     TEXT,
    action         TEXT NOT NULL,
    entity_type    TEXT NOT NULL,
    entity_id      BIGINT,
    consultoria_id INTEGER REFERENCES fundeb.consultorias(id) ON DELETE SET NULL,
    before_state   JSONB,
    after_state    JSONB,
    context        JSONB DEFAULT '{}'::jsonb,
    request_id     TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_event_log_consultoria ON audit.event_log(consultoria_id)`,
  `CREATE INDEX IF NOT EXISTS idx_event_log_entity ON audit.event_log(entity_type, entity_id)`,
  `CREATE INDEX IF NOT EXISTS idx_event_log_action ON audit.event_log(action)`,
  `CREATE INDEX IF NOT EXISTS idx_event_log_ts ON audit.event_log(ts DESC)`,

  // Trigger de imutabilidade para event_log e snapshots
  `CREATE OR REPLACE FUNCTION audit.event_log_immutable() RETURNS trigger AS $IMM$
BEGIN
  RAISE EXCEPTION 'audit log is append-only';
END;
$IMM$ LANGUAGE plpgsql`,

  `DROP TRIGGER IF EXISTS trg_event_log_no_update ON audit.event_log`,
  `CREATE TRIGGER trg_event_log_no_update
    BEFORE UPDATE OR DELETE ON audit.event_log
    FOR EACH ROW EXECUTE FUNCTION audit.event_log_immutable()`,

  // ── audit.snapshots ─────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS audit.snapshots (
    id             BIGSERIAL PRIMARY KEY,
    consultoria_id INTEGER NOT NULL REFERENCES fundeb.consultorias(id),
    payload        JSONB NOT NULL,
    hash           TEXT NOT NULL,
    signed_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    signed_by      TEXT NOT NULL,
    reason         TEXT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_snapshots_hash ON audit.snapshots(hash)`,
  `CREATE INDEX IF NOT EXISTS idx_snapshots_consultoria ON audit.snapshots(consultoria_id)`,
  `DROP TRIGGER IF EXISTS trg_snapshots_no_update ON audit.snapshots`,
  `CREATE TRIGGER trg_snapshots_no_update
    BEFORE UPDATE OR DELETE ON audit.snapshots
    FOR EACH ROW EXECUTE FUNCTION audit.event_log_immutable()`,

  // ── ops.* materialized views ────────────────────────────────────────────
  // Refs docs/blueprint/DATA-MODEL-DELTAS.md secao 4. Usa colunas declaradas
  // no blueprint; se alguma nao existir ainda no estrutural, a view falha e
  // e ignorada via try/catch na migrate route.
  `CREATE MATERIALIZED VIEW IF NOT EXISTS ops.v_consultoria_kpis AS
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
    ) plan ON plan.municipality_id = c.municipality_id`,

  `CREATE UNIQUE INDEX IF NOT EXISTS uq_ops_consultoria_kpis
     ON ops.v_consultoria_kpis(consultoria_id)`,

  `CREATE MATERIALIZED VIEW IF NOT EXISTS ops.v_compliance_progresso AS
    SELECT
      municipality_id,
      section,
      section_name,
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
      ROUND(100.0 * SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0)) AS pct
    FROM fundeb.compliance_items
    GROUP BY municipality_id, section, section_name`,

  `CREATE INDEX IF NOT EXISTS idx_ops_compliance_muni
     ON ops.v_compliance_progresso(municipality_id)`,

  `CREATE MATERIALIZED VIEW IF NOT EXISTS ops.v_potencial_categoria AS
    SELECT
      e.municipality_id,
      e.categoria,
      e.categoria_label,
      e.fator_vaaf,
      e.quantidade,
      e.ativa,
      (5963 * e.fator_vaaf) AS valor_por_aluno,
      CASE WHEN e.ativa = FALSE THEN 1 ELSE 0 END AS ordem_inativa
    FROM fundeb.enrollments e`,

  `CREATE INDEX IF NOT EXISTS idx_ops_pot_cat_muni
     ON ops.v_potencial_categoria(municipality_id)`,
];

// ── Stored Procedures ─────────────────────────────────────────────────────
// Cada entrada e um CREATE OR REPLACE completo. Usam tags de dollar-quoting
// nomeadas ($BODY$...$BODY$) para nao colidir com `$$` interno.
export const SP_STATEMENTS: readonly string[] = [
  // 1. fundeb.sp_recalcular_potencial
  `CREATE OR REPLACE PROCEDURE fundeb.sp_recalcular_potencial(p_municipality_id INTEGER)
LANGUAGE plpgsql AS $BODY$
DECLARE
  v_receita_atual  REAL;
  v_pot_total      REAL := 0;
  v_n_faltantes    INTEGER := 0;
  v_cats           JSONB := '[]'::jsonb;
  v_potencial      JSONB := '[]'::jsonb;
  r                RECORD;
BEGIN
  SELECT receita_total INTO v_receita_atual
  FROM fundeb.municipalities WHERE id = p_municipality_id;

  FOR r IN
    SELECT categoria, categoria_label, fator_vaaf, quantidade, ativa
    FROM fundeb.enrollments
    WHERE municipality_id = p_municipality_id
  LOOP
    IF r.ativa IS FALSE OR r.quantidade IS NULL OR r.quantidade = 0 THEN
      v_n_faltantes := v_n_faltantes + 1;
      v_pot_total := v_pot_total + (5963 * r.fator_vaaf * 10);
      v_potencial := v_potencial || jsonb_build_object(
        'categoria', r.categoria,
        'label', r.categoria_label,
        'fator', r.fator_vaaf,
        'estimado_min', 5963 * r.fator_vaaf * 10
      );
    END IF;
    v_cats := v_cats || jsonb_build_object(
      'categoria', r.categoria,
      'quantidade', COALESCE(r.quantidade,0),
      'ativa', COALESCE(r.ativa,false)
    );
  END LOOP;

  UPDATE fundeb.municipalities
     SET pot_total = v_pot_total,
         pct_pot_total = CASE WHEN COALESCE(v_receita_atual,0) > 0
                              THEN ROUND((v_pot_total / v_receita_atual)::numeric * 100, 2)
                              ELSE 0 END,
         n_faltantes = v_n_faltantes,
         cats = v_cats,
         potencial = v_potencial,
         updated_at = NOW()
   WHERE id = p_municipality_id;

  INSERT INTO audit.event_log (actor_id, actor_role, action, entity_type, entity_id, after_state)
  VALUES ('system', 'sistema', 'recalculo.potencial', 'municipality', p_municipality_id,
          jsonb_build_object('pot_total', v_pot_total, 'n_faltantes', v_n_faltantes));

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY ops.v_consultoria_kpis;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END;
$BODY$`,

  // 2. fundeb.sp_atualizar_compliance
  `CREATE OR REPLACE PROCEDURE fundeb.sp_atualizar_compliance(p_consultoria_id INTEGER)
LANGUAGE plpgsql AS $BODY$
DECLARE
  v_municipality_id INTEGER;
  v_pct INTEGER;
BEGIN
  SELECT municipality_id INTO v_municipality_id
  FROM fundeb.consultorias WHERE id = p_consultoria_id;

  IF v_municipality_id IS NULL THEN
    RAISE EXCEPTION 'Consultoria % nao encontrada', p_consultoria_id;
  END IF;

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY ops.v_compliance_progresso;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW ops.v_compliance_progresso;
  END;

  SELECT ROUND(100.0 * SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0))
    INTO v_pct
    FROM fundeb.compliance_items
   WHERE municipality_id = v_municipality_id;

  INSERT INTO audit.event_log (actor_id, actor_role, action, entity_type, entity_id, consultoria_id, after_state)
  VALUES ('system', 'sistema', 'compliance.recalculado', 'consultoria', p_consultoria_id, p_consultoria_id,
          jsonb_build_object('pct_total', COALESCE(v_pct,0)));
END;
$BODY$`,

  // 3. fundeb.sp_consolidar_plano_acao
  `CREATE OR REPLACE PROCEDURE fundeb.sp_consolidar_plano_acao(
  p_consultoria_id INTEGER,
  INOUT p_resultado JSONB DEFAULT NULL
) LANGUAGE plpgsql AS $BODY$
DECLARE
  v_municipality_id INTEGER;
BEGIN
  SELECT municipality_id INTO v_municipality_id
  FROM fundeb.consultorias WHERE id = p_consultoria_id;

  SELECT jsonb_build_object(
    'curto', jsonb_build_object(
      'total', COUNT(*) FILTER (WHERE phase='curto'),
      'done',  COUNT(*) FILTER (WHERE phase='curto' AND status='done')
    ),
    'medio', jsonb_build_object(
      'total', COUNT(*) FILTER (WHERE phase='medio'),
      'done',  COUNT(*) FILTER (WHERE phase='medio' AND status='done')
    ),
    'longo', jsonb_build_object(
      'total', COUNT(*) FILTER (WHERE phase='longo'),
      'done',  COUNT(*) FILTER (WHERE phase='longo' AND status='done')
    ),
    'total_pct', ROUND(100.0 * SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0))
  )
  INTO p_resultado
  FROM fundeb.action_plans
  WHERE municipality_id = v_municipality_id;

  INSERT INTO audit.event_log (actor_id, actor_role, action, entity_type, entity_id, consultoria_id, after_state)
  VALUES ('system', 'sistema', 'plano.consolidado', 'consultoria', p_consultoria_id, p_consultoria_id, p_resultado);
END;
$BODY$`,

  // 4. fundeb.sp_gerar_minuta
  `CREATE OR REPLACE FUNCTION fundeb.sp_gerar_minuta(
  p_consultoria_id INTEGER,
  p_tipo TEXT
) RETURNS INTEGER
LANGUAGE plpgsql AS $BODY$
DECLARE
  v_municipality_id INTEGER;
  v_municipio       TEXT;
  v_titulo          TEXT;
  v_html            TEXT;
  v_doc_id          INTEGER;
BEGIN
  IF p_tipo NOT IN ('minuta_cme','curriculo_bncc','resolucao','decreto') THEN
    RAISE EXCEPTION 'Tipo de minuta desconhecido: %', p_tipo;
  END IF;

  SELECT c.municipality_id, m.nome
    INTO v_municipality_id, v_municipio
    FROM fundeb.consultorias c
    JOIN fundeb.municipalities m ON m.id = c.municipality_id
   WHERE c.id = p_consultoria_id;

  IF v_municipio IS NULL THEN
    RAISE EXCEPTION 'Consultoria % sem municipio', p_consultoria_id;
  END IF;

  v_titulo := CASE p_tipo
    WHEN 'minuta_cme'      THEN 'Minuta de Resolucao CME - BNCC Computacao - ' || v_municipio
    WHEN 'curriculo_bncc'  THEN 'Curriculo BNCC Computacao - ' || v_municipio
    WHEN 'resolucao'       THEN 'Resolucao FUNDEB - ' || v_municipio
    WHEN 'decreto'         THEN 'Decreto Municipal FUNDEB - ' || v_municipio
  END;

  v_html := '<h1>' || v_titulo || '</h1>'
         || '<p>O Municipio de <strong>' || v_municipio || '</strong>, no exercicio de suas competencias '
         || 'constitucionais e em conformidade com a EC 108/2020, FUNDEB Permanente, e EC 135/2025...</p>'
         || '<h2>Art. 1.</h2><p>[CONTEUDO]</p>'
         || '<h2>Art. 2.</h2><p>[CONTEUDO]</p>'
         || '<p><em>Gerado automaticamente em ' || NOW()::date || '</em></p>';

  INSERT INTO fundeb.documents (municipality_id, tipo, titulo, conteudo, status, versao)
  VALUES (v_municipality_id, p_tipo, v_titulo, v_html, 'rascunho', 1)
  RETURNING id INTO v_doc_id;

  INSERT INTO audit.event_log (actor_id, actor_role, action, entity_type, entity_id, consultoria_id, after_state)
  VALUES ('system', 'sistema', 'document.generated', 'document', v_doc_id, p_consultoria_id,
          jsonb_build_object('tipo', p_tipo, 'titulo', v_titulo));

  RETURN v_doc_id;
END;
$BODY$`,

  // 5. audit.sp_audit_log
  `CREATE OR REPLACE FUNCTION audit.sp_audit_log(
  p_actor_id       TEXT,
  p_actor_role     TEXT,
  p_action         TEXT,
  p_entity_type    TEXT,
  p_entity_id      BIGINT,
  p_consultoria_id INTEGER,
  p_before         JSONB,
  p_after          JSONB,
  p_context        JSONB DEFAULT '{}'::jsonb,
  p_request_id     TEXT DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql AS $BODY$
DECLARE
  v_id BIGINT;
BEGIN
  INSERT INTO audit.event_log (
    actor_id, actor_role, action, entity_type, entity_id, consultoria_id,
    before_state, after_state, context, request_id
  ) VALUES (
    p_actor_id, p_actor_role, p_action, p_entity_type, p_entity_id, p_consultoria_id,
    p_before, p_after, p_context, p_request_id
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$BODY$`,

  // 6. audit.sp_snapshot_sessao
  `CREATE OR REPLACE FUNCTION audit.sp_snapshot_sessao(
  p_consultoria_id INTEGER,
  p_signed_by      TEXT,
  p_reason         TEXT DEFAULT 'closing'
) RETURNS BIGINT
LANGUAGE plpgsql AS $BODY$
DECLARE
  v_payload  JSONB;
  v_hash     TEXT;
  v_existing BIGINT;
  v_id       BIGINT;
BEGIN
  SELECT jsonb_build_object(
    'consultoria',   to_jsonb(c.*),
    'municipality',  to_jsonb(m.*),
    'compliance',    COALESCE(jsonb_agg(DISTINCT ci.*) FILTER (WHERE ci.id IS NOT NULL), '[]'::jsonb),
    'action_plans',  COALESCE(jsonb_agg(DISTINCT ap.*) FILTER (WHERE ap.id IS NOT NULL), '[]'::jsonb),
    'documents',     COALESCE(jsonb_agg(DISTINCT d.*)  FILTER (WHERE d.id IS NOT NULL),  '[]'::jsonb),
    'scenarios',     COALESCE((SELECT jsonb_agg(s.*) FROM fundeb.scenarios s WHERE s.consultoria_id = c.id), '[]'::jsonb),
    'wizard',        COALESCE((SELECT jsonb_agg(w.*) FROM fundeb.wizard_progress w WHERE w.consultoria_id = c.id), '[]'::jsonb),
    'snapshot_at',   NOW()
  )
  INTO v_payload
  FROM fundeb.consultorias c
  JOIN fundeb.municipalities m ON m.id = c.municipality_id
  LEFT JOIN fundeb.compliance_items ci ON ci.municipality_id = c.municipality_id
  LEFT JOIN fundeb.action_plans ap     ON ap.municipality_id = c.municipality_id
  LEFT JOIN fundeb.documents d         ON d.municipality_id = c.municipality_id
  WHERE c.id = p_consultoria_id
  GROUP BY c.id, m.id;

  IF v_payload IS NULL THEN
    RAISE EXCEPTION 'Consultoria % nao encontrada', p_consultoria_id;
  END IF;

  v_hash := encode(digest(v_payload::text, 'sha256'), 'hex');

  SELECT id INTO v_existing FROM audit.snapshots WHERE hash = v_hash LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  INSERT INTO audit.snapshots (consultoria_id, payload, hash, signed_by, reason)
  VALUES (p_consultoria_id, v_payload, v_hash, p_signed_by, p_reason)
  RETURNING id INTO v_id;

  PERFORM audit.sp_audit_log(
    p_signed_by, 'consultor', 'snapshot.created', 'consultoria',
    p_consultoria_id::bigint, p_consultoria_id, NULL,
    jsonb_build_object('snapshot_id', v_id, 'hash', v_hash, 'reason', p_reason),
    '{}'::jsonb, NULL
  );

  RETURN v_id;
END;
$BODY$`,

  // 7. ops.sp_refresh_ops_views
  `CREATE OR REPLACE PROCEDURE ops.sp_refresh_ops_views()
LANGUAGE plpgsql AS $BODY$
BEGIN
  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY ops.v_consultoria_kpis;     EXCEPTION WHEN OTHERS THEN REFRESH MATERIALIZED VIEW ops.v_consultoria_kpis; END;
  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY ops.v_compliance_progresso; EXCEPTION WHEN OTHERS THEN REFRESH MATERIALIZED VIEW ops.v_compliance_progresso; END;
  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY ops.v_potencial_categoria;  EXCEPTION WHEN OTHERS THEN REFRESH MATERIALIZED VIEW ops.v_potencial_categoria; END;
END;
$BODY$`,
];
