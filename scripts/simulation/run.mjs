// Orchestrator de simulação noturna.
//
// Roda 3 simulações sequenciais (Balbinos / Paulínia / Campinas), cada uma:
//   - Loga como test-consultor
//   - Cria consultoria nova (marcada SIMULAÇÃO)
//   - Executa cenas do roteiro com overlay HTML de balão de fala
//   - Grava vídeo WEBM via Playwright recordVideo
//   - Tira screenshot por cena
//   - Salva transcript Markdown
//   - Acessa Modo Telão ao final
//
// Output: ~/Projects/BNCC-CAPTACAO/.simulation-runs/<run>/<cityKey>/
//
// Uso: node scripts/simulation/run.mjs

import { chromium } from 'playwright';
import { neon } from '@neondatabase/serverless';
import { mkdir, writeFile, readFile, readdir, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROTEIROS } from './roteiros.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..', '..');

const envFile = resolve(REPO, '.env.local');
try {
  const c = await readFile(envFile, 'utf-8');
  for (const line of c.split('\n')) {
    const m = line.match(/^([A-Z_]+)="?([^"]+)"?$/);
    if (m) process.env[m[1]] = m[2];
  }
} catch {}

const DATABASE_URL = process.env.DATABASE_URL;
const BASE_URL = process.env.SIMULATION_BASE_URL || 'http://localhost:3000';
const LOGIN_EMAIL = process.env.SIMULATION_EMAIL || 'consultor@i10.crm';
const LOGIN_PASSWORD = process.env.SIMULATION_PASSWORD || 'consultor2026';

const RUN_TS = new Date().toISOString().slice(0, 10) + '-noite';
const RUN_ROOT = resolve(REPO, '.simulation-runs', RUN_TS);

const sql = neon(DATABASE_URL);

async function log(msg, ...rest) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`, ...rest);
}

async function ensureDir(p) {
  if (!existsSync(p)) await mkdir(p, { recursive: true });
}

async function enrichMuni(name) {
  const rows = await sql`
    SELECT id, nome, total_matriculas, receita_total, pot_total, vaar,
           pct_pot_total, ideb_ai, ideb_af, ei_mat, ef_mat, total_escolas,
           escolas_municipais, escolas_rurais
    FROM fundeb.municipalities WHERE nome = ${name} LIMIT 1
  `;
  if (rows.length === 0) throw new Error(`Município não encontrado: ${name}`);
  const r = rows[0];
  return {
    id: r.id,
    nome: r.nome,
    totalMatriculas: r.total_matriculas,
    receitaTotal: r.receita_total,
    potTotal: r.pot_total,
    vaarBanco: r.vaar,
    recebeVaar: (r.vaar ?? 0) > 0,
    pctPotTotal: r.pct_pot_total,
    idebAi: r.ideb_ai,
    eiMat: r.ei_mat,
    efMat: r.ef_mat,
    escolasRurais: r.escolas_rurais,
    totalEscolas: r.total_escolas,
  };
}

async function createConsultoria(municipalityId, ownerId = 'test-consultor') {
  const created = await sql`
    INSERT INTO fundeb.consultorias
      (municipality_id, status, assigned_consultor_id, assigned_at, notes)
    VALUES (${municipalityId}, 'active', ${ownerId}, NOW(), 'SIMULAÇÃO NOTURNA — pode ser deletada')
    RETURNING id
  `;
  return created[0].id;
}

async function cleanupOldSimulations() {
  await sql`
    UPDATE fundeb.consultorias SET status = 'completed', end_date = NOW()
    WHERE notes LIKE 'SIMULAÇÃO NOTURNA%' AND status = 'active'
  `;
}

// ─── Overlay (criado via createElement no browser, sem innerHTML) ──────

const OVERLAY_INIT = `
  (function() {
    const existing = document.getElementById('sim-overlay');
    if (existing) existing.remove();
    function el(tag, css, parent) {
      const e = document.createElement(tag);
      if (css) e.style.cssText = css;
      if (parent) parent.appendChild(e);
      return e;
    }
    const o = el('div', 'position:fixed;top:12px;right:12px;z-index:99999;max-width:480px;min-width:320px;font-family:-apple-system,sans-serif;pointer-events:none;', document.body);
    o.id = 'sim-overlay';

    const bSecret = el('div', 'background:rgba(255,255,255,0.97);border-left:4px solid #00B4D8;padding:12px 14px;margin-bottom:8px;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,0.15);display:none;', o);
    bSecret.id = 'sim-bubble-secret';
    const tagS = el('div', 'font-size:10px;font-weight:bold;color:#00B4D8;letter-spacing:1.5px;margin-bottom:4px;', bSecret);
    tagS.textContent = '🎤 SECRETÁRIA DE EDUCAÇÃO';
    const txtS = el('div', 'font-size:14px;color:#0A2463;line-height:1.4;', bSecret);
    txtS.id = 'sim-text-secret';

    const bResp = el('div', 'background:rgba(10,36,99,0.97);border-left:4px solid #00E5A0;padding:12px 14px;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,0.15);display:none;', o);
    bResp.id = 'sim-bubble-resp';
    const tagR = el('div', 'font-size:10px;font-weight:bold;color:#00E5A0;letter-spacing:1.5px;margin-bottom:4px;', bResp);
    tagR.textContent = '👨‍💼 CONSULTOR i10';
    const txtR = el('div', 'font-size:14px;color:white;line-height:1.4;', bResp);
    txtR.id = 'sim-text-resp';

    const lbl = el('div', 'margin-top:8px;text-align:right;font-size:11px;color:rgba(0,0,0,0.5);font-weight:600;', o);
    lbl.id = 'sim-stepLabel';
  })();
`;

function overlayUpdateScript(secret, resp, stepLabel) {
  return [
    "(function() {",
    "  const bSecret = document.getElementById('sim-bubble-secret');",
    "  const bResp = document.getElementById('sim-bubble-resp');",
    "  const tSecret = document.getElementById('sim-text-secret');",
    "  const tResp = document.getElementById('sim-text-resp');",
    "  const lbl = document.getElementById('sim-stepLabel');",
    "  if (!bSecret || !bResp) return;",
    "  bSecret.style.display = 'block';",
    "  bResp.style.display = 'none';",
    `  tSecret.textContent = ${JSON.stringify(secret)};`,
    `  lbl.textContent = ${JSON.stringify(stepLabel)};`,
    "  setTimeout(function() {",
    "    bResp.style.display = 'block';",
    `    tResp.textContent = ${JSON.stringify(resp)};`,
    "  }, 2200);",
    "})();",
  ].join('\n');
}

async function performAction(page, a) {
  try {
    if (a.type === 'wait') {
      await page.waitForTimeout(a.ms);
    } else if (a.type === 'click') {
      const loc = page.locator(a.selector).first();
      if (await loc.count() > 0 && await loc.isVisible({ timeout: 1500 }).catch(() => false)) {
        await loc.click({ timeout: 3000 }).catch((e) => {
          if (!a.optional) throw e;
        });
      } else if (!a.optional) {
        throw new Error(`Elemento não visível: ${a.selector}`);
      }
    } else if (a.type === 'fill') {
      await page.locator(a.selector).first().fill(a.value, { timeout: 3000 });
    } else if (a.type === 'check') {
      const loc = page.locator(a.selector).first();
      if (await loc.count() > 0 && await loc.isVisible({ timeout: 1500 }).catch(() => false)) {
        const checked = await loc.isChecked().catch(() => false);
        if (!checked) await loc.click({ timeout: 3000 }).catch(() => {});
      }
    } else if (a.type === 'nav') {
      await page.goto(a.url, { waitUntil: 'networkidle', timeout: 15000 });
    } else if (a.type === 'scroll') {
      await page.evaluate(({ y }) => window.scrollBy(0, y || 300), { y: a.y });
    }
  } catch (e) {
    if (!a.optional) throw e;
  }
}

async function loginAs(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passInput = page.locator('input[type="password"], input[name="password"]').first();
  await emailInput.waitFor({ timeout: 8000 });
  await emailInput.fill(LOGIN_EMAIL);
  await passInput.fill(LOGIN_PASSWORD);
  await passInput.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

async function runSimulation(roteiro, runDir, browser) {
  const muni = await enrichMuni(roteiro.municipalityName);
  log(`▶ Iniciando ${roteiro.cityLabel}: ${muni.nome} (${muni.totalMatriculas} matrículas, pot ${(muni.potTotal / 1e6).toFixed(1)}Mi)`);

  const cityDir = join(runDir, roteiro.cityKey);
  await ensureDir(cityDir);
  await ensureDir(join(cityDir, 'screenshots'));

  const consId = await createConsultoria(muni.id);
  log(`  consultoria #${consId} criada`);

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: cityDir, size: { width: 1440, height: 900 } },
  });

  const page = await context.newPage();

  const transcript = [];
  const errors = [];
  const startTime = Date.now();

  try {
    await loginAs(page);
    await page.evaluate(OVERLAY_INIT);
    log(`  logado, overlay injetado`);

    const scenes = roteiro.buildScenes(muni);

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const url = scene.url.replace('{id}', String(consId));
      const stepLabel = `Cena ${i + 1}/${scenes.length} · ${scene.id}`;
      log(`  ▷ ${stepLabel} → ${url}`);

      try {
        await page.goto(`${BASE_URL}${url}`, { waitUntil: 'networkidle', timeout: 20000 });
      } catch (e) {
        errors.push({ scene: scene.id, error: `nav: ${e.message}` });
      }

      await page.evaluate(OVERLAY_INIT).catch(() => {});
      await page.waitForTimeout(800);
      await page.evaluate(overlayUpdateScript(scene.secret, scene.resp, stepLabel)).catch(() => {});
      await page.waitForTimeout(2500);

      const shotPre = join(cityDir, 'screenshots', `${String(i + 1).padStart(2, '0')}-${scene.id}-pre.png`);
      await page.screenshot({ path: shotPre, fullPage: false }).catch(() => {});

      for (const action of scene.actions || []) {
        try { await performAction(page, action); }
        catch (e) { errors.push({ scene: scene.id, error: `action: ${e.message}` }); }
      }

      const shotPost = join(cityDir, 'screenshots', `${String(i + 1).padStart(2, '0')}-${scene.id}-post.png`);
      await page.screenshot({ path: shotPost, fullPage: false }).catch(() => {});

      transcript.push({
        sceneId: scene.id,
        url,
        stepLabel,
        secretQuestion: scene.secret,
        consultorResponse: scene.resp,
        screenshotPre: `screenshots/${String(i + 1).padStart(2, '0')}-${scene.id}-pre.png`,
        screenshotPost: `screenshots/${String(i + 1).padStart(2, '0')}-${scene.id}-post.png`,
        ts: new Date().toISOString(),
      });

      await page.waitForTimeout(scene.pauseMs);
    }
  } catch (e) {
    errors.push({ scene: 'fatal', error: e.message, stack: e.stack });
    log(`  ✗ ERRO FATAL: ${e.message}`);
  } finally {
    await page.close();
    await context.close();
  }

  const files = await readdir(cityDir);
  const webm = files.find((f) => f.endsWith('.webm'));
  if (webm) {
    await rename(join(cityDir, webm), join(cityDir, 'video.webm')).catch(() => {});
  }

  const duration = (Date.now() - startTime) / 1000;
  log(`  ✓ ${roteiro.cityLabel}: ${duration.toFixed(0)}s, ${transcript.length} cenas, ${errors.length} erros`);

  await writeFile(join(cityDir, 'transcript.json'), JSON.stringify({ muni, consId, scenes: transcript, errors, durationSec: duration }, null, 2));
  await writeFile(join(cityDir, 'transcript.md'), buildTranscriptMd(roteiro, muni, transcript, errors));

  return { roteiro, muni, consId, transcript, errors, durationSec: duration };
}

function buildTranscriptMd(roteiro, muni, transcript, errors) {
  const lines = [
    `# Simulação: ${roteiro.cityLabel}`,
    ``,
    `**Município**: ${muni.nome} (id ${muni.id})`,
    `**Matrículas**: ${(muni.totalMatriculas ?? 0).toLocaleString('pt-BR')}`,
    `**Receita atual**: R$ ${((muni.receitaTotal ?? 0) / 1e6).toFixed(1)}M`,
    `**Potencial identificado (banco)**: R$ ${((muni.potTotal ?? 0) / 1e6).toFixed(1)}M`,
    `**Recebe VAAR?**: ${muni.recebeVaar ? `Sim (R$ ${((muni.vaarBanco ?? 0) / 1e3).toFixed(0)}k/ano)` : 'Não'}`,
    ``,
    `---`,
    ``,
  ];

  for (const s of transcript) {
    lines.push(`## ${s.stepLabel}`);
    lines.push(``);
    lines.push(`**URL**: \`${s.url}\``);
    lines.push(``);
    lines.push(`> 🎤 **Secretária**: ${s.secretQuestion}`);
    lines.push(``);
    lines.push(`> 👨‍💼 **Consultor**: ${s.consultorResponse}`);
    lines.push(``);
    lines.push(`**Screenshots**:`);
    lines.push(`- Pré: \`${s.screenshotPre}\``);
    lines.push(`- Pós: \`${s.screenshotPost}\``);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
  }

  if (errors.length > 0) {
    lines.push(`## ⚠️ Erros / Bordas encontradas`);
    lines.push(``);
    for (const e of errors) lines.push(`- **${e.scene}**: ${e.error}`);
    lines.push(``);
  }

  return lines.join('\n');
}

function buildTimelineHtml(result) {
  const { roteiro, muni, transcript, errors, durationSec } = result;
  const slidesHtml = transcript.map((s, i) => `
    <div class="slide" data-idx="${i}">
      <div class="slide-meta">${s.stepLabel} &middot; <code>${escapeHtml(s.url)}</code></div>
      <img class="slide-shot" src="${s.screenshotPost}" alt="${escapeHtml(s.sceneId)}" />
      <div class="bubble bubble-secret">
        <div class="bubble-tag">SECRETARIA</div>
        <div>${escapeHtml(s.secretQuestion)}</div>
      </div>
      <div class="bubble bubble-resp">
        <div class="bubble-tag">CONSULTOR</div>
        <div>${escapeHtml(s.consultorResponse)}</div>
      </div>
    </div>
  `).join('');

  const errorsHtml = errors.length > 0
    ? `<div class="errors"><h3>${errors.length} erro(s) durante a simulação</h3><ul>${errors.map((e) => `<li><code>${escapeHtml(e.scene)}</code>: ${escapeHtml(e.error)}</li>`).join('')}</ul></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Simulação ${escapeHtml(roteiro.cityLabel)}</title>
<style>
  body { font-family: -apple-system, sans-serif; margin: 0; background: #0A2463; color: #fff; }
  header { padding: 20px 32px; border-bottom: 3px solid #00B4D8; }
  h1 { margin: 0; font-size: 22px; color: #00B4D8; }
  .subtitle { font-size: 13px; opacity: 0.7; margin-top: 4px; }
  .container { max-width: 1100px; margin: 0 auto; padding: 24px; }
  .video-section { background: #000; border-radius: 12px; overflow: hidden; margin-bottom: 24px; }
  video { width: 100%; display: block; }
  .meta { display: grid; grid-template-columns: repeat(auto-fit,minmax(140px,1fr)); gap: 12px; margin-bottom: 24px; }
  .meta div { background: rgba(255,255,255,0.05); padding: 10px 12px; border-radius: 8px; }
  .meta b { color: #00E5A0; display: block; font-size: 11px; letter-spacing: 1.5px; margin-bottom: 4px; }
  .controls { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; }
  .controls button { background: #00B4D8; color: white; border: 0; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-weight: 600; }
  .controls input { width: 60px; padding: 6px; border-radius: 4px; border: 0; }
  .slides { position: relative; min-height: 700px; background: #0d3280; border-radius: 12px; padding: 20px; }
  .slide { display: none; }
  .slide.active { display: block; }
  .slide-meta { font-size: 12px; opacity: 0.6; margin-bottom: 12px; }
  .slide-shot { width: 100%; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
  .bubble { background: rgba(255,255,255,0.06); padding: 14px 16px; border-radius: 10px; margin-top: 12px; border-left: 4px solid; line-height: 1.5; }
  .bubble-secret { border-color: #00B4D8; }
  .bubble-resp { border-color: #00E5A0; }
  .bubble-tag { font-size: 10px; font-weight: bold; letter-spacing: 1.5px; opacity: 0.8; margin-bottom: 4px; }
  .errors { margin-top: 24px; background: rgba(220,38,38,0.15); border: 1px solid rgba(220,38,38,0.4); padding: 16px; border-radius: 10px; }
  .errors h3 { margin: 0 0 8px 0; color: #fca5a5; }
  .errors li { font-size: 13px; line-height: 1.5; }
</style>
</head>
<body>
<header>
  <h1>Simulação ${escapeHtml(roteiro.cityLabel)}</h1>
  <div class="subtitle">${escapeHtml(muni.nome)} &middot; ${(muni.totalMatriculas ?? 0).toLocaleString('pt-BR')} matrículas &middot; duração ${durationSec.toFixed(0)}s &middot; ${transcript.length} cenas</div>
</header>
<div class="container">
  <div class="meta">
    <div><b>RECEITA ATUAL</b> R$ ${((muni.receitaTotal ?? 0) / 1e6).toFixed(1)}M</div>
    <div><b>POT (BANCO)</b> R$ ${((muni.potTotal ?? 0) / 1e6).toFixed(1)}M</div>
    <div><b>RECEBE VAAR</b> ${muni.recebeVaar ? 'Sim' : 'Não'}</div>
    <div><b>IDEB AI</b> ${muni.idebAi ?? '—'}</div>
    <div><b>ESCOLAS</b> ${muni.totalEscolas ?? '—'}</div>
  </div>

  <div class="video-section">
    <video src="video.webm" controls preload="metadata"></video>
  </div>

  <div class="controls">
    <button id="prev">← Anterior</button>
    <span id="counter">1 / ${transcript.length}</span>
    <button id="next">Próximo →</button>
    <input type="number" id="jumpTo" min="1" max="${transcript.length}" value="1" />
    <button id="jump">Ir</button>
  </div>

  <div class="slides">${slidesHtml}</div>
  ${errorsHtml}
</div>
<script>
  const slides = document.querySelectorAll('.slide');
  let cur = 0;
  function show(i) {
    cur = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach(function(s, idx) { s.classList.toggle('active', idx === cur); });
    document.getElementById('counter').textContent = (cur + 1) + ' / ' + slides.length;
    document.getElementById('jumpTo').value = cur + 1;
  }
  show(0);
  document.getElementById('prev').onclick = function() { show(cur - 1); };
  document.getElementById('next').onclick = function() { show(cur + 1); };
  document.getElementById('jump').onclick = function() { show(parseInt(document.getElementById('jumpTo').value, 10) - 1); };
  document.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowLeft') show(cur - 1);
    if (e.key === 'ArrowRight') show(cur + 1);
  });
</script>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function main() {
  await ensureDir(RUN_ROOT);
  log(`Output: ${RUN_ROOT}`);
  await cleanupOldSimulations();

  const browser = await chromium.launch({ headless: true });

  const results = [];
  for (const roteiro of ROTEIROS) {
    try {
      const r = await runSimulation(roteiro, RUN_ROOT, browser);
      results.push(r);
      const html = buildTimelineHtml(r);
      await writeFile(join(RUN_ROOT, roteiro.cityKey, 'timeline.html'), html);
    } catch (e) {
      log(`✗ Falhou ${roteiro.cityLabel}: ${e.message}`);
      results.push({ roteiro, error: e.message });
    }
  }

  await browser.close();

  const readme = [
    `# Simulações ${RUN_TS}`,
    ``,
    `Total de cidades: ${results.length}`,
    ``,
    ...results.map((r) => {
      if (r.error) return `- ❌ **${r.roteiro.cityLabel}**: ${r.error}`;
      return `- ✅ **${r.roteiro.cityLabel}** — ${r.transcript.length} cenas, ${r.errors.length} erros, ${r.durationSec.toFixed(0)}s · [timeline](${r.roteiro.cityKey}/timeline.html) · [transcript](${r.roteiro.cityKey}/transcript.md) · video.webm`;
    }),
    ``,
    `## Como assistir`,
    ``,
    `Abra qualquer **timeline.html** no Chrome:`,
    `\`\`\``,
    `open ${RUN_ROOT}/grande-campinas/timeline.html`,
    `\`\`\``,
    ``,
    `Cada timeline tem:`,
    `- Vídeo WEBM da sessão (top)`,
    `- Navegação por cena (botões + teclado seta esquerda/direita)`,
    `- Diálogo secretária ↔ consultor sincronizado com screenshots`,
    ``,
    `## Bugs / Pendências encontradas`,
    ``,
    ...results.flatMap((r) => {
      if (r.error || !r.errors?.length) return [];
      return [`### ${r.roteiro.cityLabel}`, '', ...r.errors.map((e) => `- **${e.scene}**: ${e.error}`), ''];
    }),
  ].join('\n');
  await writeFile(join(RUN_ROOT, 'README.md'), readme);
  log(`\n✓ DONE. Tudo em ${RUN_ROOT}`);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
