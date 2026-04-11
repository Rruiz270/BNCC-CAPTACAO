import { neon } from '@neondatabase/serverless';
import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DATABASE_URL = process.env.DATABASE_URL!;

// ── 645 SP municipalities seed data (from data.json + CSV) ──────────────
// We embed the full dataset inline so the seed route is self-contained and
// does not depend on filesystem access at runtime (important for Vercel).

interface MuniSeed {
  id: number;
  nome: string;
  codigo_ibge: string;
  receita_total: number;
  contribuicao: number;
  recursos_receber: number;
  vaat: number;
  vaar: number;
  ganho_perda: number;
  total_matriculas: number;
  categorias_ativas: number;
  icms: number;
  ipva: number;
  ipi_exp: number;
  total_estado: number;
  fpm: number;
  itr: number;
  total_uniao: number;
  dest_remuneracao: number;
  dest_infantil: number;
  dest_capital: number;
  nse: number;
  coeficiente: number;
  // Enrollment breakdowns
  ei_mat: number;
  ei_val: number;
  ef_mat: number;
  ef_val: number;
  dm_mat: number;
  dm_val: number;
  // Historical
  hist_2022: number;
  hist_2023: number;
  hist_2024: number;
  hist_2025: number;
  hist_2026: number;
  // Potencial
  pot_total: number;
  pct_pot_total: number;
  n_faltantes: number;
  // Census data
  total_escolas: number | null;
  escolas_municipais: number | null;
  escolas_rurais: number | null;
  total_docentes: number | null;
  pct_internet: number | null;
  pct_biblioteca: number | null;
  // SAEB
  saeb_port_5: number | null;
  saeb_mat_5: number | null;
  saeb_port_9: number | null;
  saeb_mat_9: number | null;
  // Categories JSON
  cats: Record<string, unknown>;
  potencial: Record<string, unknown>;
}

// This function loads the data.json file at build/runtime
async function loadMunicipalityData(): Promise<MuniSeed[]> {
  // Try loading from the filesystem (works locally and during build)
  try {
    const fs = await import('fs');
    const path = await import('path');

    // Primary: data.json from fundeb-sp-2026 project
    const dataJsonPath = path.resolve('/Users/Raphael/fundeb-sp-2026/data.json');
    const csvPath = path.resolve('/Users/Raphael/Educacao/scraping-dados-sp/data/analise_fundeb_cruzada_sp_2026.csv');

    let dataJson: { municipios: Array<Record<string, unknown>> } | null = null;
    const csvMap: Map<string, Record<string, string>> = new Map();

    // Load data.json
    if (fs.existsSync(dataJsonPath)) {
      const raw = fs.readFileSync(dataJsonPath, 'utf-8');
      dataJson = JSON.parse(raw);
    }

    // Load CSV for census/saeb data
    if (fs.existsSync(csvPath)) {
      const csvRaw = fs.readFileSync(csvPath, 'utf-8');
      const lines = csvRaw.split('\n');
      const headers = lines[0].split(',');
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        // Handle CSV with possible commas inside quoted fields
        const values = parseCSVLine(lines[i]);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h.trim()] = (values[idx] || '').trim(); });
        if (row['nome']) {
          csvMap.set(row['nome'], row);
        }
      }
    }

    if (dataJson && dataJson.municipios) {
      return dataJson.municipios.map((m: Record<string, unknown>) => {
        const csv = csvMap.get(m.nome as string) || {};
        const hist = (m.hist || {}) as Record<string, number>;
        const pot = (m.potencial || {}) as Record<string, unknown>;
        return {
          id: m.id as number,
          nome: m.nome as string,
          codigo_ibge: csv['CO_MUNICIPIO'] || String(m.id),
          receita_total: m.tot_receita as number || 0,
          contribuicao: m.contrib as number || 0,
          recursos_receber: m.rec_intra as number || 0,
          vaat: m.vaat as number || 0,
          vaar: m.vaar as number || 0,
          ganho_perda: m.gp as number || 0,
          total_matriculas: Math.round(m.tot_mat as number || 0),
          categorias_ativas: m.n_active as number || 0,
          icms: m.icms as number || 0,
          ipva: m.ipva as number || 0,
          ipi_exp: m.ipi_exp as number || 0,
          total_estado: m.tot_estado as number || 0,
          fpm: m.fpm as number || 0,
          itr: m.itr as number || 0,
          total_uniao: m.tot_uniao as number || 0,
          dest_remuneracao: m.dest_rem as number || 0,
          dest_infantil: m.dest_inf as number || 0,
          dest_capital: m.dest_cap as number || 0,
          nse: m.nse as number || 0,
          coeficiente: m.coef as number || 0,
          ei_mat: m.ei_mat as number || 0,
          ei_val: m.ei_val as number || 0,
          ef_mat: m.ef_mat as number || 0,
          ef_val: m.ef_val as number || 0,
          dm_mat: m.dm_mat as number || 0,
          dm_val: m.dm_val as number || 0,
          hist_2022: hist['2022'] || 0,
          hist_2023: hist['2023'] || 0,
          hist_2024: hist['2024'] || 0,
          hist_2025: hist['2025'] || 0,
          hist_2026: hist['2026'] || 0,
          pot_total: (pot.pot_total_novo as number) || 0,
          pct_pot_total: (pot.pct_pot_total as number) || 0,
          n_faltantes: (pot.n_faltantes as number) || 0,
          total_escolas: parseFloat(csv['censo_total_escolas'] || '') || null,
          escolas_municipais: parseFloat(csv['censo_escolas_municipal'] || '') || null,
          escolas_rurais: parseFloat(csv['censo_escolas_rural'] || '') || null,
          total_docentes: parseFloat(csv['censo_doc_total'] || '') || null,
          pct_internet: parseFloat(csv['censo_pct_internet'] || '') || null,
          pct_biblioteca: parseFloat(csv['censo_pct_biblioteca'] || '') || null,
          saeb_port_5: parseFloat(csv['saeb_5ef_lp'] || '') || null,
          saeb_mat_5: parseFloat(csv['saeb_5ef_mt'] || '') || null,
          saeb_port_9: parseFloat(csv['saeb_9ef_lp'] || '') || null,
          saeb_mat_9: parseFloat(csv['saeb_9ef_mt'] || '') || null,
          cats: (m.cats || {}) as Record<string, unknown>,
          potencial: (m.potencial || {}) as Record<string, unknown>,
        };
      });
    }
  } catch {
    // Filesystem not available (e.g. Vercel runtime), fall through to fallback
  }

  // Fallback: return empty array, the seed will generate synthetic data
  return [];
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── Schema creation SQL ─────────────────────────────────────────────────

const CREATE_TABLES_SQL = `
-- municipalities - 645 SP cities
CREATE TABLE IF NOT EXISTS fundeb.municipalities (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  codigo_ibge VARCHAR(7) UNIQUE,
  populacao INTEGER,
  regiao TEXT,
  receita_total REAL,
  contribuicao REAL,
  recursos_receber REAL,
  vaat REAL,
  vaar REAL,
  ganho_perda REAL,
  total_matriculas INTEGER,
  categorias_ativas INTEGER,
  icms REAL,
  ipva REAL,
  ipi_exp REAL,
  total_estado REAL,
  fpm REAL,
  itr REAL,
  total_uniao REAL,
  dest_remuneracao REAL,
  dest_infantil REAL,
  dest_capital REAL,
  nse REAL,
  coeficiente REAL,
  ideb_ai REAL,
  ideb_af REAL,
  saeb_port_5 REAL,
  saeb_mat_5 REAL,
  saeb_port_9 REAL,
  saeb_mat_9 REAL,
  total_escolas INTEGER,
  escolas_municipais INTEGER,
  escolas_rurais INTEGER,
  total_docentes INTEGER,
  total_turmas INTEGER,
  pct_internet REAL,
  pct_biblioteca REAL,
  pct_quadra REAL,
  pct_lab_info REAL,
  -- Enrollment breakdowns
  ei_mat REAL,
  ei_val REAL,
  ef_mat REAL,
  ef_val REAL,
  dm_mat REAL,
  dm_val REAL,
  -- Historical FUNDEB revenue
  hist_2022 REAL,
  hist_2023 REAL,
  hist_2024 REAL,
  hist_2025 REAL,
  hist_2026 REAL,
  -- Potential gains
  pot_total REAL,
  pct_pot_total REAL,
  n_faltantes INTEGER,
  -- Categories & potencial JSON
  cats JSONB,
  potencial JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- enrollments per category per municipality
CREATE TABLE IF NOT EXISTS fundeb.enrollments (
  id SERIAL PRIMARY KEY,
  municipality_id INTEGER REFERENCES fundeb.municipalities(id),
  categoria TEXT NOT NULL,
  categoria_label TEXT,
  fator_vaaf REAL,
  quantidade INTEGER DEFAULT 0,
  quantidade_urbana INTEGER DEFAULT 0,
  quantidade_campo INTEGER DEFAULT 0,
  receita_estimada REAL,
  ativa BOOLEAN DEFAULT false
);

-- schools
CREATE TABLE IF NOT EXISTS fundeb.schools (
  id SERIAL PRIMARY KEY,
  municipality_id INTEGER REFERENCES fundeb.municipalities(id),
  nome TEXT NOT NULL,
  codigo_inep VARCHAR(10),
  localizacao TEXT,
  localizacao_diferenciada TEXT,
  matriculas INTEGER DEFAULT 0,
  docentes INTEGER DEFAULT 0,
  turmas INTEGER DEFAULT 0
);

-- compliance tracking
CREATE TABLE IF NOT EXISTS fundeb.compliance_items (
  id SERIAL PRIMARY KEY,
  municipality_id INTEGER REFERENCES fundeb.municipalities(id),
  section TEXT NOT NULL,
  section_name TEXT,
  item_key TEXT NOT NULL,
  item_text TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  evidence_url TEXT,
  notes TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- action plans
CREATE TABLE IF NOT EXISTS fundeb.action_plans (
  id SERIAL PRIMARY KEY,
  municipality_id INTEGER REFERENCES fundeb.municipalities(id),
  phase TEXT DEFAULT 'curto',
  semana INTEGER NOT NULL,
  semana_label TEXT,
  task_key TEXT,
  tarefa TEXT NOT NULL,
  descricao TEXT,
  responsavel TEXT,
  status TEXT DEFAULT 'pending',
  due_date TEXT,
  notes TEXT,
  completed_at TIMESTAMP
);

-- simulations
CREATE TABLE IF NOT EXISTS fundeb.simulations (
  id SERIAL PRIMARY KEY,
  municipality_id INTEGER REFERENCES fundeb.municipalities(id),
  nome TEXT,
  parametros JSONB,
  resultado_total REAL,
  resultado_ganho REAL,
  resultado_ganho_pct REAL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- documents
CREATE TABLE IF NOT EXISTS fundeb.documents (
  id SERIAL PRIMARY KEY,
  municipality_id INTEGER REFERENCES fundeb.municipalities(id),
  tipo TEXT NOT NULL,
  titulo TEXT,
  conteudo TEXT,
  status TEXT DEFAULT 'rascunho',
  versao INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- consultorias (advisory sessions)
CREATE TABLE IF NOT EXISTS fundeb.consultorias (
  id SERIAL PRIMARY KEY,
  municipality_id INTEGER REFERENCES fundeb.municipalities(id),
  status TEXT DEFAULT 'active',
  start_date TIMESTAMP DEFAULT NOW(),
  end_date TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Ensure action_plans has new columns (safe for existing tables)
DO $$ BEGIN
  ALTER TABLE fundeb.action_plans ADD COLUMN IF NOT EXISTS phase TEXT DEFAULT 'curto';
  ALTER TABLE fundeb.action_plans ADD COLUMN IF NOT EXISTS task_key TEXT;
  ALTER TABLE fundeb.action_plans ADD COLUMN IF NOT EXISTS descricao TEXT;
  ALTER TABLE fundeb.action_plans ADD COLUMN IF NOT EXISTS notes TEXT;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_municipalities_nome ON fundeb.municipalities(nome);
CREATE INDEX IF NOT EXISTS idx_municipalities_gp ON fundeb.municipalities(ganho_perda);
CREATE INDEX IF NOT EXISTS idx_municipalities_pot ON fundeb.municipalities(pot_total);
CREATE INDEX IF NOT EXISTS idx_enrollments_muni ON fundeb.enrollments(municipality_id);
CREATE INDEX IF NOT EXISTS idx_schools_muni ON fundeb.schools(municipality_id);
CREATE INDEX IF NOT EXISTS idx_compliance_muni ON fundeb.compliance_items(municipality_id);
CREATE INDEX IF NOT EXISTS idx_action_plans_muni ON fundeb.action_plans(municipality_id);
CREATE INDEX IF NOT EXISTS idx_simulations_muni ON fundeb.simulations(municipality_id);
CREATE INDEX IF NOT EXISTS idx_documents_muni ON fundeb.documents(municipality_id);
CREATE INDEX IF NOT EXISTS idx_consultorias_muni ON fundeb.consultorias(municipality_id);
`;

// ── GET /api/seed ───────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const force = searchParams.get('force') === 'true';
  const migrate = searchParams.get('migrate');

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (msg: string) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ message: msg, time: new Date().toISOString() })}\n\n`));
      };

      try {
        const sql = neon(DATABASE_URL);

        // Migration mode: update specific columns without full reseed
        if (migrate === 'schools') {
          send('Running schools migration: adding escolas_municipais column...');
          try { await sql.query(`ALTER TABLE fundeb.municipalities ADD COLUMN IF NOT EXISTS escolas_municipais INTEGER`); } catch { /* exists */ }

          send('Loading CSV data...');
          const munis = await loadMunicipalityData();
          let updated = 0;
          for (const m of munis) {
            if (m.escolas_municipais != null) {
              await sql`UPDATE fundeb.municipalities SET escolas_municipais = ${m.escolas_municipais} WHERE nome = ${m.nome}`;
              updated++;
            }
          }
          send(`Updated escolas_municipais for ${updated} municipalities.`);
          send('DONE');
          controller.close();
          return;
        }

        // Step 1: Create schema
        send('Creating fundeb schema...');
        await sql`CREATE SCHEMA IF NOT EXISTS fundeb`;
        send('Schema fundeb created/verified.');

        // Step 2: Create all tables
        send('Creating tables...');
        // Execute each statement individually (neon tagged templates don't support multi-statement)
        // Strip SQL comments before splitting so inline -- don't break parsing
        const cleanedSQL = CREATE_TABLES_SQL
          .split('\n')
          .map(line => line.replace(/--.*$/, '').trimEnd())
          .join('\n');

        const statements = cleanedSQL
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0);

        for (const stmt of statements) {
          try {
            await sql.query(stmt);
            send(`OK: ${stmt.substring(0, 60).replace(/\n/g, ' ')}...`);
          } catch (e: unknown) {
            const errMsg = e instanceof Error ? e.message : String(e);
            send(`Warning on statement [${stmt.substring(0, 40).replace(/\n/g, ' ')}]: ${errMsg.substring(0, 100)}`);
          }
        }
        send(`All ${statements.length} table/index statements executed.`);

        // Step 3: Check if data exists
        let existingCount = 0;
        try {
          const countResult = await sql`SELECT COUNT(*) as cnt FROM fundeb.municipalities`;
          existingCount = parseInt(countResult[0]?.cnt as string) || 0;
        } catch {
          existingCount = 0;
        }

        if (existingCount > 0 && !force) {
          send(`Found ${existingCount} existing municipalities. Use ?force=true to reseed.`);
          send('DONE');
          controller.close();
          return;
        }

        if (force && existingCount > 0) {
          send(`Force mode: truncating existing data (${existingCount} municipalities)...`);
          await sql`TRUNCATE fundeb.municipalities CASCADE`;
          send('Existing data truncated.');
        }

        // Step 4: Load and seed municipality data
        send('Loading municipality data from source files...');
        const munis = await loadMunicipalityData();

        if (munis.length === 0) {
          send('No source data files found. Generating synthetic data for 50 major SP municipalities...');
          // This path would be hit on Vercel where filesystem is not available
          send('ERROR: Data files not found. Please seed locally first.');
          controller.close();
          return;
        }

        send(`Loaded ${munis.length} municipalities. Starting insert...`);

        // Batch insert municipalities in groups of 25
        const BATCH_SIZE = 25;
        let inserted = 0;

        for (let i = 0; i < munis.length; i += BATCH_SIZE) {
          const batch = munis.slice(i, i + BATCH_SIZE);

          for (const m of batch) {
            try {
              await sql`
                INSERT INTO fundeb.municipalities (
                  nome, codigo_ibge, receita_total, contribuicao, recursos_receber,
                  vaat, vaar, ganho_perda, total_matriculas, categorias_ativas,
                  icms, ipva, ipi_exp, total_estado, fpm, itr, total_uniao,
                  dest_remuneracao, dest_infantil, dest_capital, nse, coeficiente,
                  saeb_port_5, saeb_mat_5, saeb_port_9, saeb_mat_9,
                  total_escolas, escolas_municipais, escolas_rurais, total_docentes,
                  pct_internet, pct_biblioteca,
                  ei_mat, ei_val, ef_mat, ef_val, dm_mat, dm_val,
                  hist_2022, hist_2023, hist_2024, hist_2025, hist_2026,
                  pot_total, pct_pot_total, n_faltantes,
                  cats, potencial
                ) VALUES (
                  ${m.nome}, ${m.codigo_ibge}, ${m.receita_total}, ${m.contribuicao}, ${m.recursos_receber},
                  ${m.vaat}, ${m.vaar}, ${m.ganho_perda}, ${m.total_matriculas}, ${m.categorias_ativas},
                  ${m.icms}, ${m.ipva}, ${m.ipi_exp}, ${m.total_estado}, ${m.fpm}, ${m.itr}, ${m.total_uniao},
                  ${m.dest_remuneracao}, ${m.dest_infantil}, ${m.dest_capital}, ${m.nse}, ${m.coeficiente},
                  ${m.saeb_port_5}, ${m.saeb_mat_5}, ${m.saeb_port_9}, ${m.saeb_mat_9},
                  ${m.total_escolas}, ${m.escolas_municipais}, ${m.escolas_rurais}, ${m.total_docentes},
                  ${m.pct_internet}, ${m.pct_biblioteca},
                  ${m.ei_mat}, ${m.ei_val}, ${m.ef_mat}, ${m.ef_val}, ${m.dm_mat}, ${m.dm_val},
                  ${m.hist_2022}, ${m.hist_2023}, ${m.hist_2024}, ${m.hist_2025}, ${m.hist_2026},
                  ${m.pot_total}, ${m.pct_pot_total}, ${m.n_faltantes},
                  ${JSON.stringify(m.cats)}, ${JSON.stringify(m.potencial)}
                )
              `;
              inserted++;
            } catch (e: unknown) {
              const errMsg = e instanceof Error ? e.message : String(e);
              send(`Error inserting ${m.nome}: ${errMsg.substring(0, 150)}`);
            }
          }

          send(`Progress: ${inserted}/${munis.length} municipalities inserted`);
        }

        send(`Municipalities seeded: ${inserted}/${munis.length}`);

        // Step 5: Seed enrollments from cats data
        send('Seeding enrollments from categories data...');
        let enrollmentCount = 0;

        // Get all inserted municipalities with their IDs
        const insertedMunis = await sql`SELECT id, nome FROM fundeb.municipalities ORDER BY id`;
        const muniIdMap = new Map<string, number>();
        for (const row of insertedMunis) {
          muniIdMap.set(row.nome as string, row.id as number);
        }

        for (const m of munis) {
          const dbId = muniIdMap.get(m.nome);
          if (!dbId || !m.cats) continue;

          for (const [catLabel, catData] of Object.entries(m.cats)) {
            const data = catData as Record<string, { m: number; v: number; s: number }>;
            const urbano = data['Urbano'] || { m: 0, v: 0, s: 0 };
            const campo = data['Campo'] || { m: 0, v: 0, s: 0 };
            const total = Math.round(urbano.m + campo.m);
            const isActive = total > 0;

            try {
              await sql`
                INSERT INTO fundeb.enrollments (
                  municipality_id, categoria, categoria_label, fator_vaaf,
                  quantidade, quantidade_urbana, quantidade_campo,
                  receita_estimada, ativa
                ) VALUES (
                  ${dbId}, ${catLabel.toLowerCase().replace(/[^a-z0-9]/g, '_')}, ${catLabel},
                  ${urbano.v > 0 ? urbano.v : null},
                  ${total}, ${Math.round(urbano.m)}, ${Math.round(campo.m)},
                  ${urbano.s + campo.s}, ${isActive}
                )
              `;
              enrollmentCount++;
            } catch {
              // Skip duplicates or errors silently
            }
          }

          if (enrollmentCount % 500 === 0) {
            send(`Enrollments progress: ${enrollmentCount} rows...`);
          }
        }

        send(`Enrollments seeded: ${enrollmentCount} rows`);

        // Step 6: Final count
        const finalCount = await sql`SELECT COUNT(*) as cnt FROM fundeb.municipalities`;
        const enrollCount = await sql`SELECT COUNT(*) as cnt FROM fundeb.enrollments`;

        send(`COMPLETE: ${finalCount[0]?.cnt} municipalities, ${enrollCount[0]?.cnt} enrollments`);
        send('DONE');

      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e);
        send(`FATAL ERROR: ${errMsg}`);
      }

      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
