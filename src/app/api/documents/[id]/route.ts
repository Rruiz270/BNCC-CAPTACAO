import { neon } from '@neondatabase/serverless';
import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const DATABASE_URL = process.env.DATABASE_URL!;

// GET /api/documents/[id]
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const sql = neon(DATABASE_URL);
    const rows = await sql`
      SELECT d.*, m.nome as municipality_nome
      FROM fundeb.documents d
      JOIN fundeb.municipalities m ON m.id = d.municipality_id
      WHERE d.id = ${parseInt(id)}
    `;

    if (rows.length === 0) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const r = rows[0];
    return Response.json({
      id: r.id,
      municipalityId: r.municipality_id,
      municipalityNome: r.municipality_nome,
      tipo: r.tipo,
      titulo: r.titulo,
      conteudo: r.conteudo,
      status: r.status,
      versao: r.versao,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}

// PATCH /api/documents/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const sql = neon(DATABASE_URL);
    const body = await request.json();
    const { conteudo, status, titulo } = body;

    const updates: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let idx = 1;

    if (conteudo !== undefined) {
      updates.push(`conteudo = $${idx}`);
      values.push(conteudo);
      idx++;
    }
    if (status !== undefined) {
      updates.push(`status = $${idx}`);
      values.push(status);
      idx++;
    }
    if (titulo !== undefined) {
      updates.push(`titulo = $${idx}`);
      values.push(titulo);
      idx++;
    }

    values.push(parseInt(id));
    const query = `UPDATE fundeb.documents SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;
    const rows = await sql.query(query, values);

    if (rows.length === 0) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    return Response.json({ document: rows[0] });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}

// DELETE /api/documents/[id]
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const sql = neon(DATABASE_URL);
    await sql`DELETE FROM fundeb.documents WHERE id = ${parseInt(id)}`;
    return Response.json({ ok: true });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}
