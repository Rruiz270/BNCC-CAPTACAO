# STORED PROCEDURES — Contratos e Implementação

> Procedures e funções PLPGSQL que sustentam o wizard. Cada uma com: assinatura, contrato (pré/pós), pseudocódigo e implementação SQL completa pronta para `psql`.

## Lista

| # | Nome | Schema | Tipo | Caso de Uso |
|---|---|---|---|---|
| 1 | `sp_recalcular_potencial` | `fundeb` | PROCEDURE | UC-ES.03, UC-SU.02 |
| 2 | `sp_atualizar_compliance` | `fundeb` | PROCEDURE | UC-ES.04 |
| 3 | `sp_consolidar_plano_acao` | `fundeb` | PROCEDURE | UC-PR.06 |
| 4 | `sp_gerar_minuta` | `fundeb` | FUNCTION | UC-ES.05, UC-PR.05 |
| 5 | `sp_audit_log` | `audit` | FUNCTION | UC-AU.01 |
| 6 | `sp_snapshot_sessao` | `audit` | FUNCTION | UC-ES.06, UC-AU.05 |
| 7 | `sp_refresh_ops_views` | `ops` | PROCEDURE | UC-CO.06 |

---

## 1. `fundeb.sp_recalcular_potencial(p_municipality_id INTEGER)`

**Objetivo** Recalcular `pot_total`, `pct_pot_total`, `n_faltantes`, `cats`, `potencial` do município com base nas matrículas (`enrollments`) e nos fatores VAAF do `constants.ts`.

### Contrato
- **Pré**: município existe; `enrollments` carregadas para o município.
- **Pós**: colunas de potencial em `fundeb.municipalities` atualizadas; `audit.event_log` recebe `recalculo.potencial`; views `ops.*` atualizáveis.

### Implementação

```sql
CREATE OR REPLACE PROCEDURE fundeb.sp_recalcular_potencial(p_municipality_id INTEGER)
LANGUAGE plpgsql AS $$
DECLARE
  v_receita_atual  REAL;
  v_pot_total      REAL := 0;
  v_n_faltantes    INTEGER := 0;
  v_cats           JSONB := '[]'::jsonb;
  v_potencial      JSONB := '[]'::jsonb;
  r                RECORD;
BEGIN
  -- Receita atual baseline
  SELECT receita_total INTO v_receita_atual
  FROM fundeb.municipalities WHERE id = p_municipality_id;

  -- Soma do potencial por categoria inativa ou subnotificada
  FOR r IN
    SELECT categoria, categoria_label, fator_vaaf, quantidade, ativa
    FROM fundeb.enrollments
    WHERE municipality_id = p_municipality_id
  LOOP
    IF r.ativa IS FALSE OR r.quantidade IS NULL OR r.quantidade = 0 THEN
      v_n_faltantes := v_n_faltantes + 1;
      v_pot_total := v_pot_total + (5963 * r.fator_vaaf * 10); -- piso simbólico
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

  -- Audit
  INSERT INTO audit.event_log (actor_id, actor_role, action, entity_type, entity_id, after_state)
  VALUES ('system', 'sistema', 'recalculo.potencial', 'municipality', p_municipality_id,
          jsonb_build_object('pot_total', v_pot_total, 'n_faltantes', v_n_faltantes));

  -- Refresh ops view do município (best-effort)
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY ops.v_consultoria_kpis;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END;
$$;
```

> Os valores `*10` no piso simbólico são placeholders. A regra real virá da fórmula VAAF/VAAR/VAAT consolidada.

---

## 2. `fundeb.sp_atualizar_compliance(p_consultoria_id INTEGER)`

**Objetivo** Recalcular o progresso de compliance de uma consultoria após qualquer alteração.

### Contrato
- **Pré**: consultoria existe; `compliance_items` populados (seed feito ao abrir a sessão).
- **Pós**: progresso por seção e total disponível em `ops.v_compliance_progresso`; evento gravado em `audit.event_log`.

### Implementação

```sql
CREATE OR REPLACE PROCEDURE fundeb.sp_atualizar_compliance(p_consultoria_id INTEGER)
LANGUAGE plpgsql AS $$
DECLARE
  v_municipality_id INTEGER;
  v_pct INTEGER;
BEGIN
  SELECT municipality_id INTO v_municipality_id
  FROM fundeb.consultorias WHERE id = p_consultoria_id;

  IF v_municipality_id IS NULL THEN
    RAISE EXCEPTION 'Consultoria % nao encontrada', p_consultoria_id;
  END IF;

  -- Refresh do progresso por seção
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
$$;
```

---

## 3. `fundeb.sp_consolidar_plano_acao(p_consultoria_id INTEGER)`

**Objetivo** Calcular % de progresso por fase (curto/médio/longo) e total do plano.

### Contrato
- **Pré**: consultoria existe; `action_plans` populados.
- **Pós**: retorno do JSON consolidado e evento de auditoria.

### Implementação

```sql
CREATE OR REPLACE PROCEDURE fundeb.sp_consolidar_plano_acao(
  p_consultoria_id INTEGER,
  INOUT p_resultado JSONB DEFAULT NULL
) LANGUAGE plpgsql AS $$
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
$$;
```

---

## 4. `fundeb.sp_gerar_minuta(p_consultoria_id INTEGER, p_tipo TEXT) RETURNS INTEGER`

**Objetivo** Gerar uma minuta a partir de um template com placeholders preenchidos com dados do município. Retorna o `documents.id` criado.

### Contrato
- **Pré**: consultoria existe; existe template para o `tipo` solicitado.
- **Pós**: nova linha em `fundeb.documents` em `status='rascunho'`, versão 1; evento gravado.
- **Exceção**: tipo desconhecido ⇒ `RAISE EXCEPTION`.

### Implementação

```sql
CREATE OR REPLACE FUNCTION fundeb.sp_gerar_minuta(
  p_consultoria_id INTEGER,
  p_tipo TEXT
) RETURNS INTEGER
LANGUAGE plpgsql AS $$
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

  -- Template HTML mínimo com placeholders
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
$$;
```

---

## 5. `audit.sp_audit_log(...)` — helper para o app

**Objetivo** Inserir eventos no log de forma uniforme. O app chama esta função em vez de fazer INSERT direto.

### Contrato
- **Pré**: `actor_id`, `action`, `entity_type` informados.
- **Pós**: linha em `audit.event_log`.

```sql
CREATE OR REPLACE FUNCTION audit.sp_audit_log(
  p_actor_id      TEXT,
  p_actor_role    TEXT,
  p_action        TEXT,
  p_entity_type   TEXT,
  p_entity_id     BIGINT,
  p_consultoria_id INTEGER,
  p_before        JSONB,
  p_after         JSONB,
  p_context       JSONB DEFAULT '{}'::jsonb,
  p_request_id    TEXT DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql AS $$
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
$$;
```

---

## 6. `audit.sp_snapshot_sessao(p_consultoria_id INTEGER, p_signed_by TEXT, p_reason TEXT) RETURNS BIGINT`

**Objetivo** Congelar o estado completo da consultoria, calcular hash e gravar em `audit.snapshots`. Retorna `snapshots.id`.

### Contrato
- **Pré**: consultoria existe.
- **Pós**: snapshot gravado, hash único, evento de auditoria.
- **Exceção**: hash duplicado ⇒ retorna o id existente sem duplicar.

### Implementação

```sql
CREATE OR REPLACE FUNCTION audit.sp_snapshot_sessao(
  p_consultoria_id INTEGER,
  p_signed_by      TEXT,
  p_reason         TEXT DEFAULT 'closing'
) RETURNS BIGINT
LANGUAGE plpgsql AS $$
DECLARE
  v_payload  JSONB;
  v_hash     TEXT;
  v_existing BIGINT;
  v_id       BIGINT;
BEGIN
  -- Monta o payload canônico
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

  -- Hash canônico (sha256 em hex)
  v_hash := encode(digest(v_payload::text, 'sha256'), 'hex');

  -- Se já existir o mesmo hash, devolve o id existente
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
$$;
```

> **Pré-requisito** Habilitar a extensão `pgcrypto` para `digest()`:
> ```sql
> CREATE EXTENSION IF NOT EXISTS pgcrypto;
> ```

---

## 7. `ops.sp_refresh_ops_views()`

**Objetivo** Atualizar todas as materializações de `ops.*` em sequência. Executado por job agendado e por `sp_recalcular_potencial`.

```sql
CREATE OR REPLACE PROCEDURE ops.sp_refresh_ops_views()
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY ops.v_consultoria_kpis;     EXCEPTION WHEN OTHERS THEN REFRESH MATERIALIZED VIEW ops.v_consultoria_kpis; END;
  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY ops.v_compliance_progresso; EXCEPTION WHEN OTHERS THEN REFRESH MATERIALIZED VIEW ops.v_compliance_progresso; END;
  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY ops.v_potencial_categoria;  EXCEPTION WHEN OTHERS THEN REFRESH MATERIALIZED VIEW ops.v_potencial_categoria; END;
END;
$$;
```

---

## 8. Como o app chama as SPs

Pelo cliente Neon serverless dentro de uma API route:

```ts
// exemplo: /api/wizard/[id]/recalcular-potencial
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL!);

await sql`CALL fundeb.sp_recalcular_potencial(${municipalityId})`;
const docId = await sql`SELECT fundeb.sp_gerar_minuta(${consultoriaId}, ${tipo}) AS id`;
const snapId = await sql`SELECT audit.sp_snapshot_sessao(${consultoriaId}, ${userEmail}, 'closing') AS id`;
```

---

## 9. Roteiro de testes mínimos

| Caso | Cenário | Esperado |
|---|---|---|
| 1 | `sp_recalcular_potencial` para município sem enrollments | `pot_total = 0`, `n_faltantes = 0` |
| 2 | `sp_recalcular_potencial` com 3 categorias inativas | `n_faltantes = 3`, `pot_total > 0` |
| 3 | `sp_atualizar_compliance` em consultoria recém-criada | `pct_total = 0` no log |
| 4 | `sp_consolidar_plano_acao` com 1 tarefa concluída | `done = 1` na fase respectiva |
| 5 | `sp_gerar_minuta` com tipo inválido | `RAISE EXCEPTION` |
| 6 | `sp_gerar_minuta('minuta_cme')` duas vezes | dois `documents.id` distintos |
| 7 | `sp_snapshot_sessao` com mesmo estado | retorna o mesmo id (hash dedup) |
| 8 | Tentativa de `UPDATE audit.event_log` | `EXCEPTION 'append-only'` |

---

## 10. Próximos passos

- Implementar a Onda 1 (esqueleto wizard) — reuso destas SPs nas API routes do app.
- Após Onda 1 estar verde, criar `WIZARD-ESQUELETO.md` apenas como changelog do que foi entregue.
