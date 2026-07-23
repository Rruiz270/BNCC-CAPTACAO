<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# BNCC-CAPTACAO

CRM e portal de consultorias FUNDEB do Instituto i10: plataforma em formato **wizard** que guia o consultor de ponta a ponta (cidade → diagnóstico → plano de ação → documentos oficiais → acompanhamento de execução), com portais públicos tokenizados de intake/acompanhamento para os municípios e uma camada de IA (Claude).

> `CLAUDE.md` referencia este arquivo (`@AGENTS.md`). Detalhes operacionais completos (URL, diagnóstico, crons, scripts) estão em **`OPERATIONS.md`** e a arquitetura/casos de uso em **`docs/blueprint/`** — este AGENTS.md não os duplica; consulte-os.

## Stack

- **Framework**: Next.js **16.2.3** (App Router) — leia os guias em `node_modules/next/dist/docs/` antes de codar; a API difere do Next que você conhece.
- **Runtime UI**: React **19.2.4** / React DOM 19.2.4.
- **Linguagem**: TypeScript **^5** (strict mode ligado — ver `tsconfig.json`), alias `@/*` → `src/*`.
- **Banco**: **Neon (Postgres)**, database `bncc_webinar` (via `DATABASE_URL`). Compartilhado com outros produtos — ver secção Segurança.
- **ORM**: **Drizzle** (`drizzle-orm` + `drizzle-kit`) com driver `@neondatabase/serverless`. Config em `drizzle.config.ts`; migrations em `drizzle/`.
- **Auth**: **NextAuth v5 / Auth.js** (`next-auth@5 beta` + `@auth/drizzle-adapter`), credenciais (bcryptjs) e Google OAuth.
- **IA**: **Anthropic SDK** (`@anthropic-ai/sdk`) — cliente em `src/lib/ai/`.
- **UI**: Radix UI, Tailwind CSS **v4** (`@tailwindcss/postcss`), `class-variance-authority`, `clsx`, `tailwind-merge`, Lucide, Recharts. Validação com Zod v4; CSV via papaparse.
- **Package manager**: **npm** (lockfile `package-lock.json`).
- **Deploy**: **Vercel** (`vercel.json` → framework nextjs), auto-deploy no push da `main`.

## Comandos

Scripts reais de `package.json`:

```bash
npm install
npm run dev      # next dev  → http://localhost:3000
npm run build    # next build (type-check exclui o subprojeto AIFLUENT/)
npm run start    # next start (serve o build)
npm run lint     # eslint
```

Requer `.env.local` com pelo menos `DATABASE_URL` e as `AUTH_*` (ver Variáveis de ambiente). Não há script de teste no `package.json` (ver Testes).

## Estrutura

```
src/app/(app)/         # área autenticada (CRM, wizard, dashboards)
src/app/(public)/      # portais públicos: /intake/[token], /acompanhamento/[token]
src/app/apm/           # rotas da vertente APM
src/app/api/           # route handlers / API
src/app/login/         # login (Auth.js)
src/components/wizard/  # UI do wizard de consultoria
src/components/ai/      # UI da camada de IA
src/lib/schema.ts, auth-schema.ts   # schema Drizzle (fundeb, raw, audit, crm)
src/lib/ai/            # client.ts, contexto.ts (Anthropic)
src/lib/etl/, fundeb/, wizard/, actions/, db/   # domínio, server actions, acesso a dados
drizzle/               # migrations geradas
scripts/*.mjs          # scripts manuais (seed/import/migração) — rodados com `node`
docs/blueprint/        # BLUEPRINT.md, WIZARD.md e afins (arquitetura/casos de uso)
AIFLUENT/, Dev-Projetos/   # subprojetos NÃO relacionados ao app; excluídos do build raiz
```

## Convenções de código

- **TypeScript strict** — sem `any` gratuito; tipe o domínio. `moduleResolution: bundler`, `isolatedModules`.
- **ESLint** flat config (`eslint.config.mjs`) usando `eslint-config-next` (core-web-vitals + typescript). Rode `npm run lint` antes do PR.
- Acesso a dados via **Drizzle** e **server actions** (`src/lib/actions/`) — não espalhar SQL cru pelos componentes.
- Fora do schema `crm.*`, tratar o banco como **read-only** (ver Segurança).
- Import path alias `@/…` (nunca caminhos relativos longos).
- Tailwind v4 (config via PostCSS) — prefira utilitárias.
- i18n de UI: strings em **português com acento** (padrão do projeto).

## Variáveis de ambiente

Somente **nomes** — valores vivem na Vercel / `.env.local`, nunca commitados (ver `OPERATIONS.md` §4 para a tabela completa):

| Nome | Para quê |
|---|---|
| `DATABASE_URL` | Conexão Neon (`bncc_webinar`) |
| `AUTH_SECRET` | Segredo de sessão do Auth.js |
| `AUTH_URL` / `AUTH_TRUST_HOST` | URL base e trust do proxy (necessário na Vercel) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Login Google (OAuth) |
| `ADMIN_EMAILS` | E-mails com papel admin |
| `ANTHROPIC_API_KEY` | Camada de IA (Claude) em `src/lib/ai/` |
| `GOOGLE_CALENDAR_DEFAULT_TIMEZONE` | Timezone padrão de agendamentos |
| `FNDE_DATA_PATH` / `SP_DATA_PATH` | Caminhos de dados FNDE/SP para ETL/seed |
| `TESTNEON_*` (família) | Neon de **teste** (`drizzle.config.test.ts` / scripts de sync) |
| `VERCEL_OIDC_TOKEN` | Injetado pela Vercel |

## CI/CD & Deploy

- **Deploy**: Vercel, auto-deploy no push da `main` (produção). `vercel.json` só define o framework.
- **Crons Vercel**: nenhum. **GitHub Actions**: nenhum workflow configurado.
- **Recomendado (mínimo)**: workflow em PR rodando `npm ci` + `npm run lint` + type-check (`npx tsc --noEmit`) + `npm run build`. Isso barra drift de tipo/schema antes do deploy — hoje um erro só aparece no build da Vercel.
- Migrations de schema são geradas via `drizzle-kit` (config em `drizzle.config.ts`); aplique de forma coordenada (banco compartilhado).

## Boas práticas de PR

- Branch naming: `feat/…`, `fix/…`, `chore/…`, `docs/…`.
- **Conventional Commits** (padrão já usado no histórico: `feat(ux): …`, `fix: …`, `chore(i18n): …`).
- PRs pequenos e focados. Checklist antes de pedir review:
  - `npm run build` e `npm run lint` passam localmente;
  - **nenhum segredo/`.env` commitado**;
  - mudanças de schema acompanhadas de migration Drizzle **com caminho de rollback** e coordenadas (Neon compartilhado);
  - **screenshots** para qualquer alteração de UI (wizard/CRM/portais).
- ≥1 review, **squash merge**, manter a `main` sempre deployável (é produção).

## Testes

- **Playwright** está instalado (`devDependencies`), mas **não há script de teste** no `package.json` nem specs versionadas de forma óbvia — não há suíte rodável por `npm test` hoje.
- Há utilitários de simulação/diagnóstico em `scripts/` (`scripts/simulation/`, `find-consultoria-fks.mjs`, `seed-nationwide-test.mjs`) e um Neon de teste (`TESTNEON_*`).
- **Recomendação**: adicionar um script `test:e2e` que rode Playwright contra o dev server, cobrindo pelo menos login (Auth.js) e o fluxo do wizard, e/ou testes unitários das funções puras em `src/lib/fundeb/` e `src/lib/wizard/`.

## Segurança & dados

- **Nunca** commitar `.env.local`/segredos. Não logar `DATABASE_URL`, `AUTH_SECRET` nem `ANTHROPIC_API_KEY`.
- ⚠️ **Neon compartilhado** com outros produtos: mudanças de schema e rotação de senha são **sempre coordenadas**; fora do schema `crm.*`, tratar como **read-only**.
- **LGPD**: o app lida com dados de gestores municipais, leads e oportunidades (schemas `fundeb`/`crm`). Portais públicos `/intake/[token]` e `/acompanhamento/[token]` são acessíveis **sem login por design** (link tokenizado) — proteja os tokens e não exponha dados além do escopo do município.
- Revisar deps periodicamente (NextAuth beta e Next 16 são versões de ponta).

## Gotchas

- **Next 16 ≠ Next que você conhece** — leia `node_modules/next/dist/docs/` antes de escrever código; APIs e convenções mudaram (bloco no topo deste arquivo).
- **Subprojetos `AIFLUENT/` e `Dev-Projetos/`** vivem no mesmo repo mas **não fazem parte do app**; o `tsconfig.json` exclui `AIFLUENT` do type-check do build raiz — não o reintroduza no build.
- **Script destrutivo**: `scripts/fresh-consultorias.mjs` **apaga todas as consultorias** — só rodar com autorização explícita.
- Migração multi-UF (`migrate-prod-multi-uf.mjs`) é **aditiva** (só ADD COLUMN / CREATE TABLE / inserts idempotentes); mantenha esse padrão.
- Diagnóstico de "está no ar": a raiz responde **`307`** (redireciona para `/login`, pois o app inteiro exige sessão) — `307` = vivo e protegido, não é erro (ver `OPERATIONS.md` §7).
- `500` em páginas de dados costuma ser `DATABASE_URL` ausente **ou drift de schema** teste↔prod (ver `sync-schema-from-prod.mjs`). Loop de login = checar `AUTH_SECRET`/`AUTH_URL`/`AUTH_TRUST_HOST`.
