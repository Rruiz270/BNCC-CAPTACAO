# WIZARD — Fluxo passo-a-passo da consultoria FUNDEB SP 2026

> Detalhamento de cada etapa do wizard. Cada Step traz: objetivo, ator, inputs, ações, gates obrigatórios, gates opcionais, telas, casos de uso cobertos, próxima etapa e exceções.

---

## Visão Geral

```
[0] Pré-flight ─▶ [1] Cidade ─▶ [2] Discovery ─▶ [3] Diagnóstico ─▶ [4] Simulação ─▶
   [5] Compliance ─▶ [6] Plano de Ação ─▶ [7] Documentos ─▶ [8] Execução ─▶ [9] Entrega
```

A barra superior mostra os 10 nós, o ativo destacado, os concluídos com check, os bloqueados em cinza. **Avançar** só fica habilitado quando os gates obrigatórios da etapa atual estão satisfeitos.

Estado persistente: tabela `wizard_progress` (`consultoria_id`, `step`, `status`, `payload_jsonb`, `completed_at`). Sair e voltar **retoma exatamente** onde parou.

---

## Step 0 — Pré-flight

**Objetivo**: Validar quem é o consultor e em qual carteira está atuando.

| Item | Conteúdo |
|---|---|
| Ator | Consultor / Coordenador |
| Inputs | Login, perfil, carteira ativa |
| Ações | Login, escolher carteira, ver consultorias em andamento |
| Gates obrigatórios | Sessão de usuário válida |
| Gates opcionais | Carteira selecionada |
| Telas | `/login`, `/wizard` (landing) |
| Casos de uso | UC-GE.01, UC-GE.02 |
| Próxima etapa | Step 1 (Cidade) |

**Exceções**
- Sem permissão para a carteira → tela de acesso negado.
- Carteira vazia → CTA "Criar nova consultoria".

---

## Step 1 — Cidade

**Objetivo**: Selecionar o município e abrir/recuperar a sessão de consultoria.

| Item | Conteúdo |
|---|---|
| Ator | Consultor |
| Inputs | Busca por nome, código IBGE, região, lista filtrada |
| Ações | Buscar, selecionar, confirmar, abrir nova sessão **ou** retomar existente |
| Gates obrigatórios | Município existente em `fundeb.municipalities` + sessão criada/recuperada |
| Gates opcionais | Definir notas iniciais da consultoria |
| Telas | `/wizard/[id]/step-1-cidade` |
| Casos de uso | UC-ES.01, UC-P2.01, UC-EX.08, UC-CO.02 |
| Próxima etapa | Step 2 (Discovery) |

**Tela — componentes principais**
1. Search-select-confirm (já existe no `SidebarMunicipalityPicker`).
2. Cartão "Resumo do município" (população, região, escolas, matrículas).
3. Cartão "Última consultoria" (se existir) com opção **Retomar** ou **Abrir nova**.
4. Botão **Avançar** (libera quando há sessão válida).

**Exceções**
- **UC-EX.08** — município sem dados estruturais → bloquear avanço, oferecer "Importar dados" (Step 2).
- **UC-CO.02** — sessão encerrada selecionada → diálogo de "reabrir para correção emergencial" com justificativa.

---

## Step 2 — Discovery (Dados Brutos + ETL)

**Objetivo**: Garantir que o município tem dados frescos e estruturados para análise.

| Item | Conteúdo |
|---|---|
| Ator | Consultor + Sistema |
| Inputs | CSVs (Censo Escolar, SIOPE, FNDE, planilhas locais), data dos snapshots existentes |
| Ações | Verificar frescor → reexecutar ETL se necessário → catalogar matrículas → validar |
| Gates obrigatórios | Última carga ETL com sucesso + matrículas categorizadas |
| Gates opcionais | Importar planilhas adicionais do município |
| Telas | `/wizard/[id]/step-2-discovery`, `/admin/imports` |
| Casos de uso | UC-P1.01, UC-P1.02, UC-AX.05, UC-EX.01, UC-SU.01, UC-AU.08 |
| Próxima etapa | Step 3 (Diagnóstico) |

**Pipeline ETL (na ordem do whiteboard)**

```
Banco BRUTO → 1. Extração → 2. Treat → 3. Catalog → Banco ESTRUTURAL
                                                         │
                                                         ▼
                                                  Stored Procedures
                                                         │
                                                         ▼
                                                  Banco OPERACIONAL
```

1. **Extração** — lê arquivos da fonte e grava em `raw.imports` + `raw.import_rows`. Hash do arquivo + log de erros.
2. **Treat** — normaliza encoding/decimal, deduplica, casa códigos INEP/IBGE, marca linhas inválidas.
3. **Catalog** — atribui categoria FUNDEB (15 categorias do `constants.ts`), aplica fator VAAF, separa urbana/campo, marca AEE.
4. SP `sp_recalcular_potencial` é disparada ao final.

**Tela — componentes principais**
- Painel "Frescor dos dados" com timestamp da última carga e diff vs. fonte.
- Botão "Reexecutar ETL" (UC-SU.01).
- Tabela de validação com erros encontrados (UC-EX.01).
- Lista de fontes (Censo Escolar, SIOPE, FNDE, IBGE, Local).
- Indicador de progresso por etapa do pipeline.

**Exceções**
- **UC-EX.01** — colunas faltantes → bloquear e mostrar mapeamento esperado.
- **UC-EX.06** — Postgres indisponível → alerta + retry com backoff.

---

## Step 3 — Diagnóstico

**Objetivo**: Mostrar o retrato financeiro/educacional do município e identificar os gaps de captação.

| Item | Conteúdo |
|---|---|
| Ator | Consultor |
| Inputs | Banco operacional pronto |
| Ações | Ler KPIs, validar com o município, marcar achados |
| Gates obrigatórios | Diagnóstico revisado pelo consultor (checkbox "validei") |
| Gates opcionais | Notas qualitativas, identificação de "quick wins" |
| Telas | `/wizard/[id]/step-3-diagnostico` |
| Casos de uso | UC-ES.03, UC-PR.01, UC-PR.02, UC-AX.01, UC-EX.02, UC-SU.02, UC-CO.06 |
| Próxima etapa | Step 4 (Simulação) |

**Componentes**
- **KPIs** — receita FUNDEB total, ganho/perda, potencial total, % potencial, ranking estadual.
- **Cartão "Categorias subnotificadas"** — top categorias com matrículas baixas e alto fator VAAF.
- **Gráfico histórico 2022–2026** (já existe no dashboard atual).
- **Indicadores socioeducacionais** — IDEB AI/AF, SAEB, % infraestrutura.
- **Tabela de gaps** — categoria, matrículas atuais, esperadas, R$ por matrícula, perda estimada.
- **Tooltips de fórmula** (UC-AX.01) ao lado de cada KPI.

**Exceções**
- **UC-EX.02** — sem dados suficientes → bloquear e voltar ao Step 2.
- **UC-CO.06** — view operacional desatualizada → cair para a estrutural com aviso.

---

## Step 4 — Simulação

**Objetivo**: Definir o cenário-alvo de reclassificação/expansão de matrículas.

| Item | Conteúdo |
|---|---|
| Ator | Consultor |
| Inputs | Sliders de matrículas por categoria, multiplicadores (campo, indígena/quilombola) |
| Ações | Ajustar parâmetros, comparar baseline × cenário, salvar cenário nomeado |
| Gates obrigatórios | Pelo menos um cenário salvo e marcado como "alvo" |
| Gates opcionais | Múltiplos cenários comparados |
| Telas | `/wizard/[id]/step-4-simulacao` |
| Casos de uso | UC-PR.03, UC-P1.05, UC-P2.03 |
| Próxima etapa | Step 5 (Compliance) |

**Componentes**
- 15 sliders (uma por categoria FUNDEB) com valores atual/projetado.
- Sliders de multiplicadores (campo +15%, indígena/quilombola +40%).
- Cards "Receita projetada", "Ganho vs. baseline", "% sobre receita atual".
- Botão "Salvar cenário" (UC-P2.03) → grava em `scenarios`.
- Toggle "Cenário alvo" — só um por sessão.

---

## Step 5 — Compliance

**Objetivo**: Preencher a checklist das 5 seções (A–E) com evidências.

| Item | Conteúdo |
|---|---|
| Ator | Consultor (com apoio do município) |
| Inputs | Status por item, evidência (URL/upload), notas |
| Ações | Marcar item, anexar evidência, escrever nota, calcular % |
| Gates obrigatórios | 100% dos itens classificados (`done`/`progress`/`pending`/`late`) |
| Gates opcionais | Evidência anexada em todos os itens `done` |
| Telas | `/wizard/[id]/step-5-compliance` |
| Casos de uso | UC-ES.04, UC-P1.03, UC-P1.04, UC-AU.04 |
| Próxima etapa | Step 6 (Plano de Ação) |

**As 5 seções** (já em `constants.ts`):

| Seção | Tema | Deadline |
|---|---|---|
| A | 5 Condicionalidades VAAR | 31/08/2026 |
| B | BNCC Computação | 31/08/2026 |
| C | Censo Escolar | 27/05/2026 |
| D | SIMEC | 31/08/2026 |
| E | EC 135 — Escola Integral | 31/12/2026 |

**Componentes**
- Lista colapsável por seção com badges de status.
- Cada item: status (`done`/`progress`/`pending`/`late`), botão "Anexar evidência", campo "Notas".
- Barra geral + barras por seção.
- Contador de dias até cada deadline (UC-AX.04).
- SP `sp_atualizar_compliance` recalcula a cada mudança.

---

## Step 6 — Plano de Ação

**Objetivo**: Compor o plano com tarefas curto/médio/longo prazo, responsáveis e datas.

| Item | Conteúdo |
|---|---|
| Ator | Consultor |
| Inputs | Templates `ACTION_PLAN_WEEKS`, `MEDIUM_TERM_TASKS`, `LONG_TERM_TASKS`, atribuições |
| Ações | Selecionar tarefas, atribuir responsável, definir prazo, anexar referências |
| Gates obrigatórios | Pelo menos uma tarefa definida em cada fase (curto, médio, longo) |
| Gates opcionais | Auto-sugestão (UC-AX.02) aceita com ajustes |
| Telas | `/wizard/[id]/step-6-plano-acao` |
| Casos de uso | UC-PR.04, UC-P2.04, UC-P2.06, UC-AX.02, UC-AX.04 |
| Próxima etapa | Step 7 (Documentos) |

**Componentes**
- 3 colunas: **Curto (7 semanas até 27/Mai)**, **Médio (até 31/Ago)**, **Longo (2027+)**.
- Em curto: timeline com as 7 semanas (já definidas no `ACTION_PLAN_WEEKS`).
- Em médio: 9 tarefas-template (`MEDIUM_TERM_TASKS`).
- Em longo: 5 tarefas-template (`LONG_TERM_TASKS`).
- Cada tarefa: checkbox, responsável, prazo, status, evidência.
- Botão "Duplicar plano de outro município" (UC-P2.04).
- Botão "Sugerir plano com base no diagnóstico" (UC-AX.02).

---

## Step 7 — Documentos

**Objetivo**: Gerar e versionar a minuta CME, decreto e resolução para publicação no Diário Oficial.

| Item | Conteúdo |
|---|---|
| Ator | Consultor → Coordenador (aprovador) |
| Inputs | Template HTML, dados do município, currículo BNCC Computação |
| Ações | Gerar minuta, revisar, solicitar aprovação, exportar |
| Gates obrigatórios | Pelo menos a Minuta CME gerada (status `rascunho` ou superior) |
| Gates opcionais | Decreto e Resolução também gerados; aprovação concluída |
| Telas | `/wizard/[id]/step-7-documentos`, `/gestao/aprovacoes` |
| Casos de uso | UC-ES.05, UC-PR.05, UC-P1.06, UC-P2.05, UC-EX.05, UC-EX.07, UC-GE.03, UC-AU.02, UC-AU.03, UC-CO.05 |
| Próxima etapa | Step 8 (Execução) |

**Trilho de documentos**

```
Minuta CME (B1)  →  Aprovação CME  →  Decreto/Resolução  →  Publicação no Diário Oficial
                          │
                          ▼
                  audit.snapshots
```

**Componentes**
- Lista de documentos (Minuta CME, Decreto, Resolução, Anexos).
- Cada documento: editor HTML, status (`rascunho`/`em_aprovacao`/`aprovado`/`publicado`), versão.
- Botão "Gerar via SP" (`sp_gerar_minuta`).
- Botão "Solicitar aprovação" (cria registro em `approvals`, dispara UC-GE.03).
- Botão "Exportar" — HTML, DOCX, PDF (UC-P1.06).
- Histórico de versões (UC-AU.03).

**Exceções**
- **UC-EX.05** — placeholders não preenchidos → bloquear gerar.
- **UC-EX.07** — tentativa de publicar sem aprovação → bloquear + alerta ao coordenador.
- **UC-CO.05** — SP indisponível → cair para template-base estático.

---

## Step 8 — Execução (Acompanhamento Semanal)

**Objetivo**: Acompanhar a execução do plano até o dia do Censo (27/05/2026) e prazos posteriores.

| Item | Conteúdo |
|---|---|
| Ator | Consultor + Município |
| Inputs | Marcação de tarefas concluídas, evidências, observações |
| Ações | Marcar concluído, anexar evidência, anotar bloqueios |
| Gates obrigatórios | Nenhum (etapa contínua) |
| Gates opcionais | 100% das tarefas curto-prazo concluídas até 23/Mai |
| Telas | `/wizard/[id]/step-8-execucao` |
| Casos de uso | UC-PR.06, UC-PR.07, UC-AX.04, UC-AX.05 |
| Próxima etapa | Step 9 (Entrega) |

**Componentes**
- Linha do tempo das 7 semanas com status por dia.
- Lista de tarefas pendentes para a semana atual.
- Contador "Dias até o Censo Escolar" (27/05/2026).
- Botão "Gerar relatório executivo" (UC-PR.07).
- Painel "Pendências críticas" (atrasadas e bloqueantes).

---

## Step 9 — Entrega

**Objetivo**: Encerrar a sessão, gerar snapshot imutável e dossiê de auditoria.

| Item | Conteúdo |
|---|---|
| Ator | Consultor → Coordenador |
| Inputs | Confirmação final do consultor + assinatura digital |
| Ações | Revisão final, snapshot, dossiê PDF, encerramento |
| Gates obrigatórios | Steps 1–7 completos + checklist final assinado |
| Gates opcionais | Pesquisa de satisfação do município |
| Telas | `/wizard/[id]/step-9-entrega` |
| Casos de uso | UC-ES.06, UC-EX.03, UC-AU.05, UC-AU.06, UC-AU.07, UC-CO.03 |
| Próxima etapa | Carteira (Step 0) |

**Componentes**
- Checklist final ("Diagnóstico ok", "Compliance ok", "Plano ok", "Documentos ok").
- Botão "Encerrar consultoria" — dispara `sp_snapshot_sessao`.
- Hash do snapshot exibido.
- Botão "Exportar dossiê PDF" (UC-AU.06).
- Botão "Reabrir" (UC-CO.02) com justificativa obrigatória.

**Exceções**
- **UC-EX.03** — etapas obrigatórias incompletas → lista do que falta + atalho para a etapa.
- **UC-CO.03** — restauração via snapshot histórico.

---

## Componentes Globais do Wizard

| Componente | Função | Casos de uso |
|---|---|---|
| **Stepper Bar** | Navegação visual entre etapas | UC-ES.02 |
| **Progress Pill** | % global da consultoria | UC-ES.02, UC-GE.05 |
| **Auto-save indicator** | Mostra "Salvando..." / "Salvo às hh:mm" | UC-ES.02 |
| **Frescor de dados** | Selo com timestamp da última carga | UC-AX.05 |
| **Audit log toggle** | Painel lateral com últimas ações | UC-AU.01 |
| **Help button** | FAQ contextual da etapa | UC-SU.05 |
| **Reset etapa** | Botão "Refazer esta etapa" | UC-SU.04 |
| **Conflito de edição** | Lock/unlock + aviso | UC-EX.04 |
| **Modo offline** | Cache local + reconexão | UC-CO.01 |

---

## Máquina de Estados Resumida

```ts
type StepStatus = "locked" | "available" | "in_progress" | "completed" | "blocked";

interface WizardState {
  consultoriaId: number;
  currentStep: 0..9;
  steps: Record<0..9, {
    status: StepStatus;
    payload: object;
    completedAt?: Date;
    blockReason?: string;
  }>;
}
```

Regras:
- `available` se todos os gates obrigatórios das etapas anteriores estão `completed`.
- `blocked` se a SP de validação retornar erro (UC-EX.*).
- `in_progress` enquanto o consultor está atuando.
- `completed` quando os gates obrigatórios da própria etapa estão satisfeitos.
- Avançar do Step 9 → carteira (Step 0) com sessão em `completed`.

---

## Eventos de Auditoria por Etapa

Cada Step grava eventos em `audit.event_log`. Mínimo:

| Step | Eventos |
|---|---|
| 1 | `session.opened`, `session.resumed`, `session.reopened` |
| 2 | `etl.executed`, `import.uploaded`, `import.rejected` |
| 3 | `diagnostic.validated` |
| 4 | `scenario.saved`, `scenario.set_target` |
| 5 | `compliance.item.changed`, `evidence.attached` |
| 6 | `task.created`, `task.assigned`, `task.completed` |
| 7 | `document.generated`, `document.versioned`, `document.approved`, `document.published` |
| 8 | `task.checked`, `weekly.report.generated` |
| 9 | `snapshot.created`, `dossier.exported`, `session.closed` |

---

## Regras de Bloqueio do Avançar (resumo)

| Step | Bloqueio |
|---|---|
| 1 → 2 | Nenhum município escolhido / sessão não criada |
| 2 → 3 | ETL nunca rodou ou rodou com erro / matrículas não categorizadas |
| 3 → 4 | Diagnóstico não validado pelo consultor |
| 4 → 5 | Nenhum cenário marcado como alvo |
| 5 → 6 | Algum item de compliance ainda não classificado |
| 6 → 7 | Plano sem tarefas em alguma das fases |
| 7 → 8 | Minuta CME não gerada |
| 8 → 9 | Nenhum (Step 8 é contínuo) |
| 9 → fim | Checklist final não assinado |
