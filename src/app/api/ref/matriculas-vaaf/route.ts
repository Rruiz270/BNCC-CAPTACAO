import { neon } from '@neondatabase/serverless';
import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const DATABASE_URL = process.env.DATABASE_URL!;

// GET /api/ref/matriculas-vaaf?municipalityId=X
export async function GET(request: NextRequest) {
  const muniId = request.nextUrl.searchParams.get('municipalityId');
  if (!muniId) {
    return Response.json({ error: 'municipalityId required' }, { status: 400 });
  }

  try {
    const sql = neon(DATABASE_URL);
    const rows = await sql`
      SELECT secao, categoria, localidade, matriculas, vaaf_valor, subtotal
      FROM fundeb.ref_matriculas_vaaf
      WHERE municipality_id = ${parseInt(muniId)}
      ORDER BY secao, categoria, localidade
    `;

    return Response.json({
      data: rows.map((r) => ({
        secao: r.secao,
        categoria: r.categoria,
        localidade: r.localidade,
        matriculas: r.matriculas,
        vaafValor: r.vaaf_valor,
        subtotal: r.subtotal,
      })),
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}
