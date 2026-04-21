import { neon } from '@neondatabase/serverless';
import { type NextRequest } from 'next/server';
import { COMPLIANCE_SECTIONS, ACTION_PLAN_WEEKS, MEDIUM_TERM_TASKS, LONG_TERM_TASKS } from '@/lib/constants';
import { ensureOwnershipColumns, auditLeadEvent } from '@/lib/lead-ownership';
import { getUser } from '@/lib/session';
import { isAdmin } from '@/lib/roles';

export const dynamic = 'force-dynamic';

const DATABASE_URL = process.env.DATABASE_URL!;

// WEEK_TASKS for seeding action plans (curto prazo)
const WEEK_TASKS: Record<number, string[]> = {
  1: ['Coletar dados atuais', 'Identificar categorias faltantes', 'Mapear escolas rurais', 'Reuniao com equipe pedagogica'],
  2: ['Aprovar plano com secretario', 'Iniciar reclassificacao de matriculas', 'Contatar escolas conveniadas'],
  3: ['Registrar AEE dupla matricula', 'Reclassificar escolas rurais', 'Verificar integral'],
  4: ['Expandir matriculas integrais', 'Formalizar parcerias conveniadas', 'Documentar evidencias'],
  5: ['Verificar registros no sistema', 'Corrigir inconsistencias', 'Preparar relatorio'],
  6: ['Ultima verificacao', 'Validar com equipe', 'Backup de documentos'],
  7: ['Verificacao final do Censo', 'Confirmar envio'],
};

// Ensure consultorias table and required columns exist
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureTable(sql: any) {
  await sql`
    CREATE TABLE IF NOT EXISTS fundeb.consultorias (
      id SERIAL PRIMARY KEY,
      municipality_id INTEGER REFERENCES fundeb.municipalities(id),
      status TEXT DEFAULT 'active',
      start_date TIMESTAMP DEFAULT NOW(),
      end_date TIMESTAMP,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  // Add missing columns if table was created with old schema
  const migrations = [
    `ALTER TABLE fundeb.action_plans ADD COLUMN IF NOT EXISTS phase TEXT DEFAULT 'curto'`,
    `ALTER TABLE fundeb.action_plans ADD COLUMN IF NOT EXISTS task_key TEXT`,
    `ALTER TABLE fundeb.action_plans ADD COLUMN IF NOT EXISTS descricao TEXT`,
    `ALTER TABLE fundeb.action_plans ADD COLUMN IF NOT EXISTS notes TEXT`,
    `ALTER TABLE fundeb.municipalities ADD COLUMN IF NOT EXISTS escolas_municipais INTEGER`,
  ];
  for (const m of migrations) {
    try { await sql.query(m); } catch { /* column may already exist */ }
  }
  await ensureOwnershipColumns(sql);
}

// GET /api/consultorias?view=mine|pool|all - list sessions with municipality data
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const sql = neon(DATABASE_URL);
    await ensureTable(sql);

    const { searchParams } = new URL(request.url);
    const viewParam = (searchParams.get('view') ?? '').toLowerCase();
    const requestedView: 'mine' | 'pool' | 'all' =
      viewParam === 'pool' ? 'pool'
      : viewParam === 'all' ? 'all'
      : 'mine';

    // Consultor não pode pedir view=all — força mine
    const view = !isAdmin(user.role) && requestedView === 'all' ? 'mine' : requestedView;

    const baseSelect = `
      SELECT c.id, c.municipality_id, c.status, c.start_date, c.end_date, c.notes, c.created_at,
             c.assigned_consultor_id, c.assigned_at,
             u.display_name AS consultor_display_name, u.name AS consultor_name, u.email AS consultor_email,
             m.nome, m.total_matriculas, m.receita_total, m.recursos_receber,
             m.total_escolas, m.escolas_municipais, m.total_docentes,
             m.codigo_ibge, m.pct_internet, m.pct_biblioteca
      FROM fundeb.consultorias c
      LEFT JOIN crm.users u ON u.id = c.assigned_consultor_id
      JOIN fundeb.municipalities m ON m.id = c.municipality_id
    `;

    let rows: Array<Record<string, unknown>>;
    if (view === 'mine') {
      rows = await sql.query(`${baseSelect} WHERE c.assigned_consultor_id = $1 ORDER BY c.created_at DESC`, [user.id]);
    } else if (view === 'pool') {
      rows = await sql.query(`${baseSelect} WHERE c.assigned_consultor_id IS NULL ORDER BY c.created_at DESC`, []);
    } else {
      rows = await sql.query(`${baseSelect} ORDER BY c.created_at DESC`, []);
    }

    // Get progress for each session
    const sessions = await Promise.all(rows.map(async (row: Record<string, unknown>) => {
      const muniId = row.municipality_id as number;

      // Compliance progress
      const complianceResult = await sql`
        SELECT COUNT(*) as total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done
        FROM fundeb.compliance_items WHERE municipality_id = ${muniId}
      `;
      const compTotal = parseInt(complianceResult[0]?.total as string) || 0;
      const compDone = parseInt(complianceResult[0]?.done as string) || 0;

      // Action plan progress
      const actionResult = await sql`
        SELECT COUNT(*) as total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done
        FROM fundeb.action_plans WHERE municipality_id = ${muniId}
      `;
      const actTotal = parseInt(actionResult[0]?.total as string) || 0;
      const actDone = parseInt(actionResult[0]?.done as string) || 0;

      const assignedId = row.assigned_consultor_id as string | null;
      const assignedConsultor = assignedId
        ? {
            id: assignedId,
            name: (row.consultor_display_name ?? row.consultor_name ?? null) as string | null,
            email: (row.consultor_email ?? null) as string | null,
          }
        : null;

      return {
        id: row.id,
        municipalityId: muniId,
        status: row.status,
        startDate: row.start_date,
        endDate: row.end_date,
        notes: row.notes,
        assignedConsultor,
        assignedAt: row.assigned_at ?? null,
        isMine: assignedId === user.id,
        municipality: {
          id: muniId,
          nome: row.nome,
          totalMatriculas: row.total_matriculas,
          receitaTotal: row.recursos_receber ?? row.receita_total,
          totalEscolas: row.escolas_municipais ?? row.total_escolas,
          totalDocentes: row.total_docentes,
          codigoIbge: row.codigo_ibge,
          pctInternet: row.pct_internet,
          pctBiblioteca: row.pct_biblioteca,
        },
        complianceProgress: compTotal > 0 ? Math.round((compDone / compTotal) * 100) : 0,
        actionPlanProgress: actTotal > 0 ? Math.round((actDone / actTotal) * 100) : 0,
      };
    }));

    return Response.json({
      sessions,
      view,
      viewer: { id: user.id, role: user.role, isAdmin: isAdmin(user.role) },
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}

// POST /api/consultorias - create session + seed compliance and action plans
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const sql = neon(DATABASE_URL);
    await ensureTable(sql);
    const body = await request.json();
    const { municipalityId } = body;

    if (!municipalityId) {
      return Response.json({ error: 'municipalityId required' }, { status: 400 });
    }

    // Create consultoria ja atribuida ao criador (ownership inicial).
    // Admin/gestor tambem recebe como dono por padrao; pode transferir depois.
    const result = await sql`
      INSERT INTO fundeb.consultorias
        (municipality_id, status, assigned_consultor_id, assigned_at)
      VALUES (${municipalityId}, 'active', ${user.id}, NOW())
      RETURNING id, municipality_id, status, start_date, end_date, notes, assigned_consultor_id, assigned_at
    `;
    const session = result[0];

    await auditLeadEvent(sql, {
      actor: user,
      action: 'consultoria.claim',
      consultoriaId: Number(session.id),
      beforeOwnerId: null,
      afterOwnerId: user.id,
      reason: 'created',
    });

    // Check if compliance items already exist for this municipality
    const existingCompliance = await sql`
      SELECT COUNT(*) as cnt FROM fundeb.compliance_items WHERE municipality_id = ${municipalityId}
    `;
    const complianceExists = parseInt(existingCompliance[0]?.cnt as string) > 0;

    // Seed compliance items if they don't exist
    if (!complianceExists) {
      for (const section of COMPLIANCE_SECTIONS) {
        for (const item of section.items) {
          await sql`
            INSERT INTO fundeb.compliance_items (municipality_id, section, section_name, item_key, item_text, status)
            VALUES (${municipalityId}, ${section.id}, ${section.name}, ${item.key}, ${item.text}, 'pending')
          `;
        }
      }
    }

    // Check if action plans exist for this municipality
    const existingPlans = await sql`
      SELECT COUNT(*) as cnt FROM fundeb.action_plans WHERE municipality_id = ${municipalityId}
    `;
    const plansExist = parseInt(existingPlans[0]?.cnt as string) > 0;

    // Seed action plans for all 3 phases if they don't exist
    if (!plansExist) {
      // Curto prazo: 7 weeks
      for (const week of ACTION_PLAN_WEEKS) {
        const tasks = WEEK_TASKS[week.semana] || [];
        for (let i = 0; i < tasks.length; i++) {
          await sql`
            INSERT INTO fundeb.action_plans (municipality_id, phase, semana, semana_label, task_key, tarefa, status, due_date)
            VALUES (${municipalityId}, 'curto', ${week.semana}, ${week.label}, ${`curto_${week.semana}_${i + 1}`}, ${tasks[i]}, 'pending', ${week.dates})
          `;
        }
      }

      // Medio prazo
      for (const task of MEDIUM_TERM_TASKS) {
        await sql`
          INSERT INTO fundeb.action_plans (municipality_id, phase, semana, semana_label, task_key, tarefa, descricao, status, due_date)
          VALUES (${municipalityId}, 'medio', 0, 'Medio Prazo', ${task.key}, ${task.tarefa}, ${task.descricao}, 'pending', ${task.deadline})
        `;
      }

      // Longo prazo
      for (const task of LONG_TERM_TASKS) {
        await sql`
          INSERT INTO fundeb.action_plans (municipality_id, phase, semana, semana_label, task_key, tarefa, descricao, status, due_date)
          VALUES (${municipalityId}, 'longo', 0, 'Longo Prazo', ${task.key}, ${task.tarefa}, ${task.descricao}, 'pending', ${task.deadline})
        `;
      }
    }

    return Response.json({
      session: {
        id: session.id,
        municipalityId: session.municipality_id,
        status: session.status,
        startDate: session.start_date,
        endDate: session.end_date,
        notes: session.notes,
        assignedConsultor: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        assignedAt: session.assigned_at,
      },
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}
