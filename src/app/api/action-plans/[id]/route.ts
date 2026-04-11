import { neon } from '@neondatabase/serverless';
import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const DATABASE_URL = process.env.DATABASE_URL!;

// PATCH /api/action-plans/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const sql = neon(DATABASE_URL);
    const body = await request.json();
    const { status, notes, responsavel } = body;

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (status !== undefined) {
      updates.push(`status = $${idx}`);
      values.push(status);
      idx++;
      if (status === 'done') {
        updates.push(`completed_at = NOW()`);
      } else {
        updates.push(`completed_at = NULL`);
      }
    }
    if (notes !== undefined) {
      updates.push(`notes = $${idx}`);
      values.push(notes);
      idx++;
    }
    if (responsavel !== undefined) {
      updates.push(`responsavel = $${idx}`);
      values.push(responsavel);
      idx++;
    }

    if (updates.length === 0) {
      return Response.json({ error: 'No updates' }, { status: 400 });
    }

    values.push(parseInt(id));
    const query = `UPDATE fundeb.action_plans SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;
    const rows = await sql.query(query, values);

    if (rows.length === 0) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    return Response.json({ task: rows[0] });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}
