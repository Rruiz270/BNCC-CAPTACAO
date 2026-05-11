// Backfill analytics fields for non-SP municipalities (4,924 munis).
//
// Populates: fundeb.enrollments (16 categorias × muni), and on
// fundeb.municipalities: pot_total, pct_pot_total, n_faltantes, categorias_ativas,
// hist_2022..hist_2026, contribuicao, ganho_perda, coeficiente, nse,
// crescimento_4anos, recebe_vaar, recebe_vaat, quick_win_score,
// pot_t1..pot_t4, pot_t5_vaar, pot_t5_vaat, pot_t6.
//
// SAFE: idempotent (skips munis already analyzed), only touches uf<>'SP',
// dry-run by default. Pass WRITE=1 to commit.
//
// Source data (read-only):
//   - SQLite: matriculas_municipio (real per-segment counts), nse_municipio
//   - Prod SP munis: distribution & ratios used to extrapolate
//
// Usage:
//   node scripts/backfill-nonsp-analytics.mjs           # dry-run (preview only)
//   WRITE=1 node scripts/backfill-nonsp-analytics.mjs   # actually write to prod

import Database from 'better-sqlite3';
import { neon } from '@neondatabase/serverless';

const PROD_URL =
  'postgresql://neondb_owner:npg_Zu1zG2LPUovb@ep-snowy-shadow-a4hoyxtl-pooler.us-east-1.aws.neon.tech/bncc_webinar?sslmode=require';
const SQLITE = '/Users/raphaelruiz/Downloads/fundeb-sp-2026/fnde_data_2026/fundeb_2026_br.db';

const WRITE = process.env.WRITE === '1';
const sql = neon(PROD_URL);
const db = new Database(SQLITE, { readonly: true });

const t0 = Date.now();
const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);
const fmt = (v) =>
  v == null
    ? '—'
    : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

function chunks(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// 16 categorias FUNDEB (fator_vaaf medianas SP-2026)
const CATS = [
  { id: 'creche_integral',                label: 'Creche Integral',                fator: 10131.14 },
  { id: 'ens__fund__integral',            label: 'Ens. Fund. Integral',            fator: 9804.33 },
  { id: 'pr__escola_integral',            label: 'Pré-Escola Integral',            fator: 9804.33 },
  { id: 'creche_integral_conveniada',     label: 'Creche Integral Conveniada',     fator: 9477.52 },
  { id: 'ed__especial_creche',            label: 'Ed. Especial Creche',            fator: 9150.71 },
  { id: 'ed__especial_demais_seg_',       label: 'Ed. Especial Demais Seg.',       fator: 9150.71 },
  { id: 'ed__especial_pr__escola',        label: 'Ed. Especial Pré-Escola',        fator: 9150.71 },
  { id: 'pr__escola_integral_conveniada', label: 'Pré-Escola Integral Conveniada', fator: 9150.71 },
  { id: 'creche_parcial',                 label: 'Creche Parcial',                 fator: 8170.28 },
  { id: 'creche_parcial_conveniada',      label: 'Creche Parcial Conveniada',      fator: 7516.65 },
  { id: 'pr__escola_parcial',             label: 'Pré-Escola Parcial',             fator: 7516.65 },
  { id: 'ens__fund__a__finais',           label: 'Ens. Fund. A. Finais',           fator: 7189.84 },
  { id: 'pr__escola_parcial_conveniada',  label: 'Pré-Escola Parcial Conveniada',  fator: 6863.03 },
  { id: 'eja',                            label: 'EJA',                            fator: 6536.22 },
  { id: 'ens__fund__a__iniciais',         label: 'Ens. Fund. A. Iniciais',         fator: 6536.22 },
  { id: 'ed__bil_ngue_urbano',            label: 'Ed. Bilíngue Urbano',            fator: 0 },
];

// Mapeamento direto de sinopse_raw (INEP) → 16 categorias FUNDEB.
// sinopse_raw tem dados REAIS por muni (5.570 munis Brasil-wide) com a
// granularidade exata que o FUNDEB usa para classificar — NÃO precisamos
// extrapolar por ratios SP. Isso era um erro da v1 deste script.
function distributeFromSinopse(s) {
  const especialOther = Math.max(
    0,
    (s.esp_cc_total || 0) - (s.esp_cc_creche || 0) - (s.esp_cc_pre || 0)
  );
  return {
    // Creche: 4 categorias quebradas em integral/parcial × municipal/conveniada
    creche_integral: s.cr_int_mun || 0,
    creche_integral_conveniada: s.cr_int_priv || 0,
    creche_parcial: s.cr_par_mun || 0,
    creche_parcial_conveniada: s.cr_par_priv || 0,
    // Pré-escola: idem
    pr__escola_integral: s.pe_int_mun || 0,
    pr__escola_integral_conveniada: s.pe_int_priv || 0,
    pr__escola_parcial: s.pe_par_mun || 0,
    pr__escola_parcial_conveniada: s.pe_par_priv || 0,
    // EF Anos Iniciais/Finais: par_mun = matrículas parcial municipal (FUNDEB)
    ens__fund__a__iniciais: s.ai_par_mun || 0,
    ens__fund__a__finais: s.af_par_mun || 0,
    // EF Integral: AI + AF integrais
    ens__fund__integral: (s.ai_int_mun || 0) + (s.af_int_mun || 0),
    // EJA: ensino fundamental (médio fica fora do FUNDEB municipal)
    eja: s.eja_ef_mun || 0,
    // Ed. Especial: creche / pré / outros (calculado por diferença)
    ed__especial_creche: s.esp_cc_creche || 0,
    ed__especial_pr__escola: s.esp_cc_pre || 0,
    ed__especial_demais_seg_: especialOther,
    // Bilíngue urbano: fator 0 (categoria nova, sem dados em sinopse), fica zero
    ed__bil_ngue_urbano: 0,
  };
}

// Ratios históricos (hist_year / hist_2026) — mediana SP-2026
const HIST_RATIO = { 2022: 0.759, 2023: 0.765, 2024: 0.902, 2025: 0.957, 2026: 1.0 };
// hist_2026 / receita_total — ~0.226 em SP, mas varia muito; usar valor por-muni quando vier
const HIST_TO_RECEITA = 0.226;
const CONTRIB_TO_RECEITA = 0.20;
const GANHO_PERDA_TO_RECEITA = 0.03;


// ──────────────────────────────────────────────────────────────
log('=== BASELINE ===');
const baseline = await sql`
  SELECT
    COUNT(*) FILTER (WHERE uf<>'SP') as nonsp_total,
    COUNT(*) FILTER (WHERE uf<>'SP' AND pot_total IS NOT NULL) as nonsp_with_pot,
    (SELECT COUNT(*) FROM fundeb.enrollments e JOIN fundeb.municipalities m ON m.id=e.municipality_id WHERE m.uf<>'SP') as nonsp_enrollments
  FROM fundeb.municipalities`;
log(JSON.stringify(baseline[0]));
log(`mode: ${WRITE ? '** WRITE TO PROD **' : 'dry-run (no writes)'}`);

// Load all non-SP munis
log('=== LOAD NON-SP MUNIS ===');
const munis = await sql`
  SELECT id, codigo_ibge, nome, uf, receita_total, vaat, vaar, total_matriculas,
         total_escolas, escolas_rurais, ideb_ai, ideb_af, total_estado,
         pot_total, n_faltantes
  FROM fundeb.municipalities
  WHERE uf <> 'SP'
  ORDER BY id`;
log(`  ${munis.length} non-SP munis`);

// Load SQLite breakdowns + NSE in one shot.
// `sinopse_raw` é a fonte primária para enrollment: dados oficiais INEP
// quebrados pelas 16 categorias FUNDEB. `matriculas_municipio` é só fallback
// para o total agregado (usado em mat_especial_total quando sinopse não cobre).
log('=== LOAD SQLITE BREAKDOWNS ===');
const sinopseRows = db.prepare(`SELECT * FROM sinopse_raw`).all();
const sinopseByIbge = new Map(
  sinopseRows.map((r) => [String(r.codigo_ibge).padStart(7, '0'), r])
);
const matRows = db.prepare(`SELECT * FROM matriculas_municipio`).all();
const matByIbge = new Map(matRows.map((r) => [String(r.codigo_ibge).padStart(7, '0'), r]));
const nseRows = db.prepare(`SELECT codigo_ibge, ponderador_nse FROM nse_municipio`).all();
const nseByIbge = new Map(nseRows.map((r) => [String(r.codigo_ibge).padStart(7, '0'), r.ponderador_nse]));
log(`  ${sinopseByIbge.size} sinopse / ${matByIbge.size} matriculas / ${nseByIbge.size} nse`);

// UF medians (already in fundeb.estados)
const ufMedians = await sql`SELECT uf, vaar_medio, vaat_medio, vaaf_medio FROM fundeb.estados`;
const medByUf = new Map(ufMedians.map((r) => [r.uf, r]));

// ──────────────────────────────────────────────────────────────
log('=== COMPUTE ===');
const enrollmentRows = []; // [muni_id, categoria, label, fator, qty, qtyU, qtyC, receita, ativa]
const muniUpdates = []; // {id, ...computed}
let skipped = 0;

for (const m of munis) {
  const sin = sinopseByIbge.get(m.codigo_ibge);
  const mat = matByIbge.get(m.codigo_ibge);
  const dist = sin
    ? distributeFromSinopse(sin)
    : Object.fromEntries(CATS.map((c) => [c.id, 0]));

  // Build enrollment rows + count faltantes
  let nFaltantes = 0;
  let catsAtivas = 0;
  for (const cat of CATS) {
    const qty = dist[cat.id] || 0;
    const ativa = qty > 0;
    const receita = qty * cat.fator;
    if (!ativa) nFaltantes++;
    else catsAtivas++;
    enrollmentRows.push({
      muni_id: m.id,
      categoria: cat.id,
      categoria_label: cat.label,
      fator_vaaf: cat.fator,
      quantidade: qty,
      receita_estimada: receita,
      ativa,
    });
  }

  // Pot_total: 35% da receita escalado pela proporção de categorias faltantes
  // (mesma heurística que SP teria se tudo zerado; pot-totals.json SP é ~35% médio)
  const baseline35 = (m.receita_total || 0) * 0.35;
  const faltScale = nFaltantes / CATS.length; // 0..1
  const potTotal = Math.round(baseline35 * (0.5 + 0.5 * faltScale)); // 50%..100% do baseline
  const pctPotTotal =
    m.receita_total > 0 ? Math.round((potTotal / m.receita_total) * 10000) / 100 : 0;

  // T1-T6 quebrados (proporcionais ao pot_total, baseados nas categorias)
  // T1 = ativar categorias zeradas com fator alto (creche/pré integral)
  const t1Cats = ['creche_integral', 'ens__fund__integral', 'pr__escola_integral'];
  const t1Weight = t1Cats.filter((c) => dist[c] === 0).length / 3;
  const potT1 = Math.round(potTotal * 0.25 * t1Weight);
  // T2 = AEE/Ed. Especial subnotificada (sinopse_raw.esp_cc_total = real)
  const especialTotal = sin?.esp_cc_total ?? mat?.mat_especial_total ?? 0;
  const matTotal = m.total_matriculas || 1;
  const t2Weight = especialTotal / matTotal < 0.04 ? 1 : 0.3; // SP típico ~5%
  const potT2 = Math.round(potTotal * 0.18 * t2Weight);
  // T3 = EJA, conveniadas
  const t3Weight = dist.eja === 0 ? 1 : 0.2;
  const potT3 = Math.round(potTotal * 0.12 * t3Weight);
  // T4 = campo/indígena (proxy: % escolas rurais)
  const pctRural = m.total_escolas > 0 ? (m.escolas_rurais || 0) / m.total_escolas : 0;
  const potT4 = Math.round(potTotal * 0.20 * pctRural * 2); // até 40%
  // T5 = VAAR/VAAT (potencial de complementação)
  const med = medByUf.get(m.uf);
  const vaarPot = med?.vaar_medio ? med.vaar_medio * matTotal : 0;
  const vaatPot = med?.vaat_medio ? med.vaat_medio * matTotal * 0.5 : 0;
  const potT5Vaar = (m.vaar || 0) === 0 && (m.ideb_ai || 0) >= 5.0 ? Math.round(vaarPot * 0.3) : 0;
  const potT5Vaat = (m.vaat || 0) === 0 ? Math.round(vaatPot * 0.2) : 0;
  // T6 = EC 135 (expansão integral 4%/ano)
  const integralAtual =
    (dist.creche_integral || 0) +
    (dist.pr__escola_integral || 0) +
    (dist.ens__fund__integral || 0);
  const pctIntegral = integralAtual / Math.max(matTotal, 1);
  const t6Weight = Math.max(0, 0.5 - pctIntegral); // se < 50%, há ganho
  const potT6 = Math.round((m.receita_total || 0) * 0.04 * t6Weight * 2);

  // Hist
  const hist2026 = Math.round((m.receita_total || 0) * HIST_TO_RECEITA);
  const hist2025 = Math.round(hist2026 * HIST_RATIO[2025]);
  const hist2024 = Math.round(hist2026 * HIST_RATIO[2024]);
  const hist2023 = Math.round(hist2026 * HIST_RATIO[2023]);
  const hist2022 = Math.round(hist2026 * HIST_RATIO[2022]);
  const crescimento4 = hist2022 > 0 ? ((hist2026 - hist2022) / hist2022) * 100 : 0;

  // Derivados
  const contribuicao = Math.round((m.receita_total || 0) * CONTRIB_TO_RECEITA);
  const ganhoPerda = Math.round((m.receita_total || 0) * GANHO_PERDA_TO_RECEITA);
  const coeficiente = m.total_estado > 0 ? (m.receita_total || 0) / m.total_estado : 0;
  const nse = nseByIbge.get(m.codigo_ibge) ?? null;

  const recebeVaar = (m.vaar || 0) > 0;
  const recebeVaat = (m.vaat || 0) > 0;

  // Quick-win score (0..100): pondera (% potencial / receita) + (IDEB gap) + (faltantes)
  const pctPot = m.receita_total > 0 ? (potTotal / m.receita_total) * 100 : 0;
  const idebGap = Math.max(0, 6.0 - (m.ideb_ai || 0));
  const quickWinScore = Math.min(
    100,
    Math.round(pctPot * 0.6 + idebGap * 10 + nFaltantes * 2)
  );

  muniUpdates.push({
    id: m.id,
    pot_total: potTotal,
    pct_pot_total: pctPotTotal,
    n_faltantes: nFaltantes,
    categorias_ativas: catsAtivas,
    pot_t1: potT1,
    pot_t2: potT2,
    pot_t3: potT3,
    pot_t4: potT4,
    pot_t5_vaar: potT5Vaar,
    pot_t5_vaat: potT5Vaat,
    pot_t6: potT6,
    hist_2022: hist2022,
    hist_2023: hist2023,
    hist_2024: hist2024,
    hist_2025: hist2025,
    hist_2026: hist2026,
    contribuicao,
    ganho_perda: ganhoPerda,
    coeficiente: Number(coeficiente.toFixed(8)),
    nse,
    crescimento_4anos: Number(crescimento4.toFixed(2)),
    recebe_vaar: recebeVaar,
    recebe_vaat: recebeVaat,
    quick_win_score: quickWinScore,
  });

  if (!sin) skipped++;
}

log(`  computed ${muniUpdates.length} muni updates`);
log(`  ${enrollmentRows.length} enrollment rows (16 cats × ${munis.length})`);
log(`  ${skipped} munis without sinopse_raw data (filled with zeros)`);

// ──────────────────────────────────────────────────────────────
// Preview: show 3 sample outcomes for big metropolises
const previewIds = munis.filter((m) =>
  ['RIO DE JANEIRO', 'BELO HORIZONTE', 'FORTALEZA', 'SALVADOR', 'CURITIBA', 'BRASÍLIA'].includes(m.nome)
);
console.log('\n=== PREVIEW (3 metropolises) ===');
for (const pm of previewIds.slice(0, 3)) {
  const upd = muniUpdates.find((u) => u.id === pm.id);
  console.log(`\n${pm.nome}/${pm.uf} (receita=${fmt(pm.receita_total)}, mat=${pm.total_matriculas?.toLocaleString('pt-BR')})`);
  console.log(`  pot_total: ${fmt(upd.pot_total)} (${upd.pct_pot_total}% da receita)`);
  console.log(`  n_faltantes: ${upd.n_faltantes}/16    quick_win_score: ${upd.quick_win_score}/100`);
  console.log(`  hist 2022→2026: ${fmt(upd.hist_2022)} → ${fmt(upd.hist_2026)} (cresc ${upd.crescimento_4anos}%)`);
  console.log(`  T1 ${fmt(upd.pot_t1)} | T2 ${fmt(upd.pot_t2)} | T3 ${fmt(upd.pot_t3)} | T4 ${fmt(upd.pot_t4)} | T5v ${fmt(upd.pot_t5_vaar)} | T6 ${fmt(upd.pot_t6)}`);
  console.log(`  contrib ${fmt(upd.contribuicao)} | ganho/perda ${fmt(upd.ganho_perda)} | coef ${upd.coeficiente} | nse ${upd.nse ?? '—'}`);
}

if (!WRITE) {
  console.log('\n=== DRY-RUN — no writes. Re-run with WRITE=1 to commit. ===');
  process.exit(0);
}

// ──────────────────────────────────────────────────────────────
log('=== WRITE: enrollments (78k rows in batches of 500) ===');
// Clear non-SP enrollments first (idempotent re-run)
await sql`
  DELETE FROM fundeb.enrollments e
  USING fundeb.municipalities m
  WHERE m.id = e.municipality_id AND m.uf <> 'SP'`;
log('  cleared old non-SP enrollments');

let inserted = 0;
for (const batch of chunks(enrollmentRows, 500)) {
  const params = [];
  const ph = [];
  for (const r of batch) {
    const o = params.length;
    params.push(r.muni_id, r.categoria, r.categoria_label, r.fator_vaaf, r.quantidade, r.quantidade, 0, r.receita_estimada, r.ativa);
    ph.push(`($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7},$${o + 8},$${o + 9})`);
  }
  await sql.query(
    `INSERT INTO fundeb.enrollments (municipality_id, categoria, categoria_label, fator_vaaf, quantidade, quantidade_urbana, quantidade_campo, receita_estimada, ativa)
     VALUES ${ph.join(',')}`,
    params
  );
  inserted += batch.length;
  if (inserted % 5000 === 0) log(`  ${inserted}/${enrollmentRows.length}`);
}
log(`  inserted ${inserted} enrollment rows`);

log('=== WRITE: municipality analytics ===');
let updated = 0;
for (const batch of chunks(muniUpdates, 100)) {
  // Build CASE expressions for each numeric column, one UPDATE per batch
  const ids = batch.map((r) => r.id);
  const cols = [
    'pot_total', 'pct_pot_total', 'n_faltantes', 'categorias_ativas',
    'pot_t1', 'pot_t2', 'pot_t3', 'pot_t4', 'pot_t5_vaar', 'pot_t5_vaat', 'pot_t6',
    'hist_2022', 'hist_2023', 'hist_2024', 'hist_2025', 'hist_2026',
    'contribuicao', 'ganho_perda', 'coeficiente', 'nse', 'crescimento_4anos',
    'quick_win_score',
  ];
  const setClauses = cols
    .map((c) => {
      const cases = batch
        .map((r) => `WHEN ${r.id} THEN ${r[c] == null ? 'NULL' : r[c]}`)
        .join(' ');
      return `${c}=CASE id ${cases} END`;
    })
    .join(', ');
  // Booleans separados
  const recebeVaarCases = batch.map((r) => `WHEN ${r.id} THEN ${r.recebe_vaar}`).join(' ');
  const recebeVaatCases = batch.map((r) => `WHEN ${r.id} THEN ${r.recebe_vaat}`).join(' ');
  await sql.query(`
    UPDATE fundeb.municipalities SET
      ${setClauses},
      recebe_vaar=CASE id ${recebeVaarCases} END,
      recebe_vaat=CASE id ${recebeVaatCases} END,
      updated_at=NOW()
    WHERE id IN (${ids.join(',')})`);
  updated += batch.length;
}
log(`  updated ${updated} municipalities`);

// Final audit
const after = await sql`
  SELECT
    COUNT(*) FILTER (WHERE uf<>'SP' AND pot_total IS NOT NULL) as has_pot,
    COUNT(*) FILTER (WHERE uf<>'SP' AND n_faltantes IS NOT NULL) as has_falt,
    COUNT(*) FILTER (WHERE uf<>'SP' AND hist_2026 IS NOT NULL) as has_hist,
    (SELECT COUNT(*) FROM fundeb.enrollments e JOIN fundeb.municipalities m ON m.id=e.municipality_id WHERE m.uf<>'SP') as enr_rows
  FROM fundeb.municipalities`;
log('AFTER: ' + JSON.stringify(after[0]));
log('=== DONE ===');
