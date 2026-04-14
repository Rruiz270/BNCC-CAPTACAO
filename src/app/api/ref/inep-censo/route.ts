import { neon } from '@neondatabase/serverless';
import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const DATABASE_URL = process.env.DATABASE_URL!;

// GET /api/ref/inep-censo?municipalityId=X
export async function GET(request: NextRequest) {
  const muniId = request.nextUrl.searchParams.get('municipalityId');
  if (!muniId) {
    return Response.json({ error: 'municipalityId required' }, { status: 400 });
  }

  try {
    const sql = neon(DATABASE_URL);
    const rows = await sql`
      SELECT * FROM fundeb.ref_inep_censo
      WHERE municipality_id = ${parseInt(muniId)}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return Response.json({ data: null });
    }

    const r = rows[0];
    return Response.json({
      data: {
        codigoIbge: r.codigo_ibge,
        municipio: r.municipio,
        matTotal: r.mat_total,
        matEiTotal: r.mat_ei_total,
        matCreche: r.mat_creche,
        matPreEscola: r.mat_pre_escola,
        matEfTotal: r.mat_ef_total,
        matEfAi: r.mat_ef_ai,
        matEfAf: r.mat_ef_af,
        matEmTotal: r.mat_em_total,
        matEjaTotal: r.mat_eja_total,
        matEjaFund: r.mat_eja_fund,
        matEjaMedio: r.mat_eja_medio,
        matEspecialTotal: r.mat_especial_total,
        matEspecialComum: r.mat_especial_comum,
        matEspecialExclusiva: r.mat_especial_exclusiva,
        matProfTotal: r.mat_prof_total,
      },
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}
