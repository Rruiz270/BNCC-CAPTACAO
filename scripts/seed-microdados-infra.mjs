// Phase 3 enrichment: Censo Escolar 2024 Microdados → infrastructure %
// Aggregates 215k schools by município and updates pct_internet/biblioteca/quadra/lab_info.
//
// Usage: DATABASE_URL=<test> node scripts/seed-microdados-infra.mjs
import { spawn } from 'node:child_process';
import { neon } from '@neondatabase/serverless';

const URL = process.env.DATABASE_URL;
if (!URL) { console.error('DATABASE_URL required'); process.exit(1); }
const sql = neon(URL);
const CSV = '/tmp/inep-multiufa/microdados_censo_escolar_2024/dados/microdados_ed_basica_2024.csv';
const t0 = Date.now();
const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

// Aggregate via awk — much faster than Node for a 200k-row, semicolon-delimited file
// with Latin-1 encoding. Outputs: ibge|total|internet|biblioteca|quadra|lab
log('aggregating microdados via awk...');
const aggregate = () => new Promise((resolve, reject) => {
  // Column indexes (1-based, awk-style):
  //   8=CO_MUNICIPIO  32=TP_SITUACAO_FUNCIONAMENTO (=1 active)
  //   117=IN_BIBLIOTECA  124=IN_LABORATORIO_INFORMATICA
  //   130=IN_QUADRA_ESPORTES  187=IN_INTERNET
  const awkScript = `
    BEGIN { FS=";" }
    NR == 1 { next }                                    # skip header
    $32 != "1" { next }                                 # only "Em atividade"
    {
      ibge = $8
      total[ibge]++
      if ($187 == "1") inet[ibge]++
      if ($117 == "1") bib[ibge]++
      if ($130 == "1") quad[ibge]++
      if ($124 == "1") lab[ibge]++
    }
    END {
      for (i in total) printf "%s|%d|%d|%d|%d|%d\\n", i, total[i], inet[i]+0, bib[i]+0, quad[i]+0, lab[i]+0
    }
  `;
  const proc = spawn('awk', [awkScript, CSV]);
  const recs = [];
  let buf = '';
  proc.stdout.on('data', (d) => {
    buf += d.toString();
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const [ibge, total, inet, bib, quad, lab] = line.split('|').map(Number);
      recs.push({
        ibge: String(ibge).padStart(7, '0'),
        total, inet, bib, quad, lab,
      });
    }
  });
  let err = '';
  proc.stderr.on('data', (d) => { err += d.toString(); });
  proc.on('close', (code) => {
    if (code !== 0) reject(new Error('awk exit ' + code + ': ' + err));
    else { if (buf.trim()) {} resolve(recs); }
  });
});

const recs = await aggregate();
log(`got ${recs.length} municípios`);

// Build IBGE → muni_id map
log('fetching ibge → id map...');
const idRows = await sql`SELECT id, codigo_ibge FROM fundeb.municipalities`;
const ibgeToId = new Map(idRows.map((r) => [r.codigo_ibge, r.id]));
log(`  ${ibgeToId.size} ids cached`);

// Compute % and prepare batch updates
const records = recs
  .map((r) => {
    const id = ibgeToId.get(r.ibge);
    if (!id || r.total === 0) return null;
    return {
      id,
      pct_internet: (r.inet / r.total) * 100,
      pct_biblioteca: (r.bib / r.total) * 100,
      pct_quadra: (r.quad / r.total) * 100,
      pct_lab_info: (r.lab / r.total) * 100,
    };
  })
  .filter(Boolean);
log(`  ${records.length} records mapped to DB ids`);

// UPDATE in batches via CASE WHEN
const BATCH = 200;
function chunks(arr, n) { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }

let done = 0;
for (const batch of chunks(records, BATCH)) {
  const ids = batch.map((r) => r.id);
  const inetCases = batch.map((r) => `WHEN ${r.id} THEN ${r.pct_internet.toFixed(2)}`).join(' ');
  const bibCases = batch.map((r) => `WHEN ${r.id} THEN ${r.pct_biblioteca.toFixed(2)}`).join(' ');
  const quadCases = batch.map((r) => `WHEN ${r.id} THEN ${r.pct_quadra.toFixed(2)}`).join(' ');
  const labCases = batch.map((r) => `WHEN ${r.id} THEN ${r.pct_lab_info.toFixed(2)}`).join(' ');
  await sql.query(
    `UPDATE fundeb.municipalities SET
       pct_internet   = CASE id ${inetCases} END,
       pct_biblioteca = CASE id ${bibCases} END,
       pct_quadra     = CASE id ${quadCases} END,
       pct_lab_info   = CASE id ${labCases} END
     WHERE id IN (${ids.join(',')})`
  );
  done += batch.length;
  if (done % 1000 === 0 || done === records.length) log(`  ${done}/${records.length}`);
}

const summary = await sql`
  SELECT count(*) FILTER (WHERE pct_internet IS NOT NULL) as com_inet,
         count(*) FILTER (WHERE pct_biblioteca IS NOT NULL) as com_bib,
         count(*) FILTER (WHERE pct_quadra IS NOT NULL) as com_quad,
         count(*) FILTER (WHERE pct_lab_info IS NOT NULL) as com_lab,
         count(*) as total
  FROM fundeb.municipalities`;
log(`DONE. ${JSON.stringify(summary[0])}`);
