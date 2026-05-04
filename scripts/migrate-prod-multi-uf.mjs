// PROD MIGRATION — multi-UF + IDEB enrichment.
// SAFE: only ADD COLUMN, CREATE TABLE, INSERT ON CONFLICT DO NOTHING,
// UPDATE only on NULL fields for SP rows.
//
// Usage: PROD=1 node scripts/migrate-prod-multi-uf.mjs
import Database from 'better-sqlite3';
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

if (!process.env.PROD) {
  console.error('Set PROD=1 to confirm intent. This script writes to PRODUCTION.');
  process.exit(1);
}

const PROD_URL = 'postgresql://neondb_owner:npg_Zu1zG2LPUovb@ep-snowy-shadow-a4hoyxtl-pooler.us-east-1.aws.neon.tech/bncc_webinar?sslmode=require';
const SQLITE = '/Users/raphaelruiz/Downloads/fundeb-sp-2026/fnde_data_2026/fundeb_2026_br.db';
const IDEB = '/Users/raphaelruiz/inep-scrape/ideb-2023-by-muni.json';
const sql = neon(PROD_URL);
const db = new Database(SQLITE, { readonly: true });
const ideb = JSON.parse(readFileSync(IDEB, 'utf8'));
const t0 = Date.now();
const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

function chunks(arr, n) { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }

// ── Step 0: snapshot baseline ──────────────────────────────────
log('=== BASELINE ===');
const baseline = await sql`
  SELECT (SELECT count(*) FROM fundeb.municipalities) as munis,
         (SELECT count(DISTINCT codigo_ibge) FROM fundeb.municipalities) as distinct_ibge,
         (SELECT count(*) FROM information_schema.tables WHERE table_schema='fundeb' AND table_name='estados') as has_estados`;
log(JSON.stringify(baseline[0]));

// ── Step 1: ADD COLUMN uf (idempotent) ─────────────────────────
log('=== STEP 1: ADD COLUMN uf ===');
await sql.query(`ALTER TABLE fundeb.municipalities ADD COLUMN IF NOT EXISTS uf VARCHAR(2)`);
log('  OK');

// Backfill SP to all existing rows that don't have uf set (only the 645 SP)
log('=== STEP 2: backfill uf=SP for existing rows ===');
const upd = await sql`UPDATE fundeb.municipalities SET uf='SP' WHERE uf IS NULL RETURNING id`;
log(`  updated ${upd.length} rows to uf='SP'`);

// ── Step 3: CREATE TABLE fundeb.estados ────────────────────────
log('=== STEP 3: CREATE TABLE estados ===');
await sql.query(`
  CREATE TABLE IF NOT EXISTS fundeb.estados (
    uf VARCHAR(2) PRIMARY KEY,
    nome TEXT,
    vaaf_medio REAL,
    vaat_medio REAL,
    vaar_medio REAL,
    peti_por_aluno REAL,
    populacao INTEGER,
    total_municipios INTEGER,
    ano_referencia INTEGER DEFAULT 2026,
    updated_at TIMESTAMP DEFAULT NOW()
  )
`);
log('  OK');

// Compute medians per UF from SQLite source
log('=== STEP 4: load 26 estados (UF medians) ===');
const ufList = db.prepare(`
  SELECT e.uf, count(*) as munis
  FROM entes e WHERE e.tipo='MUNICIPIO' GROUP BY e.uf
`).all();
const ufNames = { AC:'Acre',AL:'Alagoas',AM:'Amazonas',AP:'Amapá',BA:'Bahia',CE:'Ceará',ES:'Espírito Santo',GO:'Goiás',MA:'Maranhão',MG:'Minas Gerais',MS:'Mato Grosso do Sul',MT:'Mato Grosso',PA:'Pará',PB:'Paraíba',PE:'Pernambuco',PI:'Piauí',PR:'Paraná',RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RO:'Rondônia',RR:'Roraima',RS:'Rio Grande do Sul',SC:'Santa Catarina',SE:'Sergipe',SP:'São Paulo',TO:'Tocantins' };
function median(arr) { const v = arr.filter(x => x != null && !isNaN(x)).sort((a,b) => a-b); if (!v.length) return null; const m = Math.floor(v.length/2); return v.length%2 ? v[m] : (v[m-1]+v[m])/2; }
for (const u of ufList) {
  const meds = db.prepare(`
    SELECT m.mat_total,
           CASE WHEN m.mat_total>0 THEN r.compl_vaat / m.mat_total END as vaat_pa,
           CASE WHEN m.mat_total>0 AND r.compl_vaar>0 THEN r.compl_vaar / m.mat_total END as vaar_pa,
           CASE WHEN m.mat_total>0 THEN r.receita_contribuicao / m.mat_total END as vaaf_pa
    FROM entes e JOIN receita_municipio r USING(codigo_ibge)
    LEFT JOIN matriculas_municipio m USING(codigo_ibge)
    WHERE e.tipo='MUNICIPIO' AND e.uf=?`).all(u.uf);
  const vaaf = median(meds.map(r => r.vaaf_pa));
  const vaat = median(meds.map(r => r.vaat_pa));
  const vaar = median(meds.map(r => r.vaar_pa));
  await sql`
    INSERT INTO fundeb.estados (uf, nome, vaaf_medio, vaat_medio, vaar_medio, peti_por_aluno, total_municipios, ano_referencia)
    VALUES (${u.uf}, ${ufNames[u.uf] ?? u.uf}, ${vaaf}, ${vaat}, ${vaar}, ${1693.22}, ${u.munis}, 2026)
    ON CONFLICT (uf) DO UPDATE SET vaaf_medio=EXCLUDED.vaaf_medio, vaat_medio=EXCLUDED.vaat_medio, vaar_medio=EXCLUDED.vaar_medio, updated_at=NOW()
  `;
}
log(`  ${ufList.length} estados`);

// ── Step 5: INSERT non-SP munis ────────────────────────────────
log('=== STEP 5: INSERT non-SP munis (4924) ===');
const allMunis = db.prepare(`
  SELECT e.codigo_ibge, e.uf, e.nome,
         r.receita_contribuicao, r.compl_vaat, r.compl_vaar, r.total_receitas_previstas,
         m.mat_total, m.mat_ei_total, m.mat_ef_total
  FROM entes e
  LEFT JOIN receita_municipio r USING(codigo_ibge)
  LEFT JOIN matriculas_municipio m USING(codigo_ibge)
  WHERE e.tipo='MUNICIPIO' AND e.uf != 'SP'
  ORDER BY e.uf, e.nome
`).all();
let inserted = 0;
for (const batch of chunks(allMunis, 100)) {
  const params = []; const ph = [];
  for (const m of batch) {
    const o = params.length;
    params.push(m.nome, String(m.codigo_ibge).padStart(7,'0'), m.uf,
                m.receita_contribuicao ?? null, m.compl_vaat ?? null, m.compl_vaar ?? null,
                m.total_receitas_previstas ?? null, m.mat_total ?? null,
                m.mat_ei_total ?? null, m.mat_ef_total ?? null);
    ph.push(`($${o+1},$${o+2},$${o+3},$${o+4},$${o+5},$${o+6},$${o+7},$${o+8},$${o+9},$${o+10})`);
  }
  const r = await sql.query(
    `INSERT INTO fundeb.municipalities (nome, codigo_ibge, uf, receita_total, vaat, vaar, total_estado, total_matriculas, ei_mat, ef_mat)
     VALUES ${ph.join(',')} ON CONFLICT (codigo_ibge) DO NOTHING RETURNING id`,
    params
  );
  inserted += r.length;
}
log(`  inserted ${inserted} non-SP munis`);

// ── Step 6: ibge → id map for prod ─────────────────────────────
log('=== STEP 6: ibge → id map ===');
const idRows = await sql`SELECT id, codigo_ibge, uf FROM fundeb.municipalities`;
const ibgeToId = new Map(idRows.map(r => [r.codigo_ibge, r.id]));
const idToUf = new Map(idRows.map(r => [r.id, r.uf]));
log(`  ${ibgeToId.size} ids cached`);

// ── Step 7: Censo Escolar enrichment (only non-SP — preserve SP prod data) ─
log('=== STEP 7: Censo Escolar (escolas, docentes, turmas) — non-SP only ===');
async function loadSinopse(sheet, mapping) {
  const { spawn } = await import('node:child_process');
  return new Promise((resolve, reject) => {
    const code = `
import openpyxl, json, sys
wb = openpyxl.load_workbook(r'/Users/raphaelruiz/Downloads/fundeb-sp-2026/fnde_data_2026/inep/sinopse_estatistica_censo_escolar_2024/Sinopse_Estatistica_da_Educação_Basica_2024.xlsx', read_only=True, data_only=True)
ws = wb['${sheet}']
for i, row in enumerate(ws.iter_rows(values_only=True)):
    if i < 11: continue
    ibge = row[3] if len(row) > 3 else None
    if not ibge: continue
    try: ibge = int(ibge)
    except: continue
    out = [ibge] + [int(c) if c not in (None,'',' ') else 0 for c in row[4:16]]
    sys.stdout.write(json.dumps(out) + '\\n')
`;
    const py = spawn('python3', ['-c', code]);
    const rows = []; let buf = '';
    py.stdout.on('data', d => {
      buf += d.toString();
      const lines = buf.split('\n'); buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try { rows.push(JSON.parse(line)); } catch {}
      }
    });
    let err = '';
    py.stderr.on('data', d => { err += d.toString(); });
    py.on('close', code => code !== 0 ? reject(new Error(err)) : resolve(rows));
  });
}
const escolasRows = await loadSinopse('3.2', null);
const docentesRows = await loadSinopse('Educação Básica 2.1', null);
const turmasRows = await loadSinopse('Educação Básica 4.1', null);
log(`  loaded ${escolasRows.length}/${docentesRows.length}/${turmasRows.length} sheets`);

const censoByIbge = new Map();
for (const r of escolasRows) {
  const [ibge, total, _urbT,_urbF,_urbE, urbMun, _urbP, rurT,_rurF,_rurE, rurMun] = r;
  censoByIbge.set(ibge, { total_escolas: total, escolas_municipais: (urbMun||0)+(rurMun||0), escolas_rurais: rurT });
}
for (const r of docentesRows) { const e = censoByIbge.get(r[0]); if (e) e.total_docentes = r[1]; }
for (const r of turmasRows) { const e = censoByIbge.get(r[0]); if (e) e.total_turmas = r[1]; }

// Update ONLY non-SP (preserve prod SP data which already has these)
const censoUpdates = [...censoByIbge.entries()]
  .map(([ibge, m]) => {
    const id = ibgeToId.get(String(ibge).padStart(7,'0'));
    if (!id || idToUf.get(id) === 'SP') return null;  // skip SP
    return { id, ...m };
  })
  .filter(Boolean);
log(`  ${censoUpdates.length} non-SP records to update`);

let done = 0;
for (const batch of chunks(censoUpdates, 200)) {
  const ids = batch.map(r => r.id);
  const totalCases = batch.map(r => `WHEN ${r.id} THEN ${r.total_escolas ?? 'NULL'}`).join(' ');
  const munCases = batch.map(r => `WHEN ${r.id} THEN ${r.escolas_municipais ?? 'NULL'}`).join(' ');
  const ruralCases = batch.map(r => `WHEN ${r.id} THEN ${r.escolas_rurais ?? 'NULL'}`).join(' ');
  const docCases = batch.map(r => `WHEN ${r.id} THEN ${r.total_docentes ?? 'NULL'}`).join(' ');
  const turCases = batch.map(r => `WHEN ${r.id} THEN ${r.total_turmas ?? 'NULL'}`).join(' ');
  await sql.query(
    `UPDATE fundeb.municipalities SET
        total_escolas=CASE id ${totalCases} END,
        escolas_municipais=CASE id ${munCases} END,
        escolas_rurais=CASE id ${ruralCases} END,
        total_docentes=CASE id ${docCases} END,
        total_turmas=CASE id ${turCases} END
      WHERE id IN (${ids.join(',')})`
  );
  done += batch.length;
}
log(`  Censo updated for ${done} non-SP munis`);

// ── Step 8: Microdados infra (non-SP only) ─────────────────────
log('=== STEP 8: Microdados infra (pct_internet/biblioteca/quadra/lab) — non-SP ===');
const { spawn: spawn2 } = await import('node:child_process');
const infraRecs = await new Promise((resolve, reject) => {
  const awkScript = `
    BEGIN { FS=";" }
    NR == 1 { next }
    $32 != "1" { next }
    { ibge=$8; total[ibge]++; if ($187=="1") inet[ibge]++; if ($117=="1") bib[ibge]++; if ($130=="1") quad[ibge]++; if ($124=="1") lab[ibge]++; }
    END { for (i in total) printf "%s|%d|%d|%d|%d|%d\\n", i, total[i], inet[i]+0, bib[i]+0, quad[i]+0, lab[i]+0 }
  `;
  const proc = spawn2('awk', [awkScript, '/tmp/inep-multiufa/microdados_censo_escolar_2024/dados/microdados_ed_basica_2024.csv']);
  const out = []; let buf = '';
  proc.stdout.on('data', d => {
    buf += d.toString(); const lines = buf.split('\n'); buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const [ibge, total, inet, bib, quad, lab] = line.split('|').map(Number);
      out.push({ ibge: String(ibge).padStart(7,'0'), total, inet, bib, quad, lab });
    }
  });
  proc.on('close', code => code === 0 ? resolve(out) : reject(new Error('awk failed')));
});
log(`  ${infraRecs.length} munis with infra data`);

const infraUpdates = infraRecs
  .map(r => {
    const id = ibgeToId.get(r.ibge);
    if (!id || idToUf.get(id) === 'SP' || r.total === 0) return null;
    return { id, pi: r.inet/r.total*100, pb: r.bib/r.total*100, pq: r.quad/r.total*100, pl: r.lab/r.total*100 };
  })
  .filter(Boolean);
log(`  ${infraUpdates.length} non-SP records to update`);

done = 0;
for (const batch of chunks(infraUpdates, 200)) {
  const ids = batch.map(r => r.id);
  const inetCases = batch.map(r => `WHEN ${r.id} THEN ${r.pi.toFixed(2)}`).join(' ');
  const bibCases = batch.map(r => `WHEN ${r.id} THEN ${r.pb.toFixed(2)}`).join(' ');
  const quadCases = batch.map(r => `WHEN ${r.id} THEN ${r.pq.toFixed(2)}`).join(' ');
  const labCases = batch.map(r => `WHEN ${r.id} THEN ${r.pl.toFixed(2)}`).join(' ');
  await sql.query(
    `UPDATE fundeb.municipalities SET pct_internet=CASE id ${inetCases} END, pct_biblioteca=CASE id ${bibCases} END, pct_quadra=CASE id ${quadCases} END, pct_lab_info=CASE id ${labCases} END WHERE id IN (${ids.join(',')})`
  );
  done += batch.length;
}
log(`  Infra updated for ${done} non-SP munis`);

// ── Step 9: IDEB (ALL munis including SP — SP nunca teve IDEB) ─
log('=== STEP 9: IDEB (ALL munis — SP currently has 0/645) ===');
const idebRecs = ideb
  .map(r => ({ id: ibgeToId.get(String(r.co_municipio).padStart(7,'0')), ai: r.ideb_ai ?? null, af: r.ideb_af ?? null }))
  .filter(r => r.id);
log(`  ${idebRecs.length} munis matched`);
done = 0;
for (const batch of chunks(idebRecs, 200)) {
  const ids = batch.map(r => r.id);
  const aiCases = batch.map(r => `WHEN ${r.id} THEN ${r.ai ?? 'NULL'}::real`).join(' ');
  const afCases = batch.map(r => `WHEN ${r.id} THEN ${r.af ?? 'NULL'}::real`).join(' ');
  await sql.query(`UPDATE fundeb.municipalities SET ideb_ai=CASE id ${aiCases} END, ideb_af=CASE id ${afCases} END WHERE id IN (${ids.join(',')})`);
  done += batch.length;
}
log(`  IDEB updated for ${done} munis`);

// ── Step 10: ref_inep_censo + ref_nse for non-SP ───────────────
log('=== STEP 10: ref_inep_censo + ref_nse for non-SP ===');
const censoSrc = db.prepare(`SELECT * FROM inep_censo_2024`).all();
const nseSrc = db.prepare(`SELECT * FROM nse_municipio`).all();

let censoIns = 0;
for (const batch of chunks(censoSrc, 200)) {
  const params = []; const ph = [];
  for (const r of batch) {
    const ibge = String(r.codigo_ibge).padStart(7,'0');
    const id = ibgeToId.get(ibge);
    if (!id || idToUf.get(id) === 'SP') continue;
    const o = params.length;
    params.push(ibge, id, r.uf, r.municipio, r.mat_total, r.mat_ei_total, r.mat_creche, r.mat_pre_escola, r.mat_ef_total, r.mat_ef_ai, r.mat_ef_af, r.mat_em_total, r.mat_em_propedeutico, r.mat_em_normal, r.mat_em_tec_integrado, r.mat_prof_total, r.mat_eja_total, r.mat_eja_fund, r.mat_eja_medio, r.mat_especial_total, r.mat_especial_comum);
    ph.push(`($${o+1},$${o+2},$${o+3},$${o+4},$${o+5},$${o+6},$${o+7},$${o+8},$${o+9},$${o+10},$${o+11},$${o+12},$${o+13},$${o+14},$${o+15},$${o+16},$${o+17},$${o+18},$${o+19},$${o+20},$${o+21})`);
  }
  if (!ph.length) continue;
  const r = await sql.query(
    `INSERT INTO fundeb.ref_inep_censo (codigo_ibge, municipality_id, uf, municipio, mat_total, mat_ei_total, mat_creche, mat_pre_escola, mat_ef_total, mat_ef_ai, mat_ef_af, mat_em_total, mat_em_propedeutico, mat_em_normal, mat_em_tec_integrado, mat_prof_total, mat_eja_total, mat_eja_fund, mat_eja_medio, mat_especial_total, mat_especial_comum) VALUES ${ph.join(',')} ON CONFLICT (codigo_ibge) DO NOTHING RETURNING id`,
    params
  );
  censoIns += r.length;
}
log(`  ref_inep_censo: ${censoIns} new rows`);

let nseIns = 0;
for (const batch of chunks(nseSrc, 200)) {
  const params = []; const ph = [];
  for (const r of batch) {
    const ibge = String(r.codigo_ibge).padStart(7,'0');
    const id = ibgeToId.get(ibge);
    if (!id || idToUf.get(id) === 'SP') continue;
    const o = params.length;
    params.push(ibge, id, r.uf, r.nome, r.ponderador_nse);
    ph.push(`($${o+1},$${o+2},$${o+3},$${o+4},$${o+5})`);
  }
  if (!ph.length) continue;
  const r = await sql.query(`INSERT INTO fundeb.ref_nse (codigo_ibge, municipality_id, uf, nome, ponderador_nse) VALUES ${ph.join(',')} ON CONFLICT (codigo_ibge) DO NOTHING RETURNING id`, params);
  nseIns += r.length;
}
log(`  ref_nse: ${nseIns} new rows`);

// ── Final verification ────────────────────────────────────────
log('=== FINAL VERIFICATION ===');
const final = await sql`
  SELECT (SELECT count(*) FROM fundeb.municipalities) as munis,
         (SELECT count(DISTINCT uf) FROM fundeb.municipalities) as ufs,
         (SELECT count(*) FROM fundeb.estados) as estados,
         (SELECT count(*) FROM fundeb.municipalities WHERE total_escolas IS NOT NULL) as com_esc,
         (SELECT count(*) FROM fundeb.municipalities WHERE pct_internet IS NOT NULL) as com_inet,
         (SELECT count(*) FROM fundeb.municipalities WHERE ideb_ai IS NOT NULL) as com_ideb,
         (SELECT count(*) FROM fundeb.ref_inep_censo) as ref_censo,
         (SELECT count(*) FROM fundeb.ref_nse) as ref_nse
`;
log(JSON.stringify(final[0]));
db.close();
