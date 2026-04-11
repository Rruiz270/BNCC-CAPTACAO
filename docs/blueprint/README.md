# Blueprint da Plataforma BNCC-CAPTAÇÃO (formato Wizard)

Este diretório contém o redesenho completo da plataforma para um **fluxo wizard** de consultoria FUNDEB SP 2026.

## Documentos

| Arquivo | O que contém |
|---|---|
| [`BLUEPRINT.md`](./BLUEPRINT.md) | Arquitetura, atores, **60 casos de uso** em 10 categorias, modelo de dados estendido, plano de migração em 7 ondas |
| [`WIZARD.md`](./WIZARD.md) | Detalhamento de cada um dos **10 Steps** (0–9): inputs, gates, telas, casos de uso, exceções, máquina de estados |
| [`MATRIZ-FUNCOES-CASOS-USO.md`](./MATRIZ-FUNCOES-CASOS-USO.md) | Cruzamento exaustivo: 21 telas × funções × 60 casos de uso, com cobertura reversa |

## Como ler

1. **Comece pelo `BLUEPRINT.md`** — entende-se a motivação, a arquitetura (transcrição do whiteboard), os atores e a lista completa de casos de uso.
2. **Depois `WIZARD.md`** — vê-se etapa a etapa o que o consultor faz, o que precisa para avançar e quais telas usar.
3. **Por fim `MATRIZ-FUNCOES-CASOS-USO.md`** — confere-se que nenhum caso de uso ficou órfão e qual tela é responsável por cada um.

## Categorias de casos de uso (60 UCs no total)

| Categoria | Sigla | Quantidade |
|---|---|---|
| Essenciais | UC-ES | 6 |
| Principais | UC-PR | 7 |
| Primários | UC-P1 | 7 |
| Secundários | UC-P2 | 6 |
| Auxiliares | UC-AX | 6 |
| De Exceção | UC-EX | 8 |
| De Suporte | UC-SU | 6 |
| De Contingência | UC-CO | 7 |
| De Gestão | UC-GE | 7 |
| De Auditoria | UC-AU | 8 |

## Fluxo do Wizard (resumo)

```
[0] Pré-flight     → autenticação, escolha de carteira
[1] Cidade         → escolha do município, abre/recupera sessão
[2] Discovery      → dados brutos → ETL (Extração / Treat / Catalog)
[3] Diagnóstico    → potencial, ganho/perda, categorias subnotificadas
[4] Simulação      → cenários "what-if" → cenário-alvo
[5] Compliance     → 5 seções A–E, item-a-item, evidências
[6] Plano de Ação  → curto (7 semanas) + médio + longo
[7] Documentos     → minuta CME, decreto, resolução, publicação
[8] Execução       → acompanhamento semanal até 27/Mai/2026
[9] Entrega        → snapshot imutável, dossiê, encerramento
```

## Arquitetura (whiteboard)

```
CIDADE → WIZARD (steps) → Banco Dados ESTRUTURAL
              ▲
              │
   Banco Dados BRUTO
              │
   ┌──────────┴──────────┐
   │ 1- Extração         │
   │ 2- Treat            │
   │ 3- Catalog          │
   └─────────────────────┘
              │
              ▼
       Stored Procedures
              │
              ▼
   Banco Dados OPERACIONAL
              │
   ┌──────────┼──────────┐
   ▼          ▼          ▼
COMPLIANCE  FUNÇÕES   DASHBOARD
              │
   ┌──────────┼──────────┐
   ▼          ▼          ▼
 DIÁRIO   DECRETO   RESOLUÇÃO
```

## Próximos artefatos (futuros)

- `DATA-MODEL-DELTAS.md` — DDL Postgres das tabelas novas (`raw.*`, `audit.*`, `wizard_progress`, `scenarios`, `approvals`, `evidences`).
- `STORED-PROCEDURES.md` — assinaturas e contratos das SPs (`sp_recalcular_potencial`, `sp_atualizar_compliance`, `sp_consolidar_plano_acao`, `sp_gerar_minuta`, `sp_audit_log`, `sp_snapshot_sessao`).
- `WIZARD-ESQUELETO.md` — guia de implementação da Onda 1 (Next.js App Router + máquina de estados + persistência).
