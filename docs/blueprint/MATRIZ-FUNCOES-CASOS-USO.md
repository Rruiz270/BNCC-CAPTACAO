# MATRIZ — Telas × Funções × Casos de Uso

> Cruzamento exaustivo das telas/funções com todos os casos de uso definidos no `BLUEPRINT.md`. Use junto com `WIZARD.md` para implementação.

## Legenda

| Marca | Significado |
|---|---|
| **D** | A função **Dispara** o caso de uso (call-to-action principal) |
| **C** | A função **Cobre** o caso de uso integralmente (entrega o resultado) |
| **V** | A função **Valida** entradas/condições do caso de uso |
| **R** | A função **Registra** dados que materializam o caso de uso |
| **A** | A função alimenta o **Audit log** (UC-AU.*) |

---

## Catálogo de Telas

| # | Tela | Rota |
|---|---|---|
| T0 | Login & Pré-flight | `/login` |
| T1 | Cidade | `/wizard/[id]/step-1-cidade` |
| T2 | Discovery (ETL) | `/wizard/[id]/step-2-discovery` |
| T3 | Diagnóstico | `/wizard/[id]/step-3-diagnostico` |
| T4 | Simulação | `/wizard/[id]/step-4-simulacao` |
| T5 | Compliance | `/wizard/[id]/step-5-compliance` |
| T6 | Plano de Ação | `/wizard/[id]/step-6-plano-acao` |
| T7 | Documentos | `/wizard/[id]/step-7-documentos` |
| T8 | Execução | `/wizard/[id]/step-8-execucao` |
| T9 | Entrega | `/wizard/[id]/step-9-entrega` |
| TG | Carteira (Gestão) | `/gestao/carteira` |
| TA | Aprovações | `/gestao/aprovacoes` |
| TS | SLA & SLOs | `/gestao/sla` |
| TI | Imports | `/admin/imports` |
| TT | Templates | `/admin/templates` |
| TM | Municípios (cadastro) | `/admin/municipios` |
| TX | Auditoria — eventos | `/auditoria/eventos` |
| TZ | Auditoria — snapshots | `/auditoria/snapshots` |
| TR | Auditoria — trilha | `/auditoria/trilha/[id]` |
| TC | Comparativo | `/comparativo` |
| TD | Dashboard agregado | `/dashboard` |

---

## T0 — Login & Pré-flight

| Função | UC cobertos |
|---|---|
| Autenticar usuário | UC-GE.01 (V), UC-AU.01 (R/A) |
| Selecionar carteira ativa | UC-GE.01 (D/C), UC-GE.02 (D) |
| Listar consultorias em andamento | UC-GE.01 (C), UC-ES.02 (R) |
| Criar nova consultoria (CTA) | UC-ES.01 (D) |

---

## T1 — Cidade

| Função | UC cobertos |
|---|---|
| Buscar município (texto + IBGE) | UC-P2.01 (D/C) |
| Selecionar município da lista | UC-P2.01 (V) |
| Confirmar e abrir sessão | UC-ES.01 (D/C), UC-AU.01 (R/A) |
| Detectar município sem dados estruturais | UC-EX.08 (V) |
| Retomar sessão existente | UC-ES.02 (D/C) |
| Reabrir sessão encerrada (com justificativa) | UC-CO.02 (D/C/V), UC-AU.01 (A) |
| Cartão "Resumo do município" | UC-PR.01 (parcial, leitura) |
| Botão "Avançar para Discovery" | UC-ES.02 (R) |

---

## T2 — Discovery (ETL)

| Função | UC cobertos |
|---|---|
| Painel "Frescor dos dados" | UC-AX.05 (C) |
| Upload de CSV | UC-P1.01 (D), UC-AU.08 (R) |
| Validação de colunas/encoding | UC-P1.01 (V), UC-EX.01 (V) |
| Disparar pipeline ETL (Extração → Treat → Catalog) | UC-SU.01 (D/C), UC-P1.02 (D/C), UC-AU.08 (R/A) |
| Lista de erros do ETL | UC-EX.01 (C) |
| Mapeamento de categorias FUNDEB | UC-P1.02 (V/C) |
| Recálculo automático de potencial (`sp_recalcular_potencial`) | UC-ES.03 (D), UC-SU.02 (D/C) |
| Aviso de Postgres indisponível + retry | UC-EX.06 (V), UC-CO.07 (D) |
| Botão "Reexecutar ETL para este município" | UC-SU.01 (D/C) |
| Exportar dados brutos da sessão | UC-SU.03 (D/C) |
| Tooltip "o que cada categoria significa" | UC-AX.01 (C) |

---

## T3 — Diagnóstico

| Função | UC cobertos |
|---|---|
| KPI "Receita FUNDEB total" | UC-PR.01 (C) |
| KPI "Ganho/Perda" | UC-PR.01 (C) |
| KPI "Potencial total" | UC-ES.03 (C), UC-PR.01 (C) |
| Tabela "Categorias subnotificadas" | UC-PR.02 (C) |
| Gráfico histórico 2022–2026 | UC-PR.01 (C) |
| Indicadores SAEB/IDEB/infra | UC-PR.01 (C) |
| Tooltips de fórmula (VAAF, VAAR, VAAT) | UC-AX.01 (C) |
| Botão "Validei o diagnóstico" | UC-AU.01 (R/A) |
| Bloqueio quando dados insuficientes | UC-EX.02 (V) |
| Fallback para banco estrutural se operacional indisponível | UC-CO.06 (D/C) |
| Marcação de "achados" qualitativos | UC-PR.07 (R) |

---

## T4 — Simulação

| Função | UC cobertos |
|---|---|
| 15 sliders por categoria FUNDEB | UC-P1.05 (D/C), UC-PR.03 (C) |
| Sliders de multiplicadores (campo, indígena/quilombola) | UC-P1.05 (C) |
| Comparação baseline × cenário | UC-PR.03 (C) |
| Salvar cenário nomeado | UC-P2.03 (D/C/R), UC-AU.01 (A) |
| Marcar cenário como "alvo" | UC-P2.03 (V/R) |
| Tooltip "como o slider afeta o VAAF" | UC-AX.01 (C) |

---

## T5 — Compliance

| Função | UC cobertos |
|---|---|
| Lista das 5 seções A–E (colapsáveis) | UC-PR.01 (C parcial) |
| Mudar status de item (`done`/`progress`/`pending`/`late`) | UC-ES.04 (D/C/R), UC-P1.03 (D/C), UC-AU.01 (A), UC-AU.04 (R) |
| Anexar evidência (URL/upload) | UC-P1.04 (D/C/R), UC-AU.04 (R) |
| Campo "Notas" por item | UC-P1.03 (R) |
| Recalcular % por seção e total (`sp_atualizar_compliance`) | UC-ES.04 (C) |
| Contador de dias até cada deadline | UC-AX.04 (C) |
| Validar cobertura 100% antes de avançar | UC-ES.04 (V) |

---

## T6 — Plano de Ação

| Função | UC cobertos |
|---|---|
| Coluna Curto (7 semanas até 27/Mai) | UC-PR.04 (C) |
| Coluna Médio (9 tarefas-template) | UC-PR.04 (C) |
| Coluna Longo (5 tarefas-template) | UC-PR.04 (C) |
| Adicionar tarefa | UC-PR.04 (D/R), UC-AU.01 (A) |
| Atribuir responsável | UC-P2.06 (D/C/R) |
| Definir prazo | UC-AX.04 (C parcial) |
| Marcar tarefa como concluída | UC-PR.06 (D/C/R), UC-AU.01 (A) |
| Botão "Sugerir plano com base no diagnóstico" | UC-AX.02 (D/C) |
| Botão "Duplicar plano de outro município" | UC-P2.04 (D/C) |
| Validar pelo menos uma tarefa por fase | UC-PR.04 (V) |

---

## T7 — Documentos

| Função | UC cobertos |
|---|---|
| Lista de documentos (Minuta CME, Decreto, Resolução) | UC-PR.05 (C parcial) |
| Editor HTML do documento | UC-PR.05 (C), UC-P1.06 (parcial) |
| Auto-preencher placeholders do município | UC-AX.03 (D/C) |
| Validar placeholders preenchidos | UC-EX.05 (V) |
| Gerar via SP `sp_gerar_minuta` | UC-ES.05 (D/C/R), UC-PR.05 (C) |
| Fallback para template estático se SP falhar | UC-CO.05 (D/C) |
| Versionar documento (`rascunho`→`em_aprovacao`→`aprovado`→`publicado`) | UC-P2.05 (D/C/R), UC-AU.03 (R/A) |
| Solicitar aprovação | UC-GE.03 (D), UC-AU.02 (R) |
| Bloquear publicação sem aprovação | UC-EX.07 (V) |
| Exportar HTML/DOCX/PDF | UC-P1.06 (D/C) |
| Histórico de versões | UC-AU.03 (C) |

---

## T8 — Execução (Acompanhamento Semanal)

| Função | UC cobertos |
|---|---|
| Linha do tempo das 7 semanas | UC-PR.06 (C) |
| Lista de pendências da semana | UC-PR.06 (C) |
| Marcar tarefa concluída + evidência | UC-PR.06 (D/C/R), UC-AU.01 (A) |
| Painel "Pendências críticas" | UC-PR.06 (C), UC-CO.07 (D) |
| Contador "Dias até o Censo" (27/05/2026) | UC-AX.04 (C) |
| Indicador de frescor dos dados | UC-AX.05 (C) |
| Gerar relatório executivo (PDF) | UC-PR.07 (D/C) |

---

## T9 — Entrega

| Função | UC cobertos |
|---|---|
| Checklist final de fechamento | UC-ES.06 (V), UC-EX.03 (V) |
| Encerrar consultoria (`sp_snapshot_sessao`) | UC-ES.06 (D/C/R), UC-AU.05 (R/A) |
| Hash imutável exibido | UC-AU.05 (C), UC-AU.07 (parcial) |
| Exportar dossiê PDF | UC-AU.06 (D/C) |
| Reabrir sessão (com justificativa) | UC-CO.02 (D/C), UC-AU.01 (A) |
| Restaurar a partir de snapshot | UC-CO.03 (D/C) |

---

## TG — Carteira (Coordenação)

| Função | UC cobertos |
|---|---|
| Lista de consultorias com filtros | UC-GE.01 (C), UC-P2.02 (D/C) |
| Mapa de calor dos 645 municípios | UC-GE.05 (C) |
| Reatribuir consultor | UC-GE.02 (D/C/R), UC-AU.01 (A) |
| Forecast de receita FUNDEB consolidada | UC-GE.06 (C) |
| Exportar relatório da carteira | UC-PR.07 (D/C parcial) |

---

## TA — Aprovações

| Função | UC cobertos |
|---|---|
| Fila de minutas pendentes | UC-GE.03 (C) |
| Aprovar / Reprovar com motivo | UC-GE.03 (D/C/R), UC-AU.02 (R/A) |
| Visualizar diff entre versões | UC-AU.03 (C) |

---

## TS — SLA & SLOs

| Função | UC cobertos |
|---|---|
| Configurar SLA por etapa | UC-GE.04 (D/C/R) |
| Painel de atrasos | UC-GE.04 (C), UC-CO.07 (D) |
| Alertas automáticos | UC-CO.07 (D/C) |

---

## TI — Imports (Admin)

| Função | UC cobertos |
|---|---|
| Listar todas as importações | UC-AU.08 (C) |
| Disparar carga manual | UC-P1.01 (D/C), UC-SU.01 (D) |
| Reprocessar import com erro | UC-SU.01 (D/C) |
| Detalhe das linhas rejeitadas | UC-EX.01 (C), UC-AU.08 (C) |

---

## TT — Templates (Admin)

| Função | UC cobertos |
|---|---|
| Editar templates de plano (curto/médio/longo) | UC-GE.07 (D/C/R) |
| Editar templates de minuta CME / decreto / resolução | UC-GE.07 (D/C/R) |
| Versionar templates | UC-AU.03 (R) |

---

## TM — Municípios (Cadastro)

| Função | UC cobertos |
|---|---|
| CRUD dos 645 municípios | UC-EX.08 (mitiga, V) |
| Importar lote de municípios | UC-P1.01 (D/C parcial) |

---

## TX — Auditoria: Eventos

| Função | UC cobertos |
|---|---|
| Lista cronológica de eventos | UC-AU.01 (C) |
| Filtros por ator/entidade/ação | UC-AU.01 (C) |
| Detalhe `before/after` por evento | UC-AU.01 (C) |

---

## TZ — Auditoria: Snapshots

| Função | UC cobertos |
|---|---|
| Lista de snapshots por consultoria | UC-AU.05 (C) |
| Validar hash do snapshot | UC-AU.07 (D/C/V) |
| Restaurar snapshot | UC-CO.03 (D/C), UC-AU.01 (A) |
| Exportar snapshot (JSON+PDF) | UC-AU.06 (D/C) |

---

## TR — Auditoria: Trilha por Entidade

| Função | UC cobertos |
|---|---|
| Linha do tempo de uma minuta | UC-AU.02 (C), UC-AU.03 (C) |
| Linha do tempo de um item de compliance | UC-AU.04 (C) |
| Origem da métrica até a linha bruta do CSV | UC-AU.08 (C) |

---

## TC — Comparativo

| Função | UC cobertos |
|---|---|
| Selecionar 2..N municípios | UC-P1.07 (D) |
| Tabela comparativa lado a lado | UC-P1.07 (C) |
| Exportar comparativo | UC-P1.06 (parcial) |
| Sugerir municípios similares | UC-AX.06 (D/C) |

---

## TD — Dashboard Agregado

| Função | UC cobertos |
|---|---|
| KPIs gerais dos 645 municípios | UC-GE.05 (C parcial) |
| Top 10 por potencial | UC-PR.01 (C parcial) |
| Histórico agregado de receita | UC-PR.01 (C parcial) |
| Mapa ganham × perdem | UC-GE.05 (C parcial) |

---

## Cobertura por Caso de Uso (verificação reversa)

> Para cada UC, lista as telas que o cobrem (C) ou disparam (D). Garante que **nenhum UC fica órfão**.

| UC | Telas |
|---|---|
| **UC-ES.01** | T0 (D), T1 (D/C) |
| **UC-ES.02** | T0, T1, todas (auto-save) |
| **UC-ES.03** | T2 (D), T3 (C) |
| **UC-ES.04** | T5 (D/C/V) |
| **UC-ES.05** | T7 (D/C) |
| **UC-ES.06** | T9 (D/C) |
| **UC-PR.01** | T1, T3, TC, TD |
| **UC-PR.02** | T3 |
| **UC-PR.03** | T4 |
| **UC-PR.04** | T6 |
| **UC-PR.05** | T7 |
| **UC-PR.06** | T6, T8 |
| **UC-PR.07** | T8, TG |
| **UC-P1.01** | T2, TI, TM |
| **UC-P1.02** | T2 |
| **UC-P1.03** | T5 |
| **UC-P1.04** | T5 |
| **UC-P1.05** | T4 |
| **UC-P1.06** | T7, TC |
| **UC-P1.07** | TC |
| **UC-P2.01** | T1 |
| **UC-P2.02** | TG |
| **UC-P2.03** | T4 |
| **UC-P2.04** | T6 |
| **UC-P2.05** | T7 |
| **UC-P2.06** | T6 |
| **UC-AX.01** | T2, T3, T4 |
| **UC-AX.02** | T6 |
| **UC-AX.03** | T7 |
| **UC-AX.04** | T5, T6, T8 |
| **UC-AX.05** | T2, T8 |
| **UC-AX.06** | TC |
| **UC-EX.01** | T2, TI |
| **UC-EX.02** | T3 |
| **UC-EX.03** | T9 |
| **UC-EX.04** | global (lock UI) |
| **UC-EX.05** | T7 |
| **UC-EX.06** | T2, global |
| **UC-EX.07** | T7 |
| **UC-EX.08** | T1, TM |
| **UC-SU.01** | T2, TI |
| **UC-SU.02** | T2 |
| **UC-SU.03** | T2 |
| **UC-SU.04** | global (botão "Refazer etapa") |
| **UC-SU.05** | global (Help button) |
| **UC-SU.06** | TX, TI |
| **UC-CO.01** | global (modo offline) |
| **UC-CO.02** | T1, T9 |
| **UC-CO.03** | T9, TZ |
| **UC-CO.04** | T5 |
| **UC-CO.05** | T7 |
| **UC-CO.06** | T3 |
| **UC-CO.07** | T2, T8, TS |
| **UC-GE.01** | T0, TG |
| **UC-GE.02** | T0, TG |
| **UC-GE.03** | T7, TA |
| **UC-GE.04** | TS |
| **UC-GE.05** | TG, TD |
| **UC-GE.06** | TG |
| **UC-GE.07** | TT |
| **UC-AU.01** | TX + todas as telas (R/A) |
| **UC-AU.02** | T7, TA, TR |
| **UC-AU.03** | T7, TA, TR, TT |
| **UC-AU.04** | T5, TR |
| **UC-AU.05** | T9, TZ |
| **UC-AU.06** | T9, TZ |
| **UC-AU.07** | T9, TZ |
| **UC-AU.08** | T2, TI, TR |

> ✅ **Todos os 60 casos de uso têm pelo menos uma tela responsável** pela cobertura ou disparo.

---

## Heat-map de "densidade de UCs por tela"

Ordem decrescente (telas que mais carregam responsabilidade):

| Tela | UCs cobertos | Comentário |
|---|---|---|
| T2 Discovery | 11 | Centro do ETL e fonte da auditoria de origem dos dados |
| T7 Documentos | 11 | Gera, versiona, aprova, publica e audita documentos |
| T5 Compliance | 7 | Coração da operação dia-a-dia de consultoria |
| T9 Entrega | 7 | Encerra, congela, audita e reabre |
| T6 Plano de Ação | 7 | Combina sugestões automáticas com plano manual |
| T3 Diagnóstico | 7 | Toda leitura do "estado do município" |
| T1 Cidade | 6 | Porta de entrada, cobre seleção e retomada |
| TG Carteira | 6 | Ponto de gestão dos coordenadores |
| TX/TZ/TR Auditoria | 6 (combinado) | Trilha completa para o auditor |

Telas com poucas UCs (T0, TS, TM, TT) são especializadas — está correto serem leves.

---

## Próximos passos

1. Revisar com o consultor sênior se algum caso de uso ainda falta (especialmente em auditoria do município externo).
2. Implementar a Onda 1 do `BLUEPRINT.md` (esqueleto wizard).
3. Para cada Step do `WIZARD.md`, criar a tela embarcando os componentes existentes (`/dashboard`, `/diagnostico`, `/simulador`, etc.) como **painéis** internos.
4. Criar tabelas `wizard_progress`, `audit.event_log`, `audit.snapshots`, `scenarios`, `approvals`, `evidences` (próximo doc: `DATA-MODEL-DELTAS.md`).
