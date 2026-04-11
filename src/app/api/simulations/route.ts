import { neon } from '@neondatabase/serverless';
import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const DATABASE_URL = process.env.DATABASE_URL!;

interface ScenarioParams {
  // Matricula override por categoria: { [categoria]: novoQuantidade }
  reclassificacoes: Record<string, number>;
  // Metadata livre do usuario
  notes?: string;
}

interface ScenarioResult {
  // Calculo derivado no cliente, persistido aqui para historico
  receitaBase: number;
  receitaProjetada: number;
  delta: number;
  deltaPct: number;
  categoriasTocadas: string[];
}

// GET /api/simulations?consultoriaId=123
export async function GET(request: NextRequest) {
  try {
    const sql = neon(DATABASE_URL);
    const consultoriaId = request.nextUrl.searchParams.get('consultoriaId');
    if (!consultoriaId) {
      return Response.json({ error: 'consultoriaId required' }, { status: 400 });
    }
    const id = parseInt(consultoriaId, 10);
    if (Number.isNaN(id)) return Response.json({ error: 'invalid id' }, { status: 400 });

    const rows = await sql`
      SELECT id, consultoria_id, nome, is_target, parametros, resultado,
             created_by, created_at, updated_at
      FROM fundeb.scenarios
      WHERE consultoria_id = ${id}
      ORDER BY is_target DESC, created_at DESC
    `;

    return Response.json({
      consultoriaId: id,
      scenarios: rows.map((r: Record<string, unknown>) => ({
        id: r.id,
        consultoriaId: r.consultoria_id,
        nome: r.nome,
        isTarget: r.is_target,
        parametros: r.parametros,
        resultado: r.resultado,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}

// POST /api/simulations
// body: { consultoriaId, nome, parametros, resultado, isTarget? }
export async function POST(request: NextRequest) {
  try {
    const sql = neon(DATABASE_URL);
    const body = (await request.json()) as {
      consultoriaId: number;
      nome: string;
      parametros: ScenarioParams;
      resultado: ScenarioResult;
      isTarget?: boolean;
      createdBy?: string;
    };

    const { consultoriaId, nome, parametros, resultado, isTarget, createdBy } = body;
    if (!consultoriaId || !nome || !parametros) {
      return Response.json(
        { error: 'consultoriaId, nome and parametros required' },
        { status: 400 }
      );
    }

    // Se for marcar como target, limpa o target anterior primeiro
    if (isTarget) {
      await sql`
        UPDATE fundeb.scenarios
           SET is_target = FALSE, updated_at = NOW()
         WHERE consultoria_id = ${consultoriaId} AND is_target = TRUE
      `;
    }

    const inserted = await sql`
      INSERT INTO fundeb.scenarios
        (consultoria_id, nome, is_target, parametros, resultado, created_by)
      VALUES
        (${consultoriaId}, ${nome}, ${isTarget ?? false},
         ${JSON.stringify(parametros)}::jsonb,
         ${JSON.stringify(resultado)}::jsonb,
         ${createdBy ?? 'consultor'})
      RETURNING id, consultoria_id, nome, is_target, parametros, resultado,
                created_by, created_at, updated_at
    `;

    // Audit (best-effort)
    try {
      await sql`
        INSERT INTO audit.event_log
          (actor_id, actor_role, action, entity_type, entity_id, consultoria_id, after_state)
        VALUES
          (${createdBy ?? 'consultor'}, 'consultor', 'scenario.created',
           'scenario', ${inserted[0].id as number}, ${consultoriaId},
           ${JSON.stringify({ nome, isTarget: !!isTarget, resultado })}::jsonb)
      `;
    } catch {
      // ignore: audit.event_log pode nao existir se migrate nao rodou ainda
    }

    const r = inserted[0] as Record<string, unknown>;
    return Response.json({
      scenario: {
        id: r.id,
        consultoriaId: r.consultoria_id,
        nome: r.nome,
        isTarget: r.is_target,
        parametros: r.parametros,
        resultado: r.resultado,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
