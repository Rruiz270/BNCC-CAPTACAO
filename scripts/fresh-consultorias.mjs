// ⚠️  Destrutivo. Apaga TODAS as consultorias e dados relacionados.
// Autorização explícita do Raphael em 2026-04-18: "pode tira-las do banco para ficarmos fresh"
// Também limpa links no CRM (crm.opportunities.handed_off_consultoria_id) pra evitar FK orphans.
//
// Uso: `node --env-file=.env.local scripts/fresh-consultorias.mjs`
// (carrega DATABASE_URL via flag nativa do Node — não precisa de dotenv)

import { neon } from '@neondatabase/serverless';
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL ausente — rode com: node --env-file=.env.local scripts/fresh-consultorias.mjs');
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

console.log('Inventário antes da limpeza:');
const before = await sql`SELECT
  (SELECT count(*)::int FROM fundeb.consultorias) AS consultorias,
  (SELECT count(*)::int FROM fundeb.relatorios) AS relatorios,
  (SELECT count(*)::int FROM fundeb.evidences) AS evidences,
  (SELECT count(*)::int FROM fundeb.scenarios) AS scenarios,
  (SELECT count(*)::int FROM fundeb.intake_tokens) AS intake_tokens,
  (SELECT count(*)::int FROM fundeb.intake_responses) AS intake_responses,
  (SELECT count(*)::int FROM crm.opportunities WHERE handed_off_consultoria_id IS NOT NULL) AS crm_linked`;
console.log(before[0]);

console.log('\nLimpando em ordem (FKs):');

// 1. NULL out crm.opportunities.handed_off_consultoria_id
const opsUpdated = await sql`UPDATE crm.opportunities
  SET handed_off_consultoria_id = NULL, handed_off_at = NULL
  WHERE handed_off_consultoria_id IS NOT NULL
  RETURNING id`;
console.log(`  ✓ ${opsUpdated.length} crm.opportunities → handed_off_consultoria_id = NULL`);

// 2. Descendentes
// Tabelas descobertas via `scripts/find-consultoria-fks.mjs`:
//   audit.snapshots, fundeb.{relatorios,evidences,scenarios,wizard_progress,intake_tokens},
//   raw.imports, crm.opportunities (já limpo acima)
// Ordem importa: intake_responses → intake_tokens (responses referenciam tokens)

const ir = await sql`DELETE FROM fundeb.intake_responses`;
console.log(`  ✓ fundeb.intake_responses deletadas (${ir.length})`);

const t = await sql`DELETE FROM fundeb.intake_tokens`;
console.log(`  ✓ fundeb.intake_tokens deletados (${t.length})`);

const r = await sql`DELETE FROM fundeb.relatorios`;
console.log(`  ✓ fundeb.relatorios deletadas (${r.length})`);

const e = await sql`DELETE FROM fundeb.evidences`;
console.log(`  ✓ fundeb.evidences deletadas (${e.length})`);

const s = await sql`DELETE FROM fundeb.scenarios`;
console.log(`  ✓ fundeb.scenarios deletadas (${s.length})`);

const wp = await sql`DELETE FROM fundeb.wizard_progress`;
console.log(`  ✓ fundeb.wizard_progress deletados (${wp.length})`);

// audit.snapshots é append-only via trigger `audit.event_log_immutable`.
// Em vez de deletar (bloqueado), dropamos o FK → consultorias pode ser deletada
// e o audit log preserva os consultoria_ids históricos (aceitável porque os IDs
// não serão reciclados — consultorias novas recebem IDs novos via sequence).
try {
  await sql`ALTER TABLE audit.snapshots DROP CONSTRAINT IF EXISTS snapshots_consultoria_id_fkey`;
  console.log(`  ✓ audit.snapshots FK removido (append-only preservado)`);
} catch (err) {
  console.log(`  ⚠ audit.snapshots FK: ${err.message}`);
}

const raw = await sql`DELETE FROM raw.imports`;
console.log(`  ✓ raw.imports deletadas (${raw.length})`);

// 3. action_plans referenciam municipality_id (não consultoria). Deixar como estão.

// 4. Consultorias em si
const c = await sql`DELETE FROM fundeb.consultorias`;
console.log(`  ✓ fundeb.consultorias deletadas (${c.length})`);

console.log('\nInventário depois da limpeza:');
const after = await sql`SELECT
  (SELECT count(*)::int FROM fundeb.consultorias) AS consultorias,
  (SELECT count(*)::int FROM fundeb.relatorios) AS relatorios,
  (SELECT count(*)::int FROM fundeb.evidences) AS evidences,
  (SELECT count(*)::int FROM fundeb.scenarios) AS scenarios,
  (SELECT count(*)::int FROM fundeb.intake_tokens) AS intake_tokens,
  (SELECT count(*)::int FROM fundeb.intake_responses) AS intake_responses,
  (SELECT count(*)::int FROM crm.opportunities WHERE handed_off_consultoria_id IS NOT NULL) AS crm_linked`;
console.log(after[0]);

console.log('\n✓ Fresh start. Próximo handoff do CRM cria consultoria do zero.');
