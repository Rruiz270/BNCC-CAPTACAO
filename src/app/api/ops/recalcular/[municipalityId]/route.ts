import { neon } from '@neondatabase/serverless';
import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const DATABASE_URL = process.env.DATABASE_URL!;

// POST /api/ops/recalcular/[municipalityId]
// Dispara fundeb.sp_recalcular_potencial para o municipio.
// Retorna o snapshot atualizado das colunas de potencial.
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ municipalityId: string }> }
) {
  try {
    if (!DATABASE_URL) {
      return Response.json({ error: 'DATABASE_URL nao configurado' }, { status: 500 });
    }
    const { municipalityId } = await ctx.params;
    const id = parseInt(municipalityId, 10);
    if (Number.isNaN(id)) {
      return Response.json({ error: 'municipalityId invalido' }, { status: 400 });
    }

    const sql = neon(DATABASE_URL);
    await sql.query(`CALL fundeb.sp_recalcular_potencial($1)`, [id]);

    const rows = await sql.query(
      `SELECT id, nome, pot_total, pct_pot_total, n_faltantes, updated_at
         FROM fundeb.municipalities WHERE id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return Response.json({ error: 'municipio nao encontrado' }, { status: 404 });
    }

    return Response.json({ ok: true, municipality: rows[0] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
