import { type NextRequest } from 'next/server';
import { getUser } from '@/lib/session';
import {
  sqlClient,
  ensureOwnershipColumns,
  fetchOwner,
  fetchOwnerWithName,
  auditLeadEvent,
} from '@/lib/lead-ownership';

export const dynamic = 'force-dynamic';

// POST /api/consultorias/[id]/claim
// Atomic claim: UPDATE ... WHERE assigned_consultor_id IS NULL + rowcount check.
// 409 se outro consultor pegou primeiro.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const { id } = await params;
  const consultoriaId = parseInt(id, 10);
  if (!Number.isFinite(consultoriaId)) {
    return Response.json({ error: 'id invalido' }, { status: 400 });
  }

  try {
    const sql = sqlClient();
    await ensureOwnershipColumns(sql);

    const existing = await fetchOwner(sql, consultoriaId);
    if (!existing) {
      return Response.json({ error: 'Consultoria nao encontrada' }, { status: 404 });
    }

    // Atomic claim — só sucede se ainda está no pool
    const updated = await sql.query(
      `UPDATE fundeb.consultorias
          SET assigned_consultor_id = $1,
              assigned_at = NOW(),
              updated_at = NOW()
        WHERE id = $2 AND assigned_consultor_id IS NULL
        RETURNING id, assigned_consultor_id, assigned_at`,
      [user.id, consultoriaId],
    );

    if (updated.length === 0) {
      const current = await fetchOwner(sql, consultoriaId);
      const owner = await fetchOwnerWithName(sql, current?.assignedConsultorId ?? null);
      return Response.json(
        { error: 'CONFLICT', message: 'Lead ja foi assumido por outro consultor', owner },
        { status: 409 },
      );
    }

    await auditLeadEvent(sql, {
      actor: user,
      action: 'consultoria.claim',
      consultoriaId,
      beforeOwnerId: null,
      afterOwnerId: user.id,
    });

    return Response.json({
      ok: true,
      consultoriaId,
      assignedConsultor: { id: user.id, name: user.name, email: user.email },
      assignedAt: updated[0].assigned_at,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
