# Operações — BNCC-CAPTACAO

## 1. O que é

CRM e portal de consultorias FUNDEB do Instituto i10: plataforma em formato **wizard** que guia o consultor de ponta a ponta na consultoria FUNDEB de um município (cidade → diagnóstico → plano de ação → documentos oficiais → acompanhamento de execução). Público-alvo: consultores do Instituto i10 e secretarias municipais de educação (leads/oportunidades no CRM interno; portais públicos de intake e acompanhamento para o município). Status: em desenvolvimento ativo — últimos commits:

```
2026-07-10 feat(ux): prazos dinâmicos no compliance + acentuação + estados vazios com CTA
2026-07-09 chore: remover peso morto — páginas mock/duplicadas e pastas legadas
2026-07-09 fix: excluir subprojeto AIFLUENT do type-check do build raiz
```

Detalhes de arquitetura e casos de uso: `docs/blueprint/` (BLUEPRINT.md, WIZARD.md).

## 2. Onde roda

| Item | Valor |
|---|---|
| URL de produção | https://bncc-captacao.vercel.app |
| Projeto Vercel | `bncc-captacao` (framework Next.js) |
| Deploy | Push na branch `main` = deploy de produção automático via Vercel |
| Domínio custom | Nenhum (só o `.vercel.app`) |

Obs.: o repositório contém subprojetos não relacionados ao app principal (`AIFLUENT/`, `Dev-Projetos/`) — o build raiz os ignora.

## 3. Dados

- Banco: **Neon, database `bncc_webinar`** (valor em `DATABASE_URL` na Vercel).
- ORM: **Drizzle** (`drizzle-orm` + driver `@neondatabase/serverless`); config em `drizzle.config.ts`, schema em `src/lib/schema.ts` e `src/lib/auth-schema.ts`, migrations em `drizzle/`.
- Schemas Postgres usados: `fundeb` (dados estruturais dos municípios, matrículas, leads, snapshots), `raw` (dados brutos de ETL), `audit` (auditoria) e `crm` (usuários/auth, oportunidades).
- ⚠️ Este Neon é COMPARTILHADO com outros produtos — mudanças de schema/rotação de senha são SEMPRE coordenadas; fora do schema `crm.*`, tratar como read-only.

## 4. Env vars

Nomes apenas (valores vivem na Vercel / `.env.local` local — nunca commitados):

| Nome | Onde vive | Para quê |
|---|---|---|
| `DATABASE_URL` | Vercel + `.env.local` | Conexão com o Neon (database `bncc_webinar`) |
| `AUTH_SECRET` | Vercel + `.env.local` | Segredo de sessão do Auth.js (NextAuth v5) |
| `AUTH_URL` | Vercel + `.env.local` | URL base do app para o Auth.js |
| `AUTH_TRUST_HOST` | Vercel + `.env.local` | Confiar no host do proxy (necessário na Vercel) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Vercel + `.env.local` | Login Google (OAuth) via Auth.js |
| `ADMIN_EMAILS` | Vercel + `.env.local` | Lista de e-mails com papel admin |
| `GOOGLE_CALENDAR_DEFAULT_TIMEZONE` | Vercel + `.env.local` | Timezone padrão para agendamentos |
| `TESTNEON_*` (família) | `.env.local` | Variáveis do banco Neon de TESTE (integração Vercel/Neon) — usadas por `drizzle.config.test.ts` e scripts de sync |
| `VERCEL_OIDC_TOKEN` | Gerado pela Vercel | Token OIDC injetado pela plataforma |

## 5. Como rodar local

```bash
npm install
npm run dev      # Next.js dev server em http://localhost:3000
npm run build    # build de produção
npm run lint     # eslint
```

Requer `.env.local` com as variáveis da seção 4 (pelo menos `DATABASE_URL` e as `AUTH_*`).

## 6. Crons & automations

- **Vercel crons**: nenhum (`vercel.json` só define o framework).
- **GitHub Actions**: nenhum workflow configurado.
- **Scripts manuais** (`scripts/*.mjs`, rodados à mão com `node`, leem `.env.local`):
  - `import-leads.mjs` — importa ranking de interesse em consultoria para `fundeb.leads` (idempotente, UPSERT).
  - `seed-censo-escolar.mjs`, `seed-ideb.mjs`, `seed-microdados-infra.mjs` — enriquecem `fundeb.municipalities` com Censo Escolar, IDEB e microdados.
  - `backfill-nonsp-analytics.mjs` — backfill de analytics para municípios fora de SP.
  - `ensure-gain-snapshots.mjs` — cria `fundeb.gain_snapshots` (idempotente).
  - `migrate-prod-multi-uf.mjs` — migração aditiva multi-UF (só ADD COLUMN / CREATE TABLE / inserts idempotentes).
  - `sync-schema-from-prod.mjs` — reconcilia schema PROD → TESTE (schema only, sem dados).
  - `fresh-consultorias.mjs` — ⚠️ DESTRUTIVO: apaga todas as consultorias; só rodar com autorização explícita.
  - `seed-nationwide-test.mjs`, `find-consultoria-fks.mjs`, `simulation/` — utilitários de teste/diagnóstico.

## 7. Diagnóstico rápido

1. **Está no ar?** `curl -s -o /dev/null -w '%{http_code}' https://bncc-captacao.vercel.app` → esperado `307` (redireciona para `/login`, pois o app inteiro exige sessão). `307` = vivo e protegido; `200` na raiz seria inesperado; `5xx` = problema.
2. **Login funciona?** Abrir https://bncc-captacao.vercel.app → deve cair em `/login` e autenticar via Auth.js (credenciais ou Google).
3. **Rotas públicas por design**: `/intake/[token]` e `/acompanhamento/[token]` são acessíveis sem login de propósito — são os portais do município via link tokenizado. Não exigem sessão; isso é comportamento esperado.
4. **Logs**: dashboard da Vercel → projeto `bncc-captacao` → Deployments/Logs (runtime e build).
5. **Erros prováveis**:
   - `500` em páginas de dados → checar `DATABASE_URL` na Vercel e disponibilidade do Neon; drift de schema entre teste e prod também causa 500 (ver `sync-schema-from-prod.mjs`).
   - Loop de redirect ou falha de login → checar `AUTH_SECRET`, `AUTH_URL` e `AUTH_TRUST_HOST`.
   - Build quebrado no deploy → rodar `npm run build` local; o type-check exclui o subprojeto `AIFLUENT/`.
