import { neon } from '@neondatabase/serverless';
import { type NextRequest } from 'next/server';
import { WIZARD_STEPS } from '@/lib/wizard/steps';

export const dynamic = 'force-dynamic';

const DATABASE_URL = process.env.DATABASE_URL!;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureTables(sql: any) {
  await sql`
    CREATE TABLE IF NOT EXISTS fundeb.wizard_progress (
      id SERIAL PRIMARY KEY,
      consultoria_id INTEGER NOT NULL REFERENCES fundeb.consultorias(id) ON DELETE CASCADE,
      step INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      payload JSONB DEFAULT '{}'::jsonb,
      block_reason TEXT,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_wizard_progress_step
    ON fundeb.wizard_progress(consultoria_id, step)
  `;
  // audit.event_log (best-effort, idempotente)
  try {
    await sql`CREATE SCHEMA IF NOT EXISTS audit`;
    await sql`
      CREATE TABLE IF NOT EXISTS audit.event_log (
        id BIGSERIAL PRIMARY KEY,
        ts TIMESTAMP NOT NULL DEFAULT NOW(),
        actor_id TEXT NOT NULL,
        actor_role TEXT,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id BIGINT,
        consultoria_id INTEGER,
        before_state JSONB,
        after_state JSONB,
        context JSONB DEFAULT '{}'::jsonb,
        request_id TEXT
      )
    `;
  } catch {
    // ignore
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function seedSteps(sql: any, consultoriaId: number) {
  for (const step of WIZARD_STEPS) {
    await sql`
      INSERT INTO fundeb.wizard_progress (consultoria_id, step, status)
      VALUES (${consultoriaId}, ${step.id}, ${step.id === 0 ? 'completed' : step.id === 1 ? 'in_progress' : 'available'})
      ON CONFLICT (consultoria_id, step) DO NOTHING
    `;
  }
}

// GET /api/wizard/[consultoriaId] - retorna o estado de cada step
export async function GET(_req: NextRequest, ctx: { params: Promise<{ consultoriaId: string }> }) {
  try {
    const { consultoriaId } = await ctx.params;
    const id = parseInt(consultoriaId, 10);
    if (Number.isNaN(id)) return Response.json({ error: 'invalid id' }, { status: 400 });

    const sql = neon(DATABASE_URL);
    await ensureTables(sql);
    await seedSteps(sql, id);

    const rows = await sql`
      SELECT step, status, payload, block_reason, started_at, completed_at, updated_at
      FROM fundeb.wizard_progress
      WHERE consultoria_id = ${id}
      ORDER BY step ASC
    `;

    return Response.json({ consultoriaId: id, steps: rows });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/wizard/[consultoriaId] - atualiza um step
// body: { step: number, status?: StepStatus, payload?: object, blockReason?: string }
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ consultoriaId: string }> }) {
  try {
    const { consultoriaId } = await ctx.params;
    const id = parseInt(consultoriaId, 10);
    if (Number.isNaN(id)) return Response.json({ error: 'invalid id' }, { status: 400 });

    const body = await req.json();
    const { step, status, payload, blockReason } = body as {
      step: number;
      status?: string;
      payload?: Record<string, unknown>;
      blockReason?: string;
    };
    if (typeof step !== 'number') return Response.json({ error: 'step required' }, { status: 400 });

    const sql = neon(DATABASE_URL);
    await ensureTables(sql);
    await seedSteps(sql, id);

    // Captura before
    const beforeRows = await sql`
      SELECT status, payload FROM fundeb.wizard_progress
      WHERE consultoria_id = ${id} AND step = ${step}
    `;
    const before = beforeRows[0] ?? null;

    const completedAt = status === 'completed' ? new Date() : null;
    const startedAt = status === 'in_progress' ? new Date() : null;

    await sql`
      UPDATE fundeb.wizard_progress
         SET status = COALESCE(${status ?? null}, status),
             payload = COALESCE(${payload ? JSON.stringify(payload) : null}::jsonb, payload),
             block_reason = ${blockReason ?? null},
             started_at = COALESCE(${startedAt}, started_at),
             completed_at = COALESCE(${completedAt}, completed_at),
             updated_at = NOW()
       WHERE consultoria_id = ${id} AND step = ${step}
    `;

    // Se concluiu, libera o proximo step (se ainda 'available' ou 'locked')
    if (status === 'completed') {
      await sql`
        UPDATE fundeb.wizard_progress
           SET status = 'in_progress', updated_at = NOW()
         WHERE consultoria_id = ${id}
           AND step = ${step + 1}
           AND status IN ('available','locked')
      `;
    }

    // Audit (best-effort)
    try {
      await sql`
        INSERT INTO audit.event_log (actor_id, actor_role, action, entity_type, entity_id, consultoria_id, before_state, after_state)
        VALUES ('consultor', 'consultor', 'wizard.step.updated', 'wizard_progress', ${step}, ${id},
                ${before ? JSON.stringify(before) : null}::jsonb,
                ${JSON.stringify({ status, payload, blockReason })}::jsonb)
      `;
    } catch {
      // ignore
    }

    const after = await sql`
      SELECT step, status, payload, block_reason, started_at, completed_at, updated_at
      FROM fundeb.wizard_progress
      WHERE consultoria_id = ${id}
      ORDER BY step ASC
    `;

    return Response.json({ consultoriaId: id, steps: after });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
