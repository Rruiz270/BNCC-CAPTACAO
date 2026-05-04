// Load IDEB 2023 (Pública dependência) into fundeb.municipalities.
// Source: /Users/raphaelruiz/inep-scrape/ideb-2023-by-muni.json
//
// Usage: DATABASE_URL=<...> node scripts/seed-ideb.mjs
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

const URL = process.env.DATABASE_URL;
if (!URL) { console.error('DATABASE_URL required'); process.exit(1); }
const sql = neon(URL);
const SRC = '/Users/raphaelruiz/inep-scrape/ideb-2023-by-muni.json';
const t0 = Date.now();
const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

log('reading source...');
const data = JSON.parse(readFileSync(SRC, 'utf8'));
log(`got ${data.length} municípios`);

log('fetching ibge → id map...');
const idRows = await sql`SELECT id, codigo_ibge FROM fundeb.municipalities`;
const ibgeToId = new Map(idRows.map((r) => [r.codigo_ibge, r.id]));
log(`  ${ibgeToId.size} ids cached`);

const records = data
  .map((r) => ({
    id: ibgeToId.get(String(r.co_municipio).padStart(7, '0')),
    ai: r.ideb_ai ?? null,
    af: r.ideb_af ?? null,
  }))
  .filter((r) => r.id);
log(`  ${records.length} records mapped`);

const BATCH = 200;
function chunks(arr, n) { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }

let done = 0;
for (const batch of chunks(records, BATCH)) {
  const ids = batch.map((r) => r.id);
  const aiCases = batch.map((r) => `WHEN ${r.id} THEN ${r.ai ?? 'NULL'}::real`).join(' ');
  const afCases = batch.map((r) => `WHEN ${r.id} THEN ${r.af ?? 'NULL'}::real`).join(' ');
  await sql.query(
    `UPDATE fundeb.municipalities SET
       ideb_ai = CASE id ${aiCases} END,
       ideb_af = CASE id ${afCases} END
     WHERE id IN (${ids.join(',')})`
  );
  done += batch.length;
  if (done % 1000 === 0 || done === records.length) log(`  ${done}/${records.length}`);
}

const summary = await sql`
  SELECT count(*) FILTER (WHERE ideb_ai IS NOT NULL) as com_ai,
         count(*) FILTER (WHERE ideb_af IS NOT NULL) as com_af,
         count(*) as total
  FROM fundeb.municipalities`;
log(`DONE. ${JSON.stringify(summary[0])}`);

// Spot-check
const sample = await sql`
  SELECT nome, uf, total_escolas, ideb_ai, ideb_af
  FROM fundeb.municipalities
  WHERE nome IN ('ABAIARA','BELO HORIZONTE','SAO PAULO','RIO BRANCO') AND uf IN ('CE','MG','SP','AC')
  ORDER BY uf`;
console.log('Spot check:'); console.table(sample);
