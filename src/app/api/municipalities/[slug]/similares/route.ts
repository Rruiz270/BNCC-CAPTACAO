/**
 * Benchmark de municípios similares: mesmo estado e porte de rede
 * (0,5×–2× das matrículas), ordenados por proximidade de tamanho.
 *
 * GET /api/municipalities/[slug]/similares
 *   → { referencia, similares[], insights { recebemVaar, pctIntegralMedio, potencialMedio } }
 */
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const rows = /^\d{7}$/.test(slug)
    ? await sql`SELECT id, nome, uf, total_matriculas FROM fundeb.municipalities WHERE codigo_ibge = ${slug}`
    : await sql`SELECT id, nome, uf, total_matriculas FROM fundeb.municipalities WHERE id = ${parseInt(slug) || 0}`;
  const ref = rows[0];
  if (!ref) return Response.json({ error: 'Município não encontrado' }, { status: 404 });

  const mat = Number(ref.total_matriculas) || 0;
  if (!mat || !ref.uf) {
    return Response.json({ referencia: ref, similares: [], insights: null });
  }

  const similares = await sql`
    SELECT id, nome, uf, total_matriculas, receita_total, pot_total, pct_pot_total,
           vaar, recebe_vaar, ideb_ai, t6_pct_integral
    FROM fundeb.municipalities
    WHERE uf = ${ref.uf}
      AND id <> ${ref.id}
      AND total_matriculas BETWEEN ${Math.round(mat * 0.5)} AND ${Math.round(mat * 2)}
    ORDER BY ABS(total_matriculas - ${mat})
    LIMIT 8`;

  const comVaar = similares.filter((s) => s.recebe_vaar || Number(s.vaar) > 0);
  const media = (arr: unknown[], key: string) => {
    const vals = arr.map((x) => Number((x as Record<string, unknown>)[key])).filter((v) => Number.isFinite(v) && v > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  return Response.json({
    referencia: { id: ref.id, nome: ref.nome, uf: ref.uf, totalMatriculas: mat },
    similares,
    insights: {
      total: similares.length,
      recebemVaar: comVaar.length,
      pctIntegralMedio: media(similares, 't6_pct_integral'),
      potencialMedio: media(similares, 'pot_total'),
      idebMedio: media(similares, 'ideb_ai'),
    },
  });
}
