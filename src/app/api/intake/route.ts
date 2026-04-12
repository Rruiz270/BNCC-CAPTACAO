import { neon } from '@neondatabase/serverless';
import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const DATABASE_URL = process.env.DATABASE_URL!;

function generateToken(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Ensure intake tables exist
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureIntakeTables(sql: any) {
  await sql`
    CREATE TABLE IF NOT EXISTS fundeb.intake_tokens (
      id             SERIAL PRIMARY KEY,
      token          VARCHAR(64) NOT NULL UNIQUE,
      municipality_id INTEGER REFERENCES fundeb.municipalities(id),
      consultoria_id  INTEGER REFERENCES fundeb.consultorias(id),
      created_by     TEXT,
      expires_at     TIMESTAMP NOT NULL,
      responded_at   TIMESTAMP,
      created_at     TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS fundeb.intake_responses (
      id              SERIAL PRIMARY KEY,
      token_id        INTEGER REFERENCES fundeb.intake_tokens(id),
      municipality_id INTEGER REFERENCES fundeb.municipalities(id),
      respondent_name TEXT NOT NULL,
      respondent_role TEXT,
      respondent_email TEXT,
      data            JSONB,
      submitted_at    TIMESTAMP DEFAULT NOW()
    )
  `;
}

// POST /api/intake — Generate a new intake token
// Accepts EITHER { consultoriaId } OR { municipalityId } (pre-consultoria)
export async function POST(request: NextRequest) {
  try {
    const sql = neon(DATABASE_URL);
    await ensureIntakeTables(sql);

    const body = await request.json();
    const { consultoriaId, municipalityId } = body;

    if (!consultoriaId && !municipalityId) {
      return Response.json({ error: 'consultoriaId or municipalityId required' }, { status: 400 });
    }

    let muniId: number;
    let muniName: string;

    if (consultoriaId) {
      // Original flow: derive municipality from consultoria
      const sessions = await sql`
        SELECT c.id, c.municipality_id, c.status, m.nome
        FROM fundeb.consultorias c
        JOIN fundeb.municipalities m ON m.id = c.municipality_id
        WHERE c.id = ${consultoriaId}
      `;

      if (sessions.length === 0) {
        return Response.json({ error: 'Consultoria nao encontrada' }, { status: 404 });
      }

      const session = sessions[0];
      if (session.status !== 'active') {
        return Response.json({ error: 'Consultoria nao esta ativa' }, { status: 400 });
      }

      muniId = session.municipality_id as number;
      muniName = session.nome as string;
    } else {
      // Pre-consultoria flow: municipality directly
      const munis = await sql`
        SELECT id, nome FROM fundeb.municipalities WHERE id = ${municipalityId}
      `;

      if (munis.length === 0) {
        return Response.json({ error: 'Municipio nao encontrado' }, { status: 404 });
      }

      muniId = munis[0].id as number;
      muniName = munis[0].nome as string;
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await sql`
      INSERT INTO fundeb.intake_tokens (token, municipality_id, consultoria_id, created_by, expires_at)
      VALUES (${token}, ${muniId}, ${consultoriaId || null}, ${'consultor'}, ${expiresAt.toISOString()})
    `;

    const url = `/intake/${token}`;

    return Response.json({
      token,
      url,
      municipio: muniName,
      municipalityId: muniId,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}

// GET /api/intake
// Query modes:
//   ?consultoriaId=X    — most recent intake response for a consultoria
//   ?municipalityId=X   — most recent intake response for a municipality (wizard fallback)
//   ?list=all           — ALL tokens with status info (captacao admin table)
export async function GET(request: NextRequest) {
  try {
    const sql = neon(DATABASE_URL);
    await ensureIntakeTables(sql);

    const { searchParams } = new URL(request.url);
    const consultoriaId = searchParams.get('consultoriaId');
    const municipalityId = searchParams.get('municipalityId');
    const list = searchParams.get('list');

    // List all tokens (captacao admin table)
    if (list === 'all') {
      const rows = await sql`
        SELECT t.id, t.token, t.municipality_id, t.consultoria_id,
               t.created_at, t.expires_at, t.responded_at, t.created_by,
               m.nome AS municipio_nome,
               r.respondent_name
        FROM fundeb.intake_tokens t
        JOIN fundeb.municipalities m ON m.id = t.municipality_id
        LEFT JOIN fundeb.intake_responses r ON r.token_id = t.id
        ORDER BY t.created_at DESC
      `;

      const now = new Date();
      const tokens = rows.map((row: Record<string, unknown>) => ({
        id: row.id,
        token: row.token,
        municipalityId: row.municipality_id,
        municipioNome: row.municipio_nome,
        consultoriaId: row.consultoria_id,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        respondedAt: row.responded_at,
        respondentName: row.respondent_name,
        status: row.responded_at
          ? 'respondido'
          : new Date(row.expires_at as string) < now
            ? 'expirado'
            : 'pendente',
      }));

      return Response.json({ tokens });
    }

    // By consultoria
    if (consultoriaId) {
      const tokens = await sql`
        SELECT t.id, t.token, t.responded_at, t.municipality_id,
               r.id AS response_id, r.respondent_name, r.respondent_role, r.respondent_email,
               r.data, r.submitted_at
        FROM fundeb.intake_tokens t
        LEFT JOIN fundeb.intake_responses r ON r.token_id = t.id
        WHERE t.consultoria_id = ${consultoriaId}
          AND t.responded_at IS NOT NULL
        ORDER BY r.submitted_at DESC
        LIMIT 1
      `;

      if (tokens.length === 0) {
        return Response.json({ response: null });
      }

      const row = tokens[0];
      return Response.json({
        response: {
          id: row.response_id,
          tokenId: row.id,
          respondentName: row.respondent_name,
          respondentRole: row.respondent_role,
          respondentEmail: row.respondent_email,
          data: row.data,
          submittedAt: row.submitted_at,
          respondedAt: row.responded_at,
        },
      });
    }

    // By municipality (fallback for wizard)
    if (municipalityId) {
      const tokens = await sql`
        SELECT t.id, t.token, t.responded_at, t.municipality_id,
               r.id AS response_id, r.respondent_name, r.respondent_role, r.respondent_email,
               r.data, r.submitted_at
        FROM fundeb.intake_tokens t
        LEFT JOIN fundeb.intake_responses r ON r.token_id = t.id
        WHERE t.municipality_id = ${municipalityId}
          AND t.responded_at IS NOT NULL
        ORDER BY r.submitted_at DESC
        LIMIT 1
      `;

      if (tokens.length === 0) {
        return Response.json({ response: null });
      }

      const row = tokens[0];
      return Response.json({
        response: {
          id: row.response_id,
          tokenId: row.id,
          respondentName: row.respondent_name,
          respondentRole: row.respondent_role,
          respondentEmail: row.respondent_email,
          data: row.data,
          submittedAt: row.submitted_at,
          respondedAt: row.responded_at,
        },
      });
    }

    return Response.json({ error: 'Provide consultoriaId, municipalityId, or list=all' }, { status: 400 });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}
