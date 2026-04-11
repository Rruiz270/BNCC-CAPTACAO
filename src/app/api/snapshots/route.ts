import { neon } from '@neondatabase/serverless';
import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const DATABASE_URL = process.env.DATABASE_URL!;

// GET /api/snapshots?consultoriaId=123
export async function GET(request: NextRequest) {
  try {
    const sql = neon(DATABASE_URL);
    const consultoriaIdRaw = request.nextUrl.searchParams.get('consultoriaId');
    if (!consultoriaIdRaw) {
      return Response.json({ error: 'consultoriaId required' }, { status: 400 });
    }
    const consultoriaId = parseInt(consultoriaIdRaw, 10);
    if (Number.isNaN(consultoriaId)) {
      return Response.json({ error: 'invalid consultoriaId' }, { status: 400 });
    }

    const rows = await sql`
      SELECT id, consultoria_id, hash, signed_by, reason, created_at
      FROM audit.snapshots
      WHERE consultoria_id = ${consultoriaId}
      ORDER BY created_at DESC
    `;

    return Response.json({
      snapshots: rows.map((r: Record<string, unknown>) => ({
        id: r.id,
        consultoriaId: r.consultoria_id,
        hash: r.hash,
        signedBy: r.signed_by,
        reason: r.reason,
        createdAt: r.created_at,
      })),
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}

// POST /api/snapshots — gera snapshot via audit.sp_snapshot_sessao
// body: { consultoriaId, signedBy, reason? }
export async function POST(request: NextRequest) {
  try {
    const sql = neon(DATABASE_URL);
    const body = await request.json();
    const { consultoriaId, signedBy, reason } = body as {
      consultoriaId?: number;
      signedBy?: string;
      reason?: string;
    };

    if (!consultoriaId || !signedBy) {
      return Response.json(
        { error: 'consultoriaId and signedBy required' },
        { status: 400 }
      );
    }

    try {
      const callRows = await sql`
        SELECT audit.sp_snapshot_sessao(
          ${consultoriaId},
          ${signedBy},
          ${reason ?? 'closing'}
        ) AS snapshot_id
      `;
      const snapshotId = callRows[0]?.snapshot_id as number | undefined;
      if (!snapshotId) {
        return Response.json(
          { error: 'sp_snapshot_sessao nao retornou snapshot_id' },
          { status: 500 }
        );
      }

      const snapRows = await sql`
        SELECT id, consultoria_id, hash, signed_by, reason, created_at
        FROM audit.snapshots
        WHERE id = ${snapshotId}
      `;
      const snap = snapRows[0];
      return Response.json({
        snapshot: {
          id: snap.id,
          consultoriaId: snap.consultoria_id,
          hash: snap.hash,
          signedBy: snap.signed_by,
          reason: snap.reason,
          createdAt: snap.created_at,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return Response.json(
        { error: `sp_snapshot_sessao falhou: ${msg}` },
        { status: 500 }
      );
    }
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}
