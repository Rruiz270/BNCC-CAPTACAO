// Phase 2 enrichment: load Censo Escolar 2024 (Sinopse Estatística) into
// fundeb.municipalities for all 5,569 munis.
// Sheets used:
//   3.2 → escolas (total, urbana × dep, rural × dep)
//   2.1 → docentes
//   4.1 → turmas
//
// Column layout 3.2 (verified):
//   0 região | 1 uf | 2 município | 3 ibge | 4 total | 5 urb_total | 6 urb_fed | 7 urb_est | 8 urb_mun | 9 urb_priv | 10 rur_total | 11 rur_fed | 12 rur_est | 13 rur_mun | 14 rur_priv
//
// Usage: DATABASE_URL=<test> node scripts/seed-censo-escolar.mjs
import { spawn } from 'node:child_process';
import { neon } from '@neondatabase/serverless';

const URL = process.env.DATABASE_URL;
if (!URL) { console.error('DATABASE_URL required'); process.exit(1); }
const sql = neon(URL);

const XLSX = '/Users/raphaelruiz/Downloads/fundeb-sp-2026/fnde_data_2026/inep/sinopse_estatistica_censo_escolar_2024/Sinopse_Estatistica_da_Educação_Basica_2024.xlsx';
const BATCH = 200;
const t0 = Date.now();
const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

// Use python (already on system + has openpyxl) to extract sheets as JSON-lines.
// Avoids npm install of xlsx parsers.
function extractSheet(sheet) {
  return new Promise((resolve, reject) => {
    const code = `
import openpyxl, json, sys
wb = openpyxl.load_workbook(r'${XLSX}', read_only=True, data_only=True)
ws = wb['${sheet}']
for i, row in enumerate(ws.iter_rows(values_only=True)):
    if i < 11: continue   # skip headers (rows 0-10) — data starts row 11
    ibge = row[3] if len(row) > 3 else None
    if not ibge: continue
    try: ibge = int(ibge)
    except: continue
    out = [ibge] + [int(c) if c not in (None,'',' ') else 0 for c in row[4:16]]
    sys.stdout.write(json.dumps(out) + '\\n')
`;
    const py = spawn('python3', ['-c', code]);
    const rows = [];
    let errBuf = '';
    py.stdout.on('data', (d) => {
      for (const line of d.toString().split('\n')) {
        if (!line.trim()) continue;
        try { rows.push(JSON.parse(line)); } catch {}
      }
    });
    py.stderr.on('data', (d) => { errBuf += d.toString(); });
    py.on('close', (code) => {
      if (code !== 0) reject(new Error('python exit ' + code + ': ' + errBuf));
      else resolve(rows);
    });
  });
}

function chunks(arr, n) { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }

// ── Step 1: read sheet 3.2 (escolas) ──────────────────────────
log('reading Estabelecimentos 3.2...');
const escolasRows = await extractSheet('3.2');
log(`got ${escolasRows.length} rows`);

// ── Step 2: read sheet 2.1 (docentes) ─────────────────────────
log('reading Docentes 2.1...');
const docentesRows = await extractSheet('Educação Básica 2.1');
log(`got ${docentesRows.length} rows`);

// ── Step 3: read sheet 4.1 (turmas) ───────────────────────────
log('reading Turmas 4.1...');
const turmasRows = await extractSheet('Educação Básica 4.1');
log(`got ${turmasRows.length} rows`);

// ── Step 4: build per-IBGE record with all metrics ────────────
const byIbge = new Map();
for (const r of escolasRows) {
  // r = [ibge, total, urb_total, urb_fed, urb_est, urb_mun, urb_priv, rur_total, rur_fed, rur_est, rur_mun, rur_priv]
  const [ibge, total, _urbT, _urbF, _urbE, urbMun, _urbP, rurT, _rurF, _rurE, rurMun] = r;
  byIbge.set(ibge, {
    total_escolas: total,
    escolas_municipais: (urbMun || 0) + (rurMun || 0),
    escolas_rurais: rurT,
  });
}
for (const r of docentesRows) {
  // r = [ibge, total_docentes, ...] — total is col 4 → index 1 of our slice
  const ibge = r[0]; const total = r[1];
  const e = byIbge.get(ibge); if (e) e.total_docentes = total;
}
for (const r of turmasRows) {
  const ibge = r[0]; const total = r[1];
  const e = byIbge.get(ibge); if (e) e.total_turmas = total;
}
log(`merged into ${byIbge.size} municipality records`);

// ── Step 5: build IBGE → muni_id map from DB ──────────────────
log('fetching ibge → id map...');
const idRows = await sql`SELECT id, codigo_ibge FROM fundeb.municipalities`;
const ibgeToId = new Map(idRows.map((r) => [parseInt(r.codigo_ibge, 10), r.id]));
log(`  ${ibgeToId.size} ids cached`);

// ── Step 6: UPDATE in batches via CASE WHEN ───────────────────
log('updating municipalities...');
const records = [...byIbge.entries()]
  .map(([ibge, m]) => ({ id: ibgeToId.get(ibge), ...m }))
  .filter((r) => r.id);
log(`  ${records.length} records have a matching DB row`);

let done = 0;
for (const batch of chunks(records, BATCH)) {
  const ids = batch.map((r) => r.id);
  const totalCases = batch.map((r) => `WHEN ${r.id} THEN ${r.total_escolas ?? 'NULL'}`).join(' ');
  const munCases = batch.map((r) => `WHEN ${r.id} THEN ${r.escolas_municipais ?? 'NULL'}`).join(' ');
  const ruralCases = batch.map((r) => `WHEN ${r.id} THEN ${r.escolas_rurais ?? 'NULL'}`).join(' ');
  const docCases = batch.map((r) => `WHEN ${r.id} THEN ${r.total_docentes ?? 'NULL'}`).join(' ');
  const turCases = batch.map((r) => `WHEN ${r.id} THEN ${r.total_turmas ?? 'NULL'}`).join(' ');
  await sql.query(
    `UPDATE fundeb.municipalities SET
        total_escolas      = CASE id ${totalCases} END,
        escolas_municipais = CASE id ${munCases} END,
        escolas_rurais     = CASE id ${ruralCases} END,
        total_docentes     = CASE id ${docCases} END,
        total_turmas       = CASE id ${turCases} END
      WHERE id IN (${ids.join(',')})`
  );
  done += batch.length;
  if (done % 1000 === 0 || done === records.length) log(`  ${done}/${records.length}`);
}

// ── Final summary ───────────────────────────────────────────
const summary = await sql`
  SELECT
    count(*) FILTER (WHERE total_escolas IS NOT NULL) as com_escolas,
    count(*) FILTER (WHERE escolas_municipais IS NOT NULL) as com_munic,
    count(*) FILTER (WHERE total_docentes IS NOT NULL) as com_doc,
    count(*) FILTER (WHERE total_turmas IS NOT NULL) as com_tur,
    count(*) as total
  FROM fundeb.municipalities`;
log(`DONE. ${JSON.stringify(summary[0])}`);
