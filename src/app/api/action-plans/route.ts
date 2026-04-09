import { neon } from '@neondatabase/serverless';
import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const DATABASE_URL = process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_Zu1zG2LPUovb@ep-snowy-shadow-a4hoyxtl-pooler.us-east-1.aws.neon.tech/bncc_webinar?sslmode=require";

// Ensure action_plans has required columns
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureColumns(sql: any) {
  try {
    await sql`ALTER TABLE fundeb.action_plans ADD COLUMN IF NOT EXISTS phase TEXT DEFAULT 'curto'`;
    await sql`ALTER TABLE fundeb.action_plans ADD COLUMN IF NOT EXISTS task_key TEXT`;
    await sql`ALTER TABLE fundeb.action_plans ADD COLUMN IF NOT EXISTS descricao TEXT`;
    await sql`ALTER TABLE fundeb.action_plans ADD COLUMN IF NOT EXISTS notes TEXT`;
  } catch {
    // columns may already exist
  }
}

// GET /api/action-plans?municipalityId=123&phase=curto
export async function GET(request: NextRequest) {
  try {
    const sql = neon(DATABASE_URL);
    await ensureColumns(sql);
    const municipalityId = request.nextUrl.searchParams.get('municipalityId');
    const phase = request.nextUrl.searchParams.get('phase');

    if (!municipalityId) {
      return Response.json({ error: 'municipalityId required' }, { status: 400 });
    }

    let rows;
    if (phase) {
      rows = await sql`
        SELECT id, municipality_id, phase, semana, semana_label, task_key, tarefa, descricao, responsavel, status, due_date, notes, completed_at
        FROM fundeb.action_plans
        WHERE municipality_id = ${parseInt(municipalityId)} AND phase = ${phase}
        ORDER BY semana, task_key
      `;
    } else {
      rows = await sql`
        SELECT id, municipality_id, phase, semana, semana_label, task_key, tarefa, descricao, responsavel, status, due_date, notes, completed_at
        FROM fundeb.action_plans
        WHERE municipality_id = ${parseInt(municipalityId)}
        ORDER BY phase, semana, task_key
      `;
    }

    const total = rows.length;
    const done = rows.filter((r: Record<string, unknown>) => r.status === 'done').length;

    // Group by phase
    const phases: Record<string, { phase: string; tasks: unknown[]; total: number; done: number }> = {};
    for (const row of rows) {
      const p = (row.phase as string) || 'curto';
      if (!phases[p]) {
        phases[p] = { phase: p, tasks: [], total: 0, done: 0 };
      }
      phases[p].tasks.push({
        id: row.id,
        phase: row.phase,
        semana: row.semana,
        semanaLabel: row.semana_label,
        taskKey: row.task_key,
        tarefa: row.tarefa,
        descricao: row.descricao,
        responsavel: row.responsavel,
        status: row.status,
        dueDate: row.due_date,
        notes: row.notes,
        completedAt: row.completed_at,
      });
      phases[p].total++;
      if (row.status === 'done') phases[p].done++;
    }

    return Response.json({
      tasks: rows.map((r: Record<string, unknown>) => ({
        id: r.id,
        phase: r.phase,
        semana: r.semana,
        semanaLabel: r.semana_label,
        taskKey: r.task_key,
        tarefa: r.tarefa,
        descricao: r.descricao,
        responsavel: r.responsavel,
        status: r.status,
        dueDate: r.due_date,
        notes: r.notes,
        completedAt: r.completed_at,
      })),
      phases: Object.values(phases),
      stats: { total, done, progress: total > 0 ? Math.round((done / total) * 100) : 0 },
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}

// POST /api/action-plans — bulk upsert
export async function POST(request: NextRequest) {
  try {
    const sql = neon(DATABASE_URL);
    const body = await request.json();
    const { municipalityId, tasks } = body;

    if (!municipalityId || !tasks) {
      return Response.json({ error: 'municipalityId and tasks required' }, { status: 400 });
    }

    for (const task of tasks) {
      if (task.id) {
        await sql`
          UPDATE fundeb.action_plans
          SET status = ${task.status}, notes = ${task.notes || null},
              responsavel = ${task.responsavel || null},
              completed_at = ${task.status === 'done' ? new Date().toISOString() : null}
          WHERE id = ${task.id}
        `;
      }
    }

    return Response.json({ ok: true, updated: tasks.length });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}
