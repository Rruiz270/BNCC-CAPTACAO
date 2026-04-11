import { neon } from '@neondatabase/serverless';
import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const DATABASE_URL = process.env.DATABASE_URL!;

// GET /api/consultorias/[id]
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const sql = neon(DATABASE_URL);
    const rows = await sql`
      SELECT c.*, m.nome, m.total_matriculas, m.receita_total, m.total_escolas, m.total_docentes,
             m.codigo_ibge, m.pct_internet, m.pct_biblioteca
      FROM fundeb.consultorias c
      JOIN fundeb.municipalities m ON m.id = c.municipality_id
      WHERE c.id = ${parseInt(id)}
    `;

    if (rows.length === 0) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const row = rows[0];
    return Response.json({
      id: row.id,
      municipalityId: row.municipality_id,
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
      notes: row.notes,
      municipality: {
        id: row.municipality_id,
        nome: row.nome,
        totalMatriculas: row.total_matriculas,
        receitaTotal: row.receita_total,
        totalEscolas: row.total_escolas,
        totalDocentes: row.total_docentes,
        codigoIbge: row.codigo_ibge,
        pctInternet: row.pct_internet,
        pctBiblioteca: row.pct_biblioteca,
      },
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}

// PATCH /api/consultorias/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const sql = neon(DATABASE_URL);
    const body = await request.json();
    const { status, notes } = body;

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (status) {
      updates.push(`status = $${idx}`);
      values.push(status);
      idx++;
      if (status === 'completed') {
        updates.push(`end_date = NOW()`);
      }
    }
    if (notes !== undefined) {
      updates.push(`notes = $${idx}`);
      values.push(notes);
      idx++;
    }

    updates.push('updated_at = NOW()');

    if (updates.length === 0) {
      return Response.json({ error: 'No updates' }, { status: 400 });
    }

    values.push(parseInt(id));
    const query = `UPDATE fundeb.consultorias SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;
    const rows = await sql.query(query, values);

    if (rows.length === 0) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    return Response.json({ session: rows[0] });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}

// DELETE /api/consultorias/[id]
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const sql = neon(DATABASE_URL);
    await sql`DELETE FROM fundeb.consultorias WHERE id = ${parseInt(id)}`;
    return Response.json({ ok: true });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}
