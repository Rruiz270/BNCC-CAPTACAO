import { neon } from '@neondatabase/serverless';
import { isAdmin } from './roles';
import type { SessionUser } from './session';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sql = any;

export type ConsultoriaOwnerInfo = {
  consultoriaId: number;
  assignedConsultorId: string | null;
  assignedAt: string | null;
};

export type OwnerWithName = {
  id: string;
  name: string | null;
  email: string | null;
};

export async function ensureOwnershipColumns(sql: Sql): Promise<void> {
  const stmts = [
    `ALTER TABLE fundeb.consultorias ADD COLUMN IF NOT EXISTS assigned_consultor_id TEXT`,
    `ALTER TABLE fundeb.consultorias ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP`,
    `CREATE INDEX IF NOT EXISTS idx_consultorias_assigned
       ON fundeb.consultorias(assigned_consultor_id)`,
  ];
  for (const s of stmts) {
    try { await sql.query(s); } catch { /* idempotent */ }
  }
}

export async function fetchOwner(sql: Sql, consultoriaId: number): Promise<ConsultoriaOwnerInfo | null> {
  const rows = await sql`
    SELECT id, assigned_consultor_id, assigned_at
    FROM fundeb.consultorias
    WHERE id = ${consultoriaId}
  `;
  if (rows.length === 0) return null;
  return {
    consultoriaId: Number(rows[0].id),
    assignedConsultorId: rows[0].assigned_consultor_id ?? null,
    assignedAt: rows[0].assigned_at ?? null,
  };
}

export async function fetchOwnerWithName(sql: Sql, userId: string | null): Promise<OwnerWithName | null> {
  if (!userId) return null;
  const rows = await sql`
    SELECT id, COALESCE(display_name, name) AS name, email
    FROM crm.users
    WHERE id = ${userId}
    LIMIT 1
  `;
  if (rows.length === 0) return { id: userId, name: null, email: null };
  return { id: String(rows[0].id), name: rows[0].name ?? null, email: rows[0].email ?? null };
}

export function canViewConsultoriaDetail(
  user: SessionUser,
  owner: ConsultoriaOwnerInfo | null,
): boolean {
  if (isAdmin(user.role)) return true;
  if (!owner) return false;
  if (!owner.assignedConsultorId) return false; // pool — consultor não vê detalhe
  return owner.assignedConsultorId === user.id;
}

export function canModifyConsultoria(
  user: SessionUser,
  owner: ConsultoriaOwnerInfo,
): boolean {
  if (isAdmin(user.role)) return true;
  return owner.assignedConsultorId === user.id;
}

// Regra de transferência:
// - Consultor (owner) → qualquer consultor ativo (não admin/gestor)
// - Admin/gestor → qualquer usuário ativo (consultor, admin, gestor)
// - Bloqueia self-transfer (A → A)
export function canTransferTo(
  actor: SessionUser,
  currentOwnerId: string | null,
  targetUser: { id: string; role: string; isActive: boolean; approvalStatus: string },
): { ok: true } | { ok: false; reason: string } {
  if (!targetUser.isActive) return { ok: false, reason: 'Destinatario inativo' };
  if (targetUser.approvalStatus !== 'approved') return { ok: false, reason: 'Destinatario nao aprovado' };
  if (currentOwnerId && currentOwnerId === targetUser.id) {
    return { ok: false, reason: 'Lead ja esta com esse consultor' };
  }
  if (isAdmin(actor.role)) return { ok: true };
  // Consultor só transfere se for o dono atual
  if (!currentOwnerId || currentOwnerId !== actor.id) {
    return { ok: false, reason: 'Apenas o responsavel atual ou admin pode transferir' };
  }
  // Consultor → consultor (não escala)
  if (targetUser.role !== 'consultor') {
    return { ok: false, reason: 'Consultor so pode transferir para outro consultor' };
  }
  return { ok: true };
}

export type LeadEventAction =
  | 'consultoria.claim'
  | 'consultoria.release'
  | 'consultoria.transfer';

export async function auditLeadEvent(
  sql: Sql,
  params: {
    actor: SessionUser;
    action: LeadEventAction;
    consultoriaId: number;
    beforeOwnerId: string | null;
    afterOwnerId: string | null;
    reason?: string | null;
  },
): Promise<void> {
  const { actor, action, consultoriaId, beforeOwnerId, afterOwnerId, reason } = params;
  try {
    await sql.query(
      `INSERT INTO audit.event_log
         (actor_id, actor_role, action, entity_type, entity_id,
          consultoria_id, before_state, after_state)
       VALUES ($1, $2, $3, 'consultoria', $4, $5, $6::jsonb, $7::jsonb)`,
      [
        actor.id,
        actor.role,
        action,
        consultoriaId,
        consultoriaId,
        JSON.stringify({ assigned_consultor_id: beforeOwnerId }),
        JSON.stringify({
          assigned_consultor_id: afterOwnerId,
          ...(reason ? { reason } : {}),
        }),
      ],
    );
  } catch {
    // best-effort — não quebra fluxo
  }
}

export function sqlClient(): Sql {
  const DATABASE_URL = process.env.DATABASE_URL!;
  return neon(DATABASE_URL);
}
