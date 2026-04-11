import { neon } from '@neondatabase/serverless';
import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const DATABASE_URL = process.env.DATABASE_URL!;

// PATCH /api/simulations/[id]
// body: { isTarget?, nome?, parametros?, resultado? }
export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await ctx.params;
    const id = parseInt(idStr, 10);
    if (Number.isNaN(id)) return Response.json({ error: 'invalid id' }, { status: 400 });

    const body = (await request.json()) as {
      isTarget?: boolean;
      nome?: string;
      parametros?: Record<string, unknown>;
      resultado?: Record<string, unknown>;
    };

    const sql = neon(DATABASE_URL);

    // Se marca como target, limpa o target existente da mesma consultoria
    if (body.isTarget === true) {
      const [row] = await sql`
        SELECT consultoria_id FROM fundeb.scenarios WHERE id = ${id}
      `;
      if (!row) return Response.json({ error: 'scenario not found' }, { status: 404 });
      await sql`
        UPDATE fundeb.scenarios
           SET is_target = FALSE, updated_at = NOW()
         WHERE consultoria_id = ${row.consultoria_id} AND is_target = TRUE AND id <> ${id}
      `;
    }

    const updated = await sql`
      UPDATE fundeb.scenarios
         SET is_target  = COALESCE(${body.isTarget ?? null}, is_target),
             nome       = COALESCE(${body.nome ?? null}, nome),
             parametros = COALESCE(${body.parametros ? JSON.stringify(body.parametros) : null}::jsonb, parametros),
             resultado  = COALESCE(${body.resultado ? JSON.stringify(body.resultado) : null}::jsonb, resultado),
             updated_at = NOW()
       WHERE id = ${id}
       RETURNING id, consultoria_id, nome, is_target, parametros, resultado,
                 created_by, created_at, updated_at
    `;

    if (updated.length === 0) {
      return Response.json({ error: 'scenario not found' }, { status: 404 });
    }

    // Audit (best-effort)
    try {
      await sql`
        INSERT INTO audit.event_log
          (actor_id, actor_role, action, entity_type, entity_id, consultoria_id, after_state)
        VALUES
          ('consultor', 'consultor', 'scenario.updated',
           'scenario', ${id}, ${updated[0].consultoria_id},
           ${JSON.stringify(body)}::jsonb)
      `;
    } catch {
      // ignore
    }

    const r = updated[0] as Record<string, unknown>;
    return Response.json({
      scenario: {
        id: r.id,
        consultoriaId: r.consultoria_id,
        nome: r.nome,
        isTarget: r.is_target,
        parametros: r.parametros,
        resultado: r.resultado,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/simulations/[id]
export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await ctx.params;
    const id = parseInt(idStr, 10);
    if (Number.isNaN(id)) return Response.json({ error: 'invalid id' }, { status: 400 });

    const sql = neon(DATABASE_URL);

    const [existing] = await sql`
      SELECT consultoria_id FROM fundeb.scenarios WHERE id = ${id}
    `;
    if (!existing) return Response.json({ error: 'not found' }, { status: 404 });

    await sql`DELETE FROM fundeb.scenarios WHERE id = ${id}`;

    try {
      await sql`
        INSERT INTO audit.event_log
          (actor_id, actor_role, action, entity_type, entity_id, consultoria_id)
        VALUES
          ('consultor', 'consultor', 'scenario.deleted',
           'scenario', ${id}, ${existing.consultoria_id})
      `;
    } catch {
      // ignore
    }

    return Response.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
