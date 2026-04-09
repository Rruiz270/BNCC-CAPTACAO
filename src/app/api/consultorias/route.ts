import { neon } from '@neondatabase/serverless';
import { type NextRequest } from 'next/server';
import { COMPLIANCE_SECTIONS, ACTION_PLAN_WEEKS, MEDIUM_TERM_TASKS, LONG_TERM_TASKS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const DATABASE_URL = process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_Zu1zG2LPUovb@ep-snowy-shadow-a4hoyxtl-pooler.us-east-1.aws.neon.tech/bncc_webinar?sslmode=require";

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
}

// GET /api/consultorias - list sessions with municipality data
export async function GET() {
  try {
    const sql = neon(DATABASE_URL);
    await ensureTable(sql);

    const rows = await sql`
      SELECT c.id, c.municipality_id, c.status, c.start_date, c.end_date, c.notes, c.created_at,
             m.nome, m.total_matriculas, m.receita_total, m.total_escolas, m.total_docentes,
             m.codigo_ibge, m.pct_internet, m.pct_biblioteca
      FROM fundeb.consultorias c
      JOIN fundeb.municipalities m ON m.id = c.municipality_id
      ORDER BY c.created_at DESC
    `;

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

      return {
        id: row.id,
        municipalityId: muniId,
        status: row.status,
        startDate: row.start_date,
        endDate: row.end_date,
        notes: row.notes,
        municipality: {
          id: muniId,
          nome: row.nome,
          totalMatriculas: row.total_matriculas,
          receitaTotal: row.receita_total,
          totalEscolas: row.total_escolas,
          totalDocentes: row.total_docentes,
          codigoIbge: row.codigo_ibge,
          pctInternet: row.pct_internet,
          pctBiblioteca: row.pct_biblioteca,
        },
        complianceProgress: compTotal > 0 ? Math.round((compDone / compTotal) * 100) : 0,
        actionPlanProgress: actTotal > 0 ? Math.round((actDone / actTotal) * 100) : 0,
      };
    }));

    return Response.json({ sessions });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}

// POST /api/consultorias - create session + seed compliance and action plans
export async function POST(request: NextRequest) {
  try {
    const sql = neon(DATABASE_URL);
    await ensureTable(sql);
    const body = await request.json();
    const { municipalityId } = body;

    if (!municipalityId) {
      return Response.json({ error: 'municipalityId required' }, { status: 400 });
    }

    // Create consultoria session
    const result = await sql`
      INSERT INTO fundeb.consultorias (municipality_id, status)
      VALUES (${municipalityId}, 'active')
      RETURNING id, municipality_id, status, start_date, end_date, notes
    `;
    const session = result[0];

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
      },
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}
