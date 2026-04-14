import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

const DATABASE_URL = process.env.DATABASE_URL!;

// GET /api/ref/fatores — all weighting factors
export async function GET() {
  try {
    const sql = neon(DATABASE_URL);
    const rows = await sql`
      SELECT segmento, descricao, fp_vaaf, fp_vaat, f_multi, fp_final_vaaf, fp_final_vaat
      FROM fundeb.ref_fatores_ponderacao
      ORDER BY segmento
    `;

    return Response.json({
      data: rows.map((r) => ({
        segmento: r.segmento,
        descricao: r.descricao,
        fpVaaf: r.fp_vaaf,
        fpVaat: r.fp_vaat,
        fMulti: r.f_multi,
        fpFinalVaaf: r.fp_final_vaaf,
        fpFinalVaat: r.fp_final_vaat,
      })),
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}
