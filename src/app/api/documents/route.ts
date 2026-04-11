import { neon } from '@neondatabase/serverless';
import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const DATABASE_URL = process.env.DATABASE_URL!;

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

// POST /api/documents — create document
// body pode ser:
//   { generate: true, consultoriaId, tipo }  -> chama fundeb.sp_gerar_minuta
//   { municipalityId, tipo, titulo, conteudo }  -> insert manual
export async function POST(request: NextRequest) {
  try {
    const sql = neon(DATABASE_URL);
    const body = await request.json();
    const { generate, consultoriaId, municipalityId, tipo, titulo, conteudo } = body as {
      generate?: boolean;
      consultoriaId?: number;
      municipalityId?: number;
      tipo: string;
      titulo?: string;
      conteudo?: string;
    };

    // Caminho 1: gerar via stored procedure
    if (generate === true) {
      if (!consultoriaId || !tipo) {
        return Response.json(
          { error: 'consultoriaId and tipo required when generate=true' },
          { status: 400 }
        );
      }
      try {
        const rows = await sql`SELECT fundeb.sp_gerar_minuta(${consultoriaId}, ${tipo}) AS doc_id`;
        const docId = rows[0]?.doc_id as number | undefined;
        if (!docId) {
          return Response.json({ error: 'sp_gerar_minuta nao retornou doc_id' }, { status: 500 });
        }
        const doc = await sql`
          SELECT id, municipality_id, tipo, titulo, conteudo, status, versao, created_at, updated_at
          FROM fundeb.documents WHERE id = ${docId}
        `;
        return Response.json({
          document: doc[0],
          generated: true,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return Response.json({ error: `sp_gerar_minuta falhou: ${msg}` }, { status: 500 });
      }
    }

    // Caminho 2: insert manual
    if (!municipalityId || !tipo || !conteudo) {
      return Response.json(
        { error: 'municipalityId, tipo, and conteudo required' },
        { status: 400 }
      );
    }

    const existing = await sql`
      SELECT id, versao FROM fundeb.documents
      WHERE municipality_id = ${municipalityId} AND tipo = ${tipo}
      ORDER BY versao DESC LIMIT 1
    `;
    const nextVersion =
      existing.length > 0 ? (parseInt(existing[0].versao as string) || 1) + 1 : 1;

    const result = await sql`
      INSERT INTO fundeb.documents (municipality_id, tipo, titulo, conteudo, status, versao)
      VALUES (${municipalityId}, ${tipo}, ${titulo || 'Documento'}, ${conteudo}, 'rascunho', ${nextVersion})
      RETURNING id, municipality_id, tipo, titulo, status, versao, created_at
    `;

    // Audit (best-effort)
    try {
      await sql`
        INSERT INTO audit.event_log
          (actor_id, actor_role, action, entity_type, entity_id, consultoria_id, after_state)
        VALUES
          ('consultor', 'consultor', 'document.created.manual',
           'document', ${result[0].id},
           ${consultoriaId ?? null},
           ${JSON.stringify({ tipo, titulo, versao: nextVersion })}::jsonb)
      `;
    } catch {
      // ignore
    }

    return Response.json({ document: result[0] });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}
