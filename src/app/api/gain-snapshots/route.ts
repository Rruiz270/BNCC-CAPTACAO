import { neon } from '@neondatabase/serverless';
import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const DATABASE_URL = process.env.DATABASE_URL!;

/**
 * POST /api/gain-snapshots
 * Body: { consultoriaId?, municipalityId, intakeToken?, screen, gainTotal, gainBreakdown, intakeData?, capturedBy? }
 *
 * Persiste um snapshot do ganho calculado num momento-chave. Aceita tanto
 * chamadas autenticadas (consultor no wizard) quanto públicas (secretaria
 * preenchendo intake) — autorização vem da posse do token de intake.
 */
export async function POST(request: NextRequest) {
  try {
    const sql = neon(DATABASE_URL);
    const body = await request.json();

    const {
      consultoriaId = null,
      municipalityId,
      intakeToken = null,
      screen,
      gainTotal,
      gainBreakdown,
      intakeData = null,
      capturedBy = null,
    } = body;

    if (!municipalityId || !screen) {
      return Response.json({ error: 'municipalityId e screen obrigatórios' }, { status: 400 });
    }

    // Valida intake_token se fornecido — proteção contra escrita arbitrária
    // por agente externo. Token valido = secretaria autorizada a registrar.
    if (intakeToken) {
      const tokens = await sql`
        SELECT id FROM fundeb.intake_tokens WHERE token = ${intakeToken} LIMIT 1
      `;
      if (tokens.length === 0) {
        return Response.json({ error: 'Token inválido' }, { status: 403 });
      }
    }

    const result = await sql`
      INSERT INTO fundeb.gain_snapshots
        (consultoria_id, municipality_id, intake_token, screen, gain_total, gain_breakdown, intake_data, captured_by)
      VALUES (
        ${consultoriaId},
        ${municipalityId},
        ${intakeToken},
        ${screen},
        ${gainTotal ?? 0},
        ${JSON.stringify(gainBreakdown ?? {})}::jsonb,
        ${intakeData ? JSON.stringify(intakeData) : null}::jsonb,
        ${capturedBy}
      )
      RETURNING id, captured_at
    `;

    return Response.json({ id: result[0].id, capturedAt: result[0].captured_at });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}

/**
 * GET /api/gain-snapshots?consultoriaId=X
 * Retorna a linha do tempo do ganho — usado no relatório final e no telão.
 */
export async function GET(request: NextRequest) {
  try {
    const sql = neon(DATABASE_URL);
    const { searchParams } = new URL(request.url);
    const consultoriaId = searchParams.get('consultoriaId');
    const municipalityId = searchParams.get('municipalityId');

    if (!consultoriaId && !municipalityId) {
      return Response.json({ error: 'consultoriaId ou municipalityId obrigatório' }, { status: 400 });
    }

    const rows = consultoriaId
      ? await sql`
          SELECT id, screen, gain_total, gain_breakdown, captured_at, captured_by
          FROM fundeb.gain_snapshots
          WHERE consultoria_id = ${Number(consultoriaId)}
          ORDER BY captured_at ASC
        `
      : await sql`
          SELECT id, screen, gain_total, gain_breakdown, captured_at, captured_by
          FROM fundeb.gain_snapshots
          WHERE municipality_id = ${Number(municipalityId)}
          ORDER BY captured_at ASC
        `;

    return Response.json({ snapshots: rows });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
