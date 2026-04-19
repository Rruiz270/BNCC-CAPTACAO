import { neon } from '@neondatabase/serverless';
import { requireAdminApi } from '@/lib/guard';
import { type NextRequest } from 'next/server';
import potTotals from '@/data/pot-totals.json';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const DATABASE_URL = process.env.DATABASE_URL!;

// pot-totals.json: { "Novo Horizonte": [16418813.57, 42.19, 5], ... }
// Each value is [pot_total_novo, pct_pot_total, n_faltantes] from data.json
const potLookup = potTotals as unknown as Record<string, [number, number, number]>;

// POST /api/ops/recalcular/[municipalityId]
// Recalculates potencial for the municipality.
// Uses the real T1-T6 pot_total from data.json (embedded in pot-totals.json)
// and refreshes cats/n_faltantes from current enrollments.
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

    // 1. Get municipality name and current state
    const muniRows = await sql`
      SELECT id, nome, receita_total FROM fundeb.municipalities WHERE id = ${id}
    `;
    if (muniRows.length === 0) {
      return Response.json({ error: 'municipio nao encontrado' }, { status: 404 });
    }
    const muni = muniRows[0];
    const nome = muni.nome as string;

    // 2. Get enrollments to compute n_faltantes and cats
    const enrollments = await sql`
      SELECT categoria, categoria_label, fator_vaaf, quantidade, ativa
      FROM fundeb.enrollments
      WHERE municipality_id = ${id}
    `;

    let nFaltantes = 0;
    const cats: Array<{ categoria: string; quantidade: number; ativa: boolean }> = [];
    for (const e of enrollments) {
      const ativa = e.ativa as boolean;
      const qtd = (e.quantidade as number) ?? 0;
      if (!ativa || qtd === 0) nFaltantes++;
      cats.push({
        categoria: e.categoria as string,
        quantidade: qtd,
        ativa: ativa ?? false,
      });
    }

    // 3. Get real pot_total from embedded lookup (source of truth from data.json)
    const lookup = potLookup[nome];
    let potTotal: number;
    let pctPotTotal: number;

    if (lookup) {
      // Use the real T1-T6 pot_total_novo from data.json
      potTotal = lookup[0];
      pctPotTotal = lookup[1];
      // Use lookup n_faltantes if enrollments haven't changed
      // But prefer live enrollment count since it may have been updated
    } else {
      // Fallback: simplified calculation (10 students per missing category)
      potTotal = 0;
      for (const e of enrollments) {
        const ativa = e.ativa as boolean;
        const qtd = (e.quantidade as number) ?? 0;
        if (!ativa || qtd === 0) {
          potTotal += ((e.fator_vaaf as number) ?? 0) * 10;
        }
      }
      const receita = (muni.receita_total as number) ?? 0;
      pctPotTotal = receita > 0 ? Math.round((potTotal / receita) * 10000) / 100 : 0;
    }

    // 4. Update municipality
    await sql`
      UPDATE fundeb.municipalities
      SET pot_total = ${potTotal},
          pct_pot_total = ${pctPotTotal},
          n_faltantes = ${nFaltantes},
          cats = ${JSON.stringify(cats)}::jsonb,
          updated_at = NOW()
      WHERE id = ${id}
    `;

    // 5. Audit log
    try {
      await sql`
        INSERT INTO audit.event_log (actor_id, actor_role, action, entity_type, entity_id, after_state)
        VALUES ('system', 'sistema', 'recalculo.potencial', 'municipality', ${String(id)},
                ${JSON.stringify({ pot_total: potTotal, n_faltantes: nFaltantes, source: lookup ? 'data.json' : 'simplified' })}::jsonb)
      `;
    } catch {
      // audit table may not exist
    }

    return Response.json({
      ok: true,
      municipality: {
        id,
        nome,
        pot_total: potTotal,
        pct_pot_total: pctPotTotal,
        n_faltantes: nFaltantes,
        updated_at: new Date().toISOString(),
      },
      source: lookup ? 'data.json (T1-T6)' : 'simplified',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
