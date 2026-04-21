import { type NextRequest } from 'next/server';
import { getUser } from '@/lib/session';
import {
  sqlClient,
  ensureOwnershipColumns,
  fetchOwner,
  canModifyConsultoria,
  auditLeadEvent,
} from '@/lib/lead-ownership';

export const dynamic = 'force-dynamic';

// POST /api/consultorias/[id]/release
// Devolve o lead para o pool. Apenas dono atual ou admin/gestor.
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

    const owner = await fetchOwner(sql, consultoriaId);
    if (!owner) return Response.json({ error: 'Consultoria nao encontrada' }, { status: 404 });

    if (!owner.assignedConsultorId) {
      return Response.json({ error: 'Lead ja esta no pool' }, { status: 400 });
    }

    if (!canModifyConsultoria(user, owner)) {
      return Response.json(
        { error: 'FORBIDDEN', message: 'Apenas o responsavel ou admin pode soltar este lead' },
        { status: 403 },
      );
    }

    const beforeOwnerId = owner.assignedConsultorId;

    await sql.query(
      `UPDATE fundeb.consultorias
          SET assigned_consultor_id = NULL,
              assigned_at = NULL,
              updated_at = NOW()
        WHERE id = $1`,
      [consultoriaId],
    );

    await auditLeadEvent(sql, {
      actor: user,
      action: 'consultoria.release',
      consultoriaId,
      beforeOwnerId,
      afterOwnerId: null,
    });

    return Response.json({ ok: true, consultoriaId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
