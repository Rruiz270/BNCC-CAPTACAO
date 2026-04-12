import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DATABASE_URL = process.env.DATABASE_URL!;

// POST /api/ops/sync-siconfi
// Syncs SICONFI fiscal data from the fundeb-sp-2026 database into the Neon siconfi_data table.
// Since we can't directly connect to the local SQLite from Vercel, this endpoint accepts
// a batch of records posted as JSON (used from a local script).
// Or, when run locally, reads directly from the SQLite database.
export async function POST(request: Request) {
  try {
    const sql = neon(DATABASE_URL);
    const body = await request.json();

    // Ensure table exists
    await sql`CREATE TABLE IF NOT EXISTS fundeb.siconfi_data (
      id SERIAL PRIMARY KEY,
      municipality_id INTEGER REFERENCES fundeb.municipalities(id),
      exercicio INTEGER NOT NULL,
      periodo TEXT,
      tipo TEXT NOT NULL,
      anexo TEXT,
      cod_conta TEXT,
      conta TEXT,
      coluna TEXT,
      valor REAL,
      created_at TIMESTAMP DEFAULT NOW()
    )`;

    if (body.records && Array.isArray(body.records)) {
      // Batch insert mode
      const records = body.records as Array<{
        municipality_id: number;
        exercicio: number;
        periodo?: string;
        tipo: string;
        anexo?: string;
        cod_conta?: string;
        conta?: string;
        coluna?: string;
        valor?: number;
      }>;

      let inserted = 0;
      const BATCH = 200;

      for (let i = 0; i < records.length; i += BATCH) {
        const chunk = records.slice(i, i + BATCH);
        const values: string[] = [];
        const params: (string | number | null)[] = [];

        chunk.forEach((r, j) => {
          const idx = j * 9;
          values.push(
            `($${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, $${idx + 7}, $${idx + 8}, $${idx + 9})`
          );
          params.push(
            r.municipality_id,
            r.exercicio,
            r.periodo || null,
            r.tipo,
            r.anexo || null,
            r.cod_conta || null,
            r.conta || null,
            r.coluna || null,
            r.valor ?? null,
          );
        });

        await sql.query(
          `INSERT INTO fundeb.siconfi_data (municipality_id, exercicio, periodo, tipo, anexo, cod_conta, conta, coluna, valor)
           VALUES ${values.join(',')}`,
          params
        );
        inserted += chunk.length;
      }

      return Response.json({ ok: true, inserted });
    }

    return Response.json({ error: 'Provide { records: [...] } in body' }, { status: 400 });
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// GET /api/ops/sync-siconfi?municipalityId=X
// Returns SICONFI fiscal summary for a municipality
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const muniId = searchParams.get('municipalityId');

    if (!muniId) return Response.json({ error: 'municipalityId required' }, { status: 400 });

    const sql = neon(DATABASE_URL);

    // Check if table exists
    let hasData = false;
    try {
      const count = await sql`SELECT COUNT(*)::int as n FROM fundeb.siconfi_data WHERE municipality_id = ${parseInt(muniId)}`;
      hasData = (count[0]?.n || 0) > 0;
    } catch {
      return Response.json({ hasData: false, summary: null, message: 'SICONFI table not yet created. Run migration first.' });
    }

    if (!hasData) {
      return Response.json({ hasData: false, summary: null });
    }

    // Get summary data
    const summary = await sql`
      SELECT exercicio, tipo, COUNT(*)::int as n_records, SUM(COALESCE(valor, 0)) as total_valor
      FROM fundeb.siconfi_data
      WHERE municipality_id = ${parseInt(muniId)}
      GROUP BY exercicio, tipo
      ORDER BY exercicio, tipo
    `;

    return Response.json({ hasData: true, summary });
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
