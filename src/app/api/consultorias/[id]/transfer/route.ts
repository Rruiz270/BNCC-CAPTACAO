import { type NextRequest } from 'next/server';
import { getUser } from '@/lib/session';
import {
  sqlClient,
  ensureOwnershipColumns,
  fetchOwner,
  canTransferTo,
  auditLeadEvent,
  fetchOwnerWithName,
} from '@/lib/lead-ownership';

export const dynamic = 'force-dynamic';

type TransferBody = {
  toConsultorId?: string;
  reason?: string;
};

// POST /api/consultorias/[id]/transfer
// Body: { toConsultorId, reason? }
// - Owner ou admin/gestor pode iniciar
// - Consultor só transfere para outro consultor ativo
// - Admin/gestor transfere para qualquer usuario ativo (consultor|admin|gestor)
// - Bloqueia self-transfer
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const { id } = await params;
  const consultoriaId = parseInt(id, 10);
  if (!Number.isFinite(consultoriaId)) {
    return Response.json({ error: 'id invalido' }, { status: 400 });
  }

  let body: TransferBody;
  try {
    body = (await req.json()) as TransferBody;
  } catch {
    return Response.json({ error: 'body invalido' }, { status: 400 });
  }

  const toConsultorId = typeof body.toConsultorId === 'string' ? body.toConsultorId.trim() : '';
  if (!toConsultorId) {
    return Response.json({ error: 'toConsultorId obrigatorio' }, { status: 400 });
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim() || null : null;

  try {
    const sql = sqlClient();
    await ensureOwnershipColumns(sql);

    const owner = await fetchOwner(sql, consultoriaId);
    if (!owner) return Response.json({ error: 'Consultoria nao encontrada' }, { status: 404 });

    // Valida destinatario (pega role + isActive + approvalStatus)
    const targetRows = await sql.query(
      `SELECT id, role, is_active, approval_status
       FROM crm.users
       WHERE id = $1
       LIMIT 1`,
      [toConsultorId],
    );
    if (targetRows.length === 0) {
      return Response.json({ error: 'Destinatario nao encontrado' }, { status: 404 });
    }
    const target = {
      id: String(targetRows[0].id),
      role: String(targetRows[0].role ?? 'consultor'),
      isActive: Boolean(targetRows[0].is_active),
      approvalStatus: String(targetRows[0].approval_status ?? 'approved'),
    };

    const decision = canTransferTo(user, owner.assignedConsultorId, target);
    if (!decision.ok) {
      return Response.json(
        { error: 'FORBIDDEN', message: decision.reason },
        { status: 403 },
      );
    }

    const beforeOwnerId = owner.assignedConsultorId;

    await sql.query(
      `UPDATE fundeb.consultorias
          SET assigned_consultor_id = $1,
              assigned_at = NOW(),
              updated_at = NOW()
        WHERE id = $2`,
      [target.id, consultoriaId],
    );

    await auditLeadEvent(sql, {
      actor: user,
      action: 'consultoria.transfer',
      consultoriaId,
      beforeOwnerId,
      afterOwnerId: target.id,
      reason,
    });

    const newOwner = await fetchOwnerWithName(sql, target.id);

    return Response.json({ ok: true, consultoriaId, assignedConsultor: newOwner });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
