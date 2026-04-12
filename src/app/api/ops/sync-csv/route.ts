import { neon } from '@neondatabase/serverless';
import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DATABASE_URL = process.env.DATABASE_URL!;

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

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (msg: string) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ message: msg, time: new Date().toISOString() })}\n\n`));
      };

      try {
        const sql = neon(DATABASE_URL);
        const fs = await import('fs');

        const csvPath = '/Users/Raphael/Educacao/scraping-dados-sp/data/analise_fundeb_cruzada_sp_2026.csv';
        if (!fs.existsSync(csvPath)) {
          send('ERROR: CSV not found at ' + csvPath);
          controller.close();
          return;
        }

        send('Loading CSV...');
        const csvRaw = fs.readFileSync(csvPath, 'utf-8');
        const lines = csvRaw.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        send(`CSV loaded: ${lines.length - 1} rows, ${headers.length} columns`);

        // Run migration first to ensure columns exist
        send('Ensuring T1-T6 columns exist...');
        try {
          await sql.query(`DO $$ BEGIN
            ALTER TABLE fundeb.municipalities ADD COLUMN IF NOT EXISTS pot_t1 REAL DEFAULT 0;
            ALTER TABLE fundeb.municipalities ADD COLUMN IF NOT EXISTS pot_t2 REAL DEFAULT 0;
            ALTER TABLE fundeb.municipalities ADD COLUMN IF NOT EXISTS pot_t3 REAL DEFAULT 0;
            ALTER TABLE fundeb.municipalities ADD COLUMN IF NOT EXISTS pot_t4 REAL DEFAULT 0;
            ALTER TABLE fundeb.municipalities ADD COLUMN IF NOT EXISTS pot_t5_vaar REAL DEFAULT 0;
            ALTER TABLE fundeb.municipalities ADD COLUMN IF NOT EXISTS pot_t5_vaat REAL DEFAULT 0;
            ALTER TABLE fundeb.municipalities ADD COLUMN IF NOT EXISTS pot_t6 REAL DEFAULT 0;
            ALTER TABLE fundeb.municipalities ADD COLUMN IF NOT EXISTS estrategias_resumo TEXT;
            ALTER TABLE fundeb.municipalities ADD COLUMN IF NOT EXISTS cats_faltantes TEXT;
            ALTER TABLE fundeb.municipalities ADD COLUMN IF NOT EXISTS cats_ativas_list TEXT;
            ALTER TABLE fundeb.municipalities ADD COLUMN IF NOT EXISTS n_estrategias INTEGER DEFAULT 0;
            ALTER TABLE fundeb.municipalities ADD COLUMN IF NOT EXISTS crescimento_4anos REAL;
            ALTER TABLE fundeb.municipalities ADD COLUMN IF NOT EXISTS recebe_vaar BOOLEAN DEFAULT FALSE;
            ALTER TABLE fundeb.municipalities ADD COLUMN IF NOT EXISTS recebe_vaat BOOLEAN DEFAULT FALSE;
            ALTER TABLE fundeb.municipalities ADD COLUMN IF NOT EXISTS t4_has_campo BOOLEAN DEFAULT FALSE;
            ALTER TABLE fundeb.municipalities ADD COLUMN IF NOT EXISTS t4_has_ind BOOLEAN DEFAULT FALSE;
            ALTER TABLE fundeb.municipalities ADD COLUMN IF NOT EXISTS t4_ganho_campo REAL DEFAULT 0;
            ALTER TABLE fundeb.municipalities ADD COLUMN IF NOT EXISTS t4_ganho_ind REAL DEFAULT 0;
            ALTER TABLE fundeb.municipalities ADD COLUMN IF NOT EXISTS t2_ganho REAL DEFAULT 0;
            ALTER TABLE fundeb.municipalities ADD COLUMN IF NOT EXISTS t6_pct_integral REAL DEFAULT 0;
            ALTER TABLE fundeb.municipalities ADD COLUMN IF NOT EXISTS t6_mat_integral REAL DEFAULT 0;
            ALTER TABLE fundeb.municipalities ADD COLUMN IF NOT EXISTS quick_win_score REAL DEFAULT 0;
          EXCEPTION WHEN OTHERS THEN NULL;
          END $$`);
          send('Columns ensured.');
        } catch (e: unknown) {
          send('Column migration warning: ' + (e instanceof Error ? e.message : String(e)));
        }

        // Get municipality name->id map
        const muniRows = await sql`SELECT id, nome FROM fundeb.municipalities ORDER BY id`;
        const muniMap = new Map<string, number>();
        for (const row of muniRows) muniMap.set(row.nome as string, row.id as number);
        send(`Found ${muniMap.size} municipalities in DB`);

        let updated = 0;
        let skipped = 0;

        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const values = parseCSVLine(lines[i]);
          const row: Record<string, string> = {};
          headers.forEach((h, idx) => { row[h] = (values[idx] || '').trim(); });

          const nome = row['nome'];
          if (!nome) continue;

          const muniId = muniMap.get(nome);
          if (!muniId) {
            skipped++;
            continue;
          }

          const pf = (key: string) => { const v = parseFloat(row[key] || ''); return isNaN(v) ? null : v; };
          const pb = (key: string) => row[key] === 'True';

          try {
            await sql.query(
              `UPDATE fundeb.municipalities SET
                pot_t1 = $1, pot_t2 = $2, pot_t3 = $3, pot_t4 = $4,
                pot_t5_vaar = $5, pot_t5_vaat = $6, pot_t6 = $7,
                estrategias_resumo = $8, cats_faltantes = $9, cats_ativas_list = $10,
                n_estrategias = $11, crescimento_4anos = $12,
                recebe_vaar = $13, recebe_vaat = $14,
                t4_has_campo = $15, t4_has_ind = $16,
                t4_ganho_campo = $17, t4_ganho_ind = $18,
                t2_ganho = $19, t6_pct_integral = $20, t6_mat_integral = $21,
                quick_win_score = $22,
                updated_at = NOW()
              WHERE id = $23`,
              [
                pf('pot_t1'), pf('pot_t2'), pf('pot_t3'), pf('pot_t4'),
                pf('pot_t5_vaar'), pf('pot_t5_vaat'), pf('pot_t6'),
                (row['estrategias_resumo'] || '').substring(0, 2000) || null,
                (row['cats_faltantes'] || '').substring(0, 1000) || null,
                (row['cats_ativas'] || '').substring(0, 1000) || null,
                parseInt(row['n_estrategias'] || '0') || 0,
                pf('crescimento_4anos'),
                pb('recebe_vaar'), pb('recebe_vaat'),
                pb('t4_has_campo'), pb('t4_has_ind'),
                pf('t4_ganho_campo'), pf('t4_ganho_ind'),
                pf('t2_ganho'), pf('t6_pct_integral'), pf('t6_mat_integral'),
                pf('quick_win_score'),
                muniId,
              ]
            );
            updated++;
          } catch (e: unknown) {
            send(`Error updating ${nome}: ${(e instanceof Error ? e.message : String(e)).substring(0, 100)}`);
          }

          if (updated % 50 === 0) {
            send(`Progress: ${updated} municipalities updated...`);
          }
        }

        send(`SYNC COMPLETE: ${updated} updated, ${skipped} skipped (name not found)`);

        // Also sync census_data if not yet done
        send('Checking census_data...');
        try {
          const censusCount = await sql`SELECT COUNT(*)::int as n FROM fundeb.census_data`;
          send(`Census data: ${censusCount[0]?.n || 0} rows already present`);
        } catch {
          send('Census table does not exist yet - run /api/seed?migrate=census first');
        }

        send('DONE');
      } catch (e: unknown) {
        send(`FATAL: ${e instanceof Error ? e.message : String(e)}`);
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
