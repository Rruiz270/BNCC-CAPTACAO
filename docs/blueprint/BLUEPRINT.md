# BLUEPRINT — Plataforma BNCC-CAPTAÇÃO (Wizard de Consultoria FUNDEB SP 2026)

> Documento mestre. Reformula a plataforma atual em um **fluxo wizard** dirigido por sessão de consultoria, alinhado à arquitetura desenhada no quadro branco (Cidade → ETL → Banco Estrutural → Stored Procedures → Banco Operacional → Compliance/Funções/Dashboard → Outputs).

---

## 1. Motivação

A versão atual expõe ~20 rotas paralelas (Dashboard, Diagnóstico, Compliance, Plano de Ação, Implementação, etc.). Para o consultor, isso é uma "biblioteca de telas" sem fluxo natural. **Não dá segurança para entrar no município, executar a consultoria de ponta a ponta e entregar o resultado.**

A reformulação para **wizard** define um caminho linear, validável, auditável e re-entrante: o consultor entra, escolhe a cidade, e é guiado etapa-a-etapa até a publicação dos documentos oficiais e o acompanhamento de execução.

---

## 2. Arquitetura (transcrição do whiteboard)

```
                          ┌──────── WIZARD ────────┐
   ┌─────────┐            │  ┌──┐  ┌──┐  ┌──┐  ┌──┐│            ┌─────────────┐
   │ CIDADE  │────────────▶│  │ 1│→│ 2│→│ 3│→│ 4││────────────▶│   Banco de  │
   └─────────┘            │  └──┘  └──┘  └──┘  └──┘│            │   Dados     │
                          └────────────────────────┘            │ Estrutural  │
                                       ▲                         └─────────────┘
                                       │                                │
                              ┌────────┴────────┐                       │
                              │ Banco de Dados  │              ┌────────▼────────┐
                              │     BRUTO       │              │     STORED      │
                              └────────┬────────┘              │   PROCEDURES    │
                                       │                       └────────┬────────┘
                                ┌──────┴──────┐                          │
                                │ 1- Extração │                          ▼
                                │ 2- Treat    │              ┌─────────────────────┐
                                │ 3- Catalog  │              │ Banco de Dados      │
                                └─────────────┘              │ OPERACIONAL         │
                                                             └──────────┬──────────┘
                                                                        │
                                              ┌─────────────────────────┼──────────────────────────┐
                                              ▼                         ▼                          ▼
                                     ┌─────────────┐          ┌───────────────┐          ┌─────────────┐
                                     │ COMPLIANCE  │          │   FUNÇÕES     │          │  DASHBOARD  │
                                     └─────────────┘          └───────┬───────┘          └─────────────┘
                                                                      │
                                                       ┌──────────────┼──────────────┐
                                                       ▼              ▼              ▼
                                                  ┌────────┐    ┌─────────┐   ┌─────────────┐
                                                  │ DIÁRIO │    │ DECRETO │   │  RESOLUÇÃO  │
                                                  └────────┘    └─────────┘   └─────────────┘
```

### 2.1 Camadas de dados

| Camada | Conteúdo | Origem | Read/Write |
|---|---|---|---|
| **BRUTO** (`raw.*`) | CSVs do INEP, SIOPE, FNDE, Censo Escolar, IBGE, planilhas fornecidas pelo município, snapshots WEB | Importação manual + ingestão automatizada | write-once, append-only |
| **ESTRUTURAL** (`fundeb.*`) | Tabelas normalizadas (`municipalities`, `enrollments`, `schools`, etc.) com tipos validados | ETL: Extração → Treat → Catalog | atualizado por carga |
| **OPERACIONAL** (`ops.*`) | Visões/materializações para consumo do app — métricas, semáforos, KPIs, agregações por sessão | Stored Procedures sobre o estrutural | read-mostly |

### 2.2 Stored Procedures-chave

- `sp_recalcular_potencial(municipality_id)` — recalcula `potTotal`, `pctPotTotal`, `nFaltantes`, `cats`, `potencial`
- `sp_atualizar_compliance(consultoria_id)` — propaga mudanças de itens para % por seção e total
- `sp_consolidar_plano_acao(consultoria_id)` — consolida progresso curto/médio/longo
- `sp_gerar_minuta(consultoria_id, tipo)` — popula template HTML de minuta CME / decreto / resolução
- `sp_audit_log(actor_id, action, payload_jsonb)` — registro imutável de auditoria
- `sp_snapshot_sessao(consultoria_id)` — congela estado da consultoria para entrega

---

## 3. Atores

| Ator | Descrição | Permissões-chave |
|---|---|---|
| **Consultor i10** | Operador principal. Conduz o wizard município-a-município | criar/conduzir/encerrar sessões; editar tudo da sessão |
| **Coordenador i10** | Gestão de carteira de consultorias | dashboard de carteira, reatribuição, aprovação de minutas |
| **Auditor / Compliance** | Verifica integridade, evidências, cadeia de aprovação | leitura ampla + acesso ao audit log |
| **Cliente Municipal (Secretário/Equipe)** | Visualização e fornecimento de evidências | leitura da sua sessão, upload de evidências |
| **Sistema (jobs)** | Cargas automáticas, recálculos, alertas | execução de SPs e jobs agendados |

---

## 4. Casos de Uso

> Numeração: `UC-XX.NN` onde XX é a categoria. Cada UC traz: ator, pré-condição, fluxo, pós-condição, exceções e telas envolvidas.

### 4.1 Essenciais (UC-ES) — sem eles a plataforma não existe

| ID | Caso de Uso | Ator | Pré-condição | Resultado |
|---|---|---|---|---|
| **UC-ES.01** | Selecionar município e abrir consultoria | Consultor | Município existente no `fundeb.municipalities` | Sessão `consultorias` criada (`status=active`) e wizard inicia no Step 1 |
| **UC-ES.02** | Persistir avanço do wizard entre etapas | Consultor / Sistema | Sessão ativa | `wizard_progress` salvo + retomada possível em qualquer etapa |
| **UC-ES.03** | Calcular potencial de captação | Sistema | Dados estruturais carregados | `potTotal`, `pctPotTotal`, ranking de categorias subnotificadas |
| **UC-ES.04** | Registrar conformidade item-a-item | Consultor | Sessão ativa | `compliance_items` atualizado + % recalculado |
| **UC-ES.05** | Gerar documento oficial (minuta/decreto/resolução) | Consultor | Currículo/Compliance preenchidos | `documents` criado em status `rascunho` |
| **UC-ES.06** | Encerrar consultoria e congelar entrega | Consultor | Etapas obrigatórias concluídas | Snapshot imutável + `status=completed` |

### 4.2 Principais (UC-PR) — usados em todo atendimento

| ID | Caso de Uso | Descrição |
|---|---|---|
| **UC-PR.01** | Diagnosticar município | Mostrar receita FUNDEB, ganho/perda, top categorias com lacuna, IDEB/SAEB, infraestrutura |
| **UC-PR.02** | Identificar gaps de matrícula por categoria | Comparar matrículas reais × esperadas; listar categorias inativas com VAAF alto |
| **UC-PR.03** | Simular cenário de reclassificação | Slider de matrículas por categoria → impacto em VAAF/VAAR/VAAT/receita |
| **UC-PR.04** | Construir plano de ação curto/médio/longo | Selecionar tarefas dos templates `ACTION_PLAN_*`, atribuir responsáveis e prazos |
| **UC-PR.05** | Preparar minuta CME (BNCC Computação) | Personalizar template HTML por município, validar contra checklist |
| **UC-PR.06** | Acompanhar execução semanal (7 semanas até Censo) | Marcar tarefas, anexar evidências, recalcular % |
| **UC-PR.07** | Gerar relatório executivo da sessão | PDF consolidado com diagnóstico, plano, compliance, projeção |

### 4.3 Primários (UC-P1) — disparados pelo usuário no wizard

| ID | Caso de Uso |
|---|---|
| **UC-P1.01** | Importar CSV (matrículas, escolas, docentes, FUNDEB) |
| **UC-P1.02** | Validar e categorizar matrículas (atribuir VAAF) |
| **UC-P1.03** | Editar item de compliance (status, evidência, nota) |
| **UC-P1.04** | Anexar documento de evidência (URL ou upload) |
| **UC-P1.05** | Ajustar parâmetros da simulação |
| **UC-P1.06** | Exportar minuta (HTML / DOCX / PDF) |
| **UC-P1.07** | Comparar 2 ou mais municípios lado a lado |

### 4.4 Secundários (UC-P2) — apoiam os primários

| ID | Caso de Uso |
|---|---|
| **UC-P2.01** | Buscar município por nome ou código IBGE |
| **UC-P2.02** | Filtrar consultorias por status, região, % de progresso |
| **UC-P2.03** | Salvar simulação como cenário nomeado |
| **UC-P2.04** | Duplicar plano de ação de outro município similar |
| **UC-P2.05** | Versionar minuta (rascunho → aprovado → publicado) |
| **UC-P2.06** | Definir responsável por tarefa |

### 4.5 Auxiliares (UC-AX) — facilitam o trabalho

| ID | Caso de Uso |
|---|---|
| **UC-AX.01** | Tooltips contextuais sobre fórmulas (VAAF, VAAR, VAAT) |
| **UC-AX.02** | Auto-sugerir tarefas com base no diagnóstico |
| **UC-AX.03** | Auto-preencher campos da minuta a partir do cadastro |
| **UC-AX.04** | Calcular dias restantes até cada deadline (27/05, 31/08, 31/12) |
| **UC-AX.05** | Indicador de "frescor do dado" (última carga ETL) |
| **UC-AX.06** | Sugerir municípios similares para benchmark |

### 4.6 De Exceção (UC-EX) — caminhos quando algo falha

| ID | Caso de Uso |
|---|---|
| **UC-EX.01** | CSV inválido / colunas faltantes na importação |
| **UC-EX.02** | Cálculo de potencial sem dados suficientes (categorias zeradas) |
| **UC-EX.03** | Tentativa de encerrar sessão com etapas obrigatórias incompletas |
| **UC-EX.04** | Conflito de edição (dois consultores na mesma sessão) |
| **UC-EX.05** | Documento gerado sem placeholders preenchidos |
| **UC-EX.06** | Falha de conexão com Neon (Postgres serverless) |
| **UC-EX.07** | Tentativa de publicar documento sem aprovação prévia |
| **UC-EX.08** | Município sem dados estruturais (não veio na carga base) |

### 4.7 De Suporte (UC-SU) — operações de apoio

| ID | Caso de Uso |
|---|---|
| **UC-SU.01** | Reexecutar ETL para um município (Extração → Treat → Catalog) |
| **UC-SU.02** | Forçar recálculo de Stored Procedures (`sp_recalcular_potencial`) |
| **UC-SU.03** | Exportar dados brutos da sessão para CSV/JSON |
| **UC-SU.04** | Resetar etapa do wizard para refazer trabalho |
| **UC-SU.05** | Ajuda contextual / FAQ por etapa |
| **UC-SU.06** | Logs de execução de SPs (debug) |

### 4.8 De Contingência (UC-CO) — quando o sistema/dados falham

| ID | Caso de Uso |
|---|---|
| **UC-CO.01** | Modo offline degradado (cache local da sessão ativa) |
| **UC-CO.02** | Reabrir sessão encerrada para correção emergencial |
| **UC-CO.03** | Restaurar sessão a partir de snapshot |
| **UC-CO.04** | Importação manual de evidência quando integração falha |
| **UC-CO.05** | Gerar minuta a partir de template-base se SP falhar |
| **UC-CO.06** | Fallback para Banco Estrutural se Operacional estiver desatualizado |
| **UC-CO.07** | Notificar consultor de inconsistência crítica nos dados |

### 4.9 De Gestão (UC-GE) — coordenação e supervisão

| ID | Caso de Uso |
|---|---|
| **UC-GE.01** | Visualizar carteira de consultorias por consultor |
| **UC-GE.02** | Atribuir/Reatribuir consultoria a outro consultor |
| **UC-GE.03** | Aprovar minuta antes da publicação |
| **UC-GE.04** | Definir SLA por etapa e monitorar atrasos |
| **UC-GE.05** | Painel agregado dos 645 municípios (mapa de calor de progresso) |
| **UC-GE.06** | Forecast de receita FUNDEB consolidada por consultoria |
| **UC-GE.07** | Configurar templates de plano de ação e minuta |

### 4.10 De Auditoria (UC-AU) — rastreabilidade e compliance interno

| ID | Caso de Uso |
|---|---|
| **UC-AU.01** | Log imutável de toda alteração (`actor`, `timestamp`, `before`, `after`) |
| **UC-AU.02** | Trilha de aprovação de minuta (quem aprovou, quando) |
| **UC-AU.03** | Histórico de versões de cada documento |
| **UC-AU.04** | Quem preencheu cada item de compliance e com qual evidência |
| **UC-AU.05** | Snapshot imutável da sessão ao encerrar |
| **UC-AU.06** | Exportar dossiê de auditoria por sessão (PDF + JSON) |
| **UC-AU.07** | Verificar integridade cripto-assinada do snapshot |
| **UC-AU.08** | Rastrear origem de cada métrica até a linha do CSV bruto |

---

## 5. Pilares do Wizard (resumo — detalhe em `WIZARD.md`)

```
[0] Pré-flight     → autenticação, escolha de carteira
[1] Cidade         → escolha do município, abre/recupera sessão
[2] Discovery      → dados brutos, ETL, frescor, gaps
[3] Diagnóstico    → potencial, ganho/perda, categorias subnotificadas
[4] Simulação      → cenários "what-if" → cenário escolhido
[5] Compliance     → 5 seções A-E, item a item, evidências
[6] Plano de Ação  → curto (7 semanas) + médio + longo
[7] Documentos     → minuta CME, decreto, resolução, publicação
[8] Execução       → acompanhamento semanal até 27/Mai/2026
[9] Entrega        → snapshot, dossiê, encerramento
```

Cada etapa tem **gates obrigatórios** que liberam a próxima e **gates opcionais** que enriquecem o resultado. Detalhamento em `WIZARD.md`.

---

## 6. Mapeamento de Casos de Uso × Etapas do Wizard (visão macro)

| Etapa | Casos de Uso cobertos |
|---|---|
| 0. Pré-flight | UC-GE.01, UC-GE.02 |
| 1. Cidade | UC-ES.01, UC-P2.01, UC-EX.08, UC-CO.02 |
| 2. Discovery | UC-P1.01, UC-P1.02, UC-AX.05, UC-EX.01, UC-SU.01, UC-AU.08 |
| 3. Diagnóstico | UC-ES.03, UC-PR.01, UC-PR.02, UC-AX.01, UC-EX.02, UC-SU.02, UC-CO.06 |
| 4. Simulação | UC-PR.03, UC-P1.05, UC-P2.03 |
| 5. Compliance | UC-ES.04, UC-P1.03, UC-P1.04, UC-AU.04 |
| 6. Plano de Ação | UC-PR.04, UC-PR.06, UC-P2.04, UC-P2.06, UC-AX.02, UC-AX.04 |
| 7. Documentos | UC-ES.05, UC-PR.05, UC-P1.06, UC-P2.05, UC-EX.05, UC-EX.07, UC-GE.03, UC-AU.02, UC-AU.03, UC-CO.05 |
| 8. Execução | UC-PR.06, UC-PR.07, UC-AX.04, UC-AX.05 |
| 9. Entrega | UC-ES.06, UC-EX.03, UC-AU.05, UC-AU.06, UC-AU.07, UC-CO.03 |
| Transversais | UC-ES.02, UC-AU.01, UC-EX.04, UC-EX.06, UC-CO.01, UC-CO.07, UC-GE.04, UC-GE.05, UC-GE.06 |

> A matriz **detalhada** (telas × funções × casos de uso) está em `MATRIZ-FUNCOES-CASOS-USO.md`.

---

## 7. Modelo de Dados (extensões propostas ao schema atual)

Tabelas novas/ampliadas em `src/lib/schema.ts`:

```ts
// raw schema (camada bruta)
raw.imports          // arquivos importados, hash, status, errors[]
raw.import_rows      // linhas brutas indexadas por import_id

// fundeb schema (estrutural — já existe; pequenos acréscimos)
fundeb.municipalities  (mantida)
fundeb.enrollments     (mantida)
fundeb.schools         (mantida)
fundeb.compliance_items (mantida)
fundeb.action_plans    (mantida)
fundeb.documents       (mantida)
fundeb.consultorias    (mantida)
+ wizard_progress      // {consultoria_id, step, status, completed_at, payload_jsonb}
+ scenarios            // simulações nomeadas vinculadas à consultoria
+ approvals            // aprovações de documentos
+ evidences            // evidências anexadas (item_id, url, hash, mime)

// ops schema (operacional — materializações)
ops.v_consultoria_kpis        // matview por consultoria
ops.v_municipio_diagnostico   // matview de diagnóstico
ops.v_compliance_progresso    // % por seção e total
ops.v_plano_progresso         // % por fase
ops.v_potencial_categoria     // ranking de oportunidades

// audit (transversal)
audit.event_log         // {id, actor_id, action, entity, entity_id, before_jsonb, after_jsonb, ts}
audit.snapshots         // {consultoria_id, payload_jsonb, hash, signed_at}
```

---

## 8. Princípios de Design do Wizard

1. **Linearidade com retomada** — sempre uma única "próxima ação", mas é possível pular para qualquer etapa concluída.
2. **Gates explícitos** — cada Step só libera o "Avançar" quando satisfaz seus *acceptance criteria*.
3. **Estado é a sessão** — todo wizard é uma máquina de estados ligada a `consultorias.id`.
4. **Progresso visível** — barra horizontal com % por etapa + total.
5. **Auditável por padrão** — cada ação grava em `audit.event_log` (UC-AU.01).
6. **Reversível com pegada** — UC-SU.04 (resetar etapa) sempre registra a razão.
7. **Ajuda no contexto** — UC-AX.01/02 entregam tooltips e sugestões em cada Step.
8. **Imune a catástrofes** — UC-CO.01 a UC-CO.07 garantem caminhos de saída.

---

## 9. Estrutura de Telas Reformulada

```
/wizard
  /[consultoriaId]
    /step-1-cidade
    /step-2-discovery
    /step-3-diagnostico
    /step-4-simulacao
    /step-5-compliance
    /step-6-plano-acao
    /step-7-documentos
    /step-8-execucao
    /step-9-entrega
/gestao
  /carteira              ← UC-GE.01..06
  /aprovacoes            ← UC-GE.03
  /sla                   ← UC-GE.04
/auditoria
  /eventos               ← UC-AU.01
  /snapshots             ← UC-AU.05
  /trilha/[entidadeId]   ← UC-AU.02..04
/admin
  /imports               ← UC-P1.01, UC-SU.01
  /templates             ← UC-GE.07
  /municipios            ← gestão dos 645
```

As rotas atuais (`/dashboard`, `/diagnostico`, `/compliance`, etc.) **continuam existindo como visões** mas não são mais o ponto de entrada do consultor — viram páginas read-only de consulta. O caminho oficial passa pelo `/wizard`.

---

## 10. Plano de Migração (sem reescrever do zero)

| Onda | Entrega |
|---|---|
| **Onda 1 — Esqueleto Wizard** | Layout, máquina de estados, persistência `wizard_progress`, navegação Step 1↔9 |
| **Onda 2 — Dados** | Schemas `raw.*` e `audit.*`; jobs ETL Extração/Treat/Catalog; SPs de recálculo |
| **Onda 3 — Steps 1–3** | Cidade, Discovery, Diagnóstico (consumindo telas atuais como painéis embarcados) |
| **Onda 4 — Steps 4–6** | Simulação, Compliance, Plano (refator das telas existentes para o wizard) |
| **Onda 5 — Steps 7–9** | Documentos com aprovação, Execução, Entrega/Snapshot |
| **Onda 6 — Gestão e Auditoria** | Carteira, aprovações, audit log, dossiê PDF |
| **Onda 7 — Contingência** | Modo offline, fallback, restore de snapshot |

A cada onda o wizard fica utilizável de ponta a ponta, mesmo que algumas etapas ainda apontem para as telas antigas.

---

## 11. Checklist de Aceitação Global

- [ ] Consultor consegue, sozinho, do zero, conduzir um município do Step 1 ao Step 9 sem sair do wizard.
- [ ] Toda alteração é registrada em `audit.event_log`.
- [ ] Snapshot da sessão ao encerrar produz hash imutável.
- [ ] Dossiê de auditoria pode ser exportado para PDF.
- [ ] Recálculo de potencial/compliance/plano via Stored Procedure.
- [ ] Modo de contingência permite reabrir sessão encerrada.
- [ ] Coordenador vê carteira de 645 municípios com semáforo de progresso.
- [ ] Documento gerado é versionado e exige aprovação para publicar.

---

## 12. Próximos Documentos

- **`WIZARD.md`** — detalhamento etapa-a-etapa (inputs, validações, gates, telas, casos de uso).
- **`MATRIZ-FUNCOES-CASOS-USO.md`** — matriz completa Tela × Função × UC.
- **`DATA-MODEL-DELTAS.md`** *(futuro)* — DDL das tabelas novas (`raw.*`, `audit.*`, `wizard_progress`, etc.).
- **`STORED-PROCEDURES.md`** *(futuro)* — assinaturas e contratos das SPs.
