import { neon } from '@neondatabase/serverless';
import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const DATABASE_URL = process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_Zu1zG2LPUovb@ep-snowy-shadow-a4hoyxtl-pooler.us-east-1.aws.neon.tech/bncc_webinar?sslmode=require";

// GET /api/documents?municipalityId=123&tipo=minuta_cme
export async function GET(request: NextRequest) {
  try {
    const sql = neon(DATABASE_URL);
    const municipalityId = request.nextUrl.searchParams.get('municipalityId');
    const tipo = request.nextUrl.searchParams.get('tipo');

    if (!municipalityId) {
      return Response.json({ error: 'municipalityId required' }, { status: 400 });
    }

    let rows;
    if (tipo) {
      rows = await sql`
        SELECT id, municipality_id, tipo, titulo, conteudo, status, versao, created_at, updated_at
        FROM fundeb.documents
        WHERE municipality_id = ${parseInt(municipalityId)} AND tipo = ${tipo}
        ORDER BY versao DESC
        LIMIT 1
      `;
    } else {
      rows = await sql`
        SELECT id, municipality_id, tipo, titulo, status, versao, created_at, updated_at
        FROM fundeb.documents
        WHERE municipality_id = ${parseInt(municipalityId)}
        ORDER BY created_at DESC
      `;
    }

    return Response.json({
      documents: rows.map((r: Record<string, unknown>) => ({
        id: r.id,
        municipalityId: r.municipality_id,
        tipo: r.tipo,
        titulo: r.titulo,
        conteudo: r.conteudo,
        status: r.status,
        versao: r.versao,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}

// POST /api/documents — create/generate document
export async function POST(request: NextRequest) {
  try {
    const sql = neon(DATABASE_URL);
    const body = await request.json();
    const { municipalityId, tipo, titulo, conteudo } = body;

    if (!municipalityId || !tipo || !conteudo) {
      return Response.json({ error: 'municipalityId, tipo, and conteudo required' }, { status: 400 });
    }

    // Check if document of this type already exists
    const existing = await sql`
      SELECT id, versao FROM fundeb.documents
      WHERE municipality_id = ${municipalityId} AND tipo = ${tipo}
      ORDER BY versao DESC LIMIT 1
    `;

    const nextVersion = existing.length > 0 ? (parseInt(existing[0].versao as string) || 1) + 1 : 1;

    const result = await sql`
      INSERT INTO fundeb.documents (municipality_id, tipo, titulo, conteudo, status, versao)
      VALUES (${municipalityId}, ${tipo}, ${titulo || 'Documento'}, ${conteudo}, 'rascunho', ${nextVersion})
      RETURNING id, municipality_id, tipo, titulo, status, versao, created_at
    `;

    return Response.json({ document: result[0] });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}
