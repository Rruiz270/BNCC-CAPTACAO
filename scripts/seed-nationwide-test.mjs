// One-shot seed for the multi-UF test branch.
// Reads /Users/raphaelruiz/Downloads/fundeb-sp-2026/fnde_data_2026/fundeb_2026_br.db
// and populates fundeb.municipalities, fundeb.estados, ref_inep_censo, ref_nse,
// ref_fatores_ponderacao, ref_historico_stn for all 5,569 BR municipalities.
//
// Usage: DATABASE_URL=<test> node scripts/seed-nationwide-test.mjs
import Database from 'better-sqlite3';
import { neon } from '@neondatabase/serverless';

const SRC = '/Users/raphaelruiz/Downloads/fundeb-sp-2026/fnde_data_2026/fundeb_2026_br.db';
const URL = process.env.DATABASE_URL;
if (!URL) { console.error('DATABASE_URL required'); process.exit(1); }
const sql = neon(URL);
const sqlite = new Database(SRC, { readonly: true });
const BATCH = 200;

function chunks(arr, n) { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }
const t0 = Date.now();
const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

// ── Step 1: municipalities ──────────────────────────────────────
log('reading municipalities from sqlite...');
const munis = sqlite.prepare(`
  SELECT e.codigo_ibge, e.uf, e.nome,
         r.receita_contribuicao, r.compl_vaaf, r.compl_vaat, r.compl_vaar, r.total_receitas_previstas,
         m.mat_total, m.mat_ei_total, m.mat_ef_total
  FROM entes e
  LEFT JOIN receita_municipio r USING(codigo_ibge)
  LEFT JOIN matriculas_municipio m USING(codigo_ibge)
  WHERE e.tipo='MUNICIPIO'
  ORDER BY e.uf, e.nome
`).all();
log(`got ${munis.length} munis`);

log('inserting fundeb.municipalities (batched)...');
let totalInserted = 0;
for (const batch of chunks(munis, BATCH)) {
  const params = [];
  const placeholders = batch.map((m, i) => {
    const o = i * 9;
    params.push(m.nome, String(m.codigo_ibge).padStart(7, '0'), m.uf,
                m.receita_contribuicao ?? null, m.compl_vaat ?? null, m.compl_vaar ?? null,
                m.total_receitas_previstas ?? null, m.mat_total ?? null, m.mat_ei_total ?? null);
    return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}, $${o + 7}, $${o + 8}, $${o + 9})`;
  }).join(',');
  // eiMat column maps to ei_mat (real); we send int but pg coerces.
  await sql.query(
    `INSERT INTO fundeb.municipalities (nome, codigo_ibge, uf, receita_total, vaat, vaar, total_estado, total_matriculas, ei_mat)
     VALUES ${placeholders} ON CONFLICT (codigo_ibge) DO NOTHING`,
    params
  );
  totalInserted += batch.length;
  if (totalInserted % 1000 === 0 || totalInserted === munis.length) log(`  ${totalInserted}/${munis.length}`);
}

// Backfill mat_ef separately so the column reference stays explicit.
log('updating ef_mat...');
const efRows = sqlite.prepare(`SELECT codigo_ibge, mat_ef_total FROM matriculas_municipio WHERE mat_ef_total IS NOT NULL`).all();
for (const batch of chunks(efRows, BATCH)) {
  const cases = batch.map((r, i) => `WHEN $${i * 2 + 1} THEN $${i * 2 + 2}::real`).join(' ');
  const params = batch.flatMap(r => [String(r.codigo_ibge).padStart(7, '0'), r.mat_ef_total]);
  const ibges = batch.map((_, i) => `$${i * 2 + 1}`).join(',');
  await sql.query(
    `UPDATE fundeb.municipalities SET ef_mat = CASE codigo_ibge ${cases} END WHERE codigo_ibge IN (${ibges})`,
    params
  );
}

// ── Step 2: build muni_id lookup ─────────────────────────────────
log('building ibge→id map...');
const idRows = await sql`SELECT id, codigo_ibge FROM fundeb.municipalities`;
const ibgeToId = new Map();
for (const r of idRows) ibgeToId.set(r.codigo_ibge, r.id);
log(`  ${ibgeToId.size} ids cached`);

// ── Step 3: ref_inep_censo ───────────────────────────────────────
log('inserting ref_inep_censo...');
const censo = sqlite.prepare(`SELECT * FROM inep_censo_2024`).all();
let cIns = 0;
for (const batch of chunks(censo, BATCH)) {
  const params = []; const ph = [];
  for (let i = 0; i < batch.length; i++) {
    const r = batch[i];
    const ibge = String(r.codigo_ibge).padStart(7, '0');
    const id = ibgeToId.get(ibge);
    if (!id) continue;
    const o = params.length;
    params.push(ibge, id, r.uf, r.municipio,
                r.mat_total, r.mat_ei_total, r.mat_creche, r.mat_pre_escola,
                r.mat_ef_total, r.mat_ef_ai, r.mat_ef_af,
                r.mat_em_total, r.mat_em_propedeutico, r.mat_em_normal, r.mat_em_tec_integrado,
                r.mat_prof_total, r.mat_eja_total, r.mat_eja_fund, r.mat_eja_medio,
                r.mat_especial_total, r.mat_especial_comum);
    ph.push(`($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7},$${o + 8},$${o + 9},$${o + 10},$${o + 11},$${o + 12},$${o + 13},$${o + 14},$${o + 15},$${o + 16},$${o + 17},$${o + 18},$${o + 19},$${o + 20},$${o + 21})`);
  }
  if (ph.length === 0) continue;
  await sql.query(
    `INSERT INTO fundeb.ref_inep_censo
       (codigo_ibge, municipality_id, uf, municipio, mat_total, mat_ei_total, mat_creche, mat_pre_escola,
        mat_ef_total, mat_ef_ai, mat_ef_af, mat_em_total, mat_em_propedeutico, mat_em_normal, mat_em_tec_integrado,
        mat_prof_total, mat_eja_total, mat_eja_fund, mat_eja_medio, mat_especial_total, mat_especial_comum)
     VALUES ${ph.join(',')} ON CONFLICT (codigo_ibge) DO NOTHING`,
    params
  );
  cIns += ph.length;
}
log(`  ${cIns} censo rows inserted`);

// ── Step 4: ref_nse ──────────────────────────────────────────────
log('inserting ref_nse...');
const nse = sqlite.prepare(`SELECT * FROM nse_municipio`).all();
let nIns = 0;
for (const batch of chunks(nse, BATCH)) {
  const params = []; const ph = [];
  for (const r of batch) {
    const ibge = String(r.codigo_ibge).padStart(7, '0');
    const id = ibgeToId.get(ibge);
    if (!id) continue;
    const o = params.length;
    params.push(ibge, id, r.uf, r.nome, r.ponderador_nse);
    ph.push(`($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5})`);
  }
  if (ph.length === 0) continue;
  await sql.query(
    `INSERT INTO fundeb.ref_nse (codigo_ibge, municipality_id, uf, nome, ponderador_nse)
     VALUES ${ph.join(',')} ON CONFLICT (codigo_ibge) DO NOTHING`,
    params
  );
  nIns += ph.length;
}
log(`  ${nIns} nse rows inserted`);

// ── Step 5: ref_fatores_ponderacao ──────────────────────────────
log('inserting ref_fatores_ponderacao...');
const fp = sqlite.prepare(`SELECT * FROM fatores_ponderacao`).all();
for (const batch of chunks(fp, BATCH)) {
  const params = []; const ph = [];
  for (const r of batch) {
    const o = params.length;
    params.push(r.descricao, r.segmento, r.fp_vaaf, r.fp_vaat, r.f_multi, r.fp_final_vaaf, r.fp_final_vaat);
    ph.push(`($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7})`);
  }
  await sql.query(
    `INSERT INTO fundeb.ref_fatores_ponderacao (descricao, segmento, fp_vaaf, fp_vaat, f_multi, fp_final_vaaf, fp_final_vaat)
     VALUES ${ph.join(',')} ON CONFLICT (segmento) DO NOTHING`,
    params
  );
}
log(`  ${fp.length} fatores rows inserted`);

// ── Step 6: ref_historico_stn ───────────────────────────────────
log('inserting ref_historico_stn...');
const stn = sqlite.prepare(`SELECT * FROM historico_stn_uf`).all();
for (const batch of chunks(stn, BATCH)) {
  const params = []; const ph = [];
  for (const r of batch) {
    const o = params.length;
    params.push(r.uf, r.ano, r.nivel, r.origem,
                r.jan, r.fev, r.mar, r.abr, r.mai, r.jun,
                r.jul, r.ago, r.sete, r.outu, r.novt, r.dezt, r.total_ano);
    ph.push(`($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7},$${o + 8},$${o + 9},$${o + 10},$${o + 11},$${o + 12},$${o + 13},$${o + 14},$${o + 15},$${o + 16},$${o + 17})`);
  }
  await sql.query(
    `INSERT INTO fundeb.ref_historico_stn (uf, ano, nivel, origem, jan, fev, mar, abr, mai, jun, jul, ago, sete, outu, novt, dezt, total_ano)
     VALUES ${ph.join(',')}`,
    params
  );
}
log(`  ${stn.length} stn rows inserted`);

// ── Step 7: estados (UF medians) ────────────────────────────────
// Median VAAR per UF among munis that receive (compl_vaar > 0 / mat_total).
// Median VAAT per UF among munis with VAAT > 0 (compl_vaat / mat_total).
// VAAF medio by UF: receita_contribuicao per aluno (proxy).
log('computing UF medians...');
const ufStats = sqlite.prepare(`
  SELECT e.uf,
    count(*) as munis,
    sum(m.mat_total) as mat_sum,
    sum(r.receita_contribuicao) as rec_sum
  FROM entes e
  LEFT JOIN receita_municipio r USING(codigo_ibge)
  LEFT JOIN matriculas_municipio m USING(codigo_ibge)
  WHERE e.tipo='MUNICIPIO'
  GROUP BY e.uf
`).all();

const ufNames = {
  AC: 'Acre', AL: 'Alagoas', AM: 'Amazonas', AP: 'Amapá', BA: 'Bahia',
  CE: 'Ceará', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão',
  MG: 'Minas Gerais', MS: 'Mato Grosso do Sul', MT: 'Mato Grosso',
  PA: 'Pará', PB: 'Paraíba', PE: 'Pernambuco', PI: 'Piauí',
  PR: 'Paraná', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
  RO: 'Rondônia', RR: 'Roraima', RS: 'Rio Grande do Sul',
  SC: 'Santa Catarina', SE: 'Sergipe', SP: 'São Paulo', TO: 'Tocantins',
};

for (const u of ufStats) {
  // Per-UF medians
  const medians = sqlite.prepare(`
    SELECT m.mat_total,
           CASE WHEN m.mat_total > 0 THEN r.compl_vaat / m.mat_total ELSE NULL END as vaat_pa,
           CASE WHEN m.mat_total > 0 AND r.compl_vaar > 0 THEN r.compl_vaar / m.mat_total ELSE NULL END as vaar_pa,
           CASE WHEN m.mat_total > 0 THEN r.receita_contribuicao / m.mat_total ELSE NULL END as vaaf_pa
    FROM entes e
    JOIN receita_municipio r USING(codigo_ibge)
    LEFT JOIN matriculas_municipio m USING(codigo_ibge)
    WHERE e.tipo='MUNICIPIO' AND e.uf = ?
  `).all(u.uf);

  function median(arr) {
    const v = arr.filter((x) => x != null && !isNaN(x)).sort((a, b) => a - b);
    if (!v.length) return null;
    const mid = Math.floor(v.length / 2);
    return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  }

  const vaaf = median(medians.map((r) => r.vaaf_pa));
  const vaat = median(medians.map((r) => r.vaat_pa));
  const vaar = median(medians.map((r) => r.vaar_pa));

  await sql`
    INSERT INTO fundeb.estados (uf, nome, vaaf_medio, vaat_medio, vaar_medio, peti_por_aluno, total_municipios, ano_referencia)
    VALUES (${u.uf}, ${ufNames[u.uf] ?? u.uf}, ${vaaf}, ${vaat}, ${vaar}, ${1693.22}, ${u.munis}, 2026)
    ON CONFLICT (uf) DO UPDATE SET vaaf_medio = EXCLUDED.vaaf_medio, vaat_medio = EXCLUDED.vaat_medio, vaar_medio = EXCLUDED.vaar_medio, updated_at = NOW()
  `;
}
log(`  ${ufStats.length} estados inserted`);

// ── Final summary ───────────────────────────────────────────────
const summary = await sql`
  SELECT
    (SELECT count(*) FROM fundeb.municipalities) as munis,
    (SELECT count(*) FROM fundeb.estados) as estados,
    (SELECT count(*) FROM fundeb.ref_inep_censo) as censo,
    (SELECT count(*) FROM fundeb.ref_nse) as nse,
    (SELECT count(DISTINCT uf) FROM fundeb.municipalities) as ufs
`;
log(`DONE. ${JSON.stringify(summary[0])}`);
sqlite.close();
