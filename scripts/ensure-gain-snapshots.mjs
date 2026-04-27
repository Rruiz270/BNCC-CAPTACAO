// Cria fundeb.gain_snapshots no banco em uso (.env.local DATABASE_URL).
// Idempotente — re-executar não causa erro.

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envFile = resolve(__dirname, '..', '.env.local');
try {
  const envContent = readFileSync(envFile, 'utf-8');
  for (const line of envContent.split('\n')) {
    const m = line.match(/^([A-Z_]+)="?([^"]+)"?$/);
    if (m) process.env[m[1]] = m[2];
  }
} catch {
  // optional
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL não encontrado em .env.local');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS fundeb.gain_snapshots (
    id              BIGSERIAL PRIMARY KEY,
    consultoria_id  INTEGER REFERENCES fundeb.consultorias(id) ON DELETE CASCADE,
    municipality_id INTEGER REFERENCES fundeb.municipalities(id),
    intake_token    VARCHAR(64),
    screen          TEXT NOT NULL,
    gain_total      REAL DEFAULT 0,
    gain_breakdown  JSONB,
    intake_data     JSONB,
    captured_by     TEXT,
    captured_at     TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_gain_snapshots_consultoria ON fundeb.gain_snapshots(consultoria_id)`,
  `CREATE INDEX IF NOT EXISTS idx_gain_snapshots_muni ON fundeb.gain_snapshots(municipality_id)`,
  `CREATE INDEX IF NOT EXISTS idx_gain_snapshots_token ON fundeb.gain_snapshots(intake_token)`,
  `CREATE INDEX IF NOT EXISTS idx_gain_snapshots_at ON fundeb.gain_snapshots(captured_at DESC)`,
];

for (const stmt of STATEMENTS) {
  try {
    await sql.query(stmt);
    console.log('✓', stmt.slice(0, 80).replace(/\s+/g, ' '));
  } catch (e) {
    console.error('✗', stmt.slice(0, 60), '\n  →', e.message);
  }
}

console.log('\nTabela fundeb.gain_snapshots pronta.');
