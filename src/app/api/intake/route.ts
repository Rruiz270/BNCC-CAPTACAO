import { neon } from '@neondatabase/serverless';
import { type NextRequest } from 'next/server';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

const DATABASE_URL = process.env.DATABASE_URL!;

// POST /api/intake — Generate a new intake token for a consultoria
export async function POST(request: NextRequest) {
  try {
    const sql = neon(DATABASE_URL);
    const body = await request.json();
    const { consultoriaId } = body;

    if (!consultoriaId) {
      return Response.json({ error: 'consultoriaId required' }, { status: 400 });
    }

    // Look up the consultoria to get municipality_id
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

    // Generate 32-char hex token
    const token = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await sql`
      INSERT INTO fundeb.intake_tokens (token, municipality_id, consultoria_id, created_by, expires_at)
      VALUES (${token}, ${session.municipality_id}, ${consultoriaId}, ${'consultor'}, ${expiresAt.toISOString()})
    `;

    const url = `/intake/${token}`;

    return Response.json({
      token,
      url,
      municipio: session.nome,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}

// GET /api/intake?consultoriaId=X — Fetch intake response for a consultoria
export async function GET(request: NextRequest) {
  try {
    const sql = neon(DATABASE_URL);
    const { searchParams } = new URL(request.url);
    const consultoriaId = searchParams.get('consultoriaId');

    if (!consultoriaId) {
      return Response.json({ error: 'consultoriaId query param required' }, { status: 400 });
    }

    // Find the most recent responded token for this consultoria
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
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}
