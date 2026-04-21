import { neon } from '@neondatabase/serverless';
import { type NextRequest } from 'next/server';
import { getUser } from '@/lib/session';
import {
  ensureOwnershipColumns,
  fetchOwner,
  fetchOwnerWithName,
  canViewConsultoriaDetail,
} from '@/lib/lead-ownership';

export const dynamic = 'force-dynamic';

const DATABASE_URL = process.env.DATABASE_URL!;

// GET /api/consultorias/[id]
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const consultoriaId = parseInt(id);
  try {
    const user = await getUser();
    if (!user) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const sql = neon(DATABASE_URL);
    await ensureOwnershipColumns(sql);

    const owner = await fetchOwner(sql, consultoriaId);
    if (!owner) return Response.json({ error: 'Not found' }, { status: 404 });

    if (!canViewConsultoriaDetail(user, owner)) {
      const ownerInfo = await fetchOwnerWithName(sql, owner.assignedConsultorId);
      return Response.json(
        { error: 'FORBIDDEN', message: 'Lead esta com outro consultor', owner: ownerInfo },
        { status: 403 },
      );
    }

    const rows = await sql`
      SELECT c.*, m.nome, m.total_matriculas, m.receita_total, m.recursos_receber,
             m.total_escolas, m.escolas_municipais, m.total_docentes,
             m.codigo_ibge, m.pct_internet, m.pct_biblioteca
      FROM fundeb.consultorias c
      JOIN fundeb.municipalities m ON m.id = c.municipality_id
      WHERE c.id = ${consultoriaId}
    `;

    if (rows.length === 0) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const row = rows[0];
    const ownerWithName = await fetchOwnerWithName(sql, owner.assignedConsultorId);
    return Response.json({
      id: row.id,
      municipalityId: row.municipality_id,
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
      notes: row.notes,
      consultantName: row.consultant_name,
      secretaryName: row.secretary_name,
      annotations: row.annotations,
      assignedConsultor: ownerWithName,
      assignedAt: row.assigned_at ?? null,
      municipality: {
        id: row.municipality_id,
        nome: row.nome,
        totalMatriculas: row.total_matriculas,
        receitaTotal: row.recursos_receber ?? row.receita_total,
        totalEscolas: row.escolas_municipais ?? row.total_escolas,
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
    const { status, notes, consultantName, secretaryName, annotations } = body;

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
    if (consultantName !== undefined) {
      updates.push(`consultant_name = $${idx}`);
      values.push(consultantName);
      idx++;
    }
    if (secretaryName !== undefined) {
      updates.push(`secretary_name = $${idx}`);
      values.push(secretaryName);
      idx++;
    }
    if (annotations !== undefined) {
      updates.push(`annotations = $${idx}`);
      values.push(annotations);
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
