#!/usr/bin/env node
/**
 * Importa o ranking de interesse em consultoria FUNDEB
 * (~/municipios-consultoria-fundeb.md) para fundeb.leads no Neon.
 *
 * Uso: node scripts/import-leads.mjs [caminho-do-md]
 * Requer DATABASE_URL (lê .env.local automaticamente).
 *
 * Idempotente: UPSERT por (nome, uf). Municípios são vinculados a
 * fundeb.municipalities por nome (uf padrão SP — a lista veio das campanhas SP).
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config({ path: join(process.cwd(), '.env.local') });

const MD_PATH = process.argv[2] ?? join(homedir(), 'municipios-consultoria-fundeb.md');
const UF_PADRAO = 'SP';

const sql = neon(process.env.DATABASE_URL);

const md = readFileSync(MD_PATH, 'utf8');

// Seções: "## 🔥 QUENTE — 9 municípios" etc.
const SECOES = [
  { re: /##\s*🔥\s*QUENTE/, score: 'quente' },
  { re: /##\s*🟠\s*MORNO/, score: 'morno' },
  { re: /##\s*🟡\s*ENGAJADO/, score: 'engajado' },
  { re: /##\s*⚪\s*FRIO/, score: 'frio' },
];

let atual = null;
const leads = [];

for (const raw of md.split('\n')) {
  const line = raw.trim();
  const secao = SECOES.find((s) => s.re.test(line));
  if (secao) {
    atual = secao.score;
    continue;
  }
  if (!atual || !line.startsWith('|')) continue;

  // | 1 | **Santa Branca** | 147 | 4 | CRM/follow_up · ... |
  const cols = line.split('|').map((c) => c.trim());
  if (cols.length < 6) continue;
  if (!/^\d+$/.test(cols[1])) continue; // pula header/separador

  const nome = cols[2].replace(/\*\*/g, '').trim();
  const pontos = parseInt(cols[3]) || 0;
  const sinais = cols[5]
    ? cols[5].split('·').map((s) => s.trim()).filter(Boolean)
    : [];

  if (nome) leads.push({ nome, pontos, score: atual, sinais });
}

// Seção FRIO: lista corrida "Nome · Nome · Nome" logo após o heading
const frioMatch = md.match(/##\s*⚪\s*FRIO[^\n]*\n+([\s\S]*?)(\n##|$)/);
if (frioMatch) {
  const nomes = frioMatch[1]
    .split('·')
    .map((s) => s.replace(/\*\*/g, '').trim())
    .filter((s) => s && !s.startsWith('#') && s.length < 60);
  for (const nome of nomes) {
    if (!leads.some((l) => l.nome.toLowerCase() === nome.toLowerCase())) {
      leads.push({ nome, pontos: 0, score: 'frio', sinais: [] });
    }
  }
}

console.log(`Parseados ${leads.length} leads de ${MD_PATH}`);
if (!leads.length) process.exit(1);

let inseridos = 0;
let vinculados = 0;

for (const lead of leads) {
  const [muni] = await sql`
    SELECT id FROM fundeb.municipalities
    WHERE nome ILIKE ${lead.nome} AND (uf = ${UF_PADRAO} OR uf IS NULL)
    ORDER BY uf NULLS LAST LIMIT 1`;
  if (muni) vinculados++;

  await sql`
    INSERT INTO fundeb.leads (municipality_id, nome, uf, score, pontos, origem, sinais, updated_at)
    VALUES (${muni?.id ?? null}, ${lead.nome}, ${UF_PADRAO}, ${lead.score}, ${lead.pontos},
            'ranking-md', ${JSON.stringify(lead.sinais)}::jsonb, NOW())
    ON CONFLICT (nome, uf) DO UPDATE SET
      municipality_id = COALESCE(EXCLUDED.municipality_id, fundeb.leads.municipality_id),
      score = EXCLUDED.score,
      pontos = EXCLUDED.pontos,
      sinais = EXCLUDED.sinais,
      updated_at = NOW()`;
  inseridos++;
}

const dist = leads.reduce((acc, l) => ((acc[l.score] = (acc[l.score] ?? 0) + 1), acc), {});
console.log(`OK: ${inseridos} leads gravados (${vinculados} vinculados a municípios).`);
console.log('Distribuição:', dist);
