import { neon } from '@neondatabase/serverless';
import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const DATABASE_URL = process.env.DATABASE_URL!;

// GET /api/intake/[token] — Validate token, return municipality data + enrollments + financials
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const sql = neon(DATABASE_URL);
    const { token } = await params;

    // Look up token
    const tokens = await sql`
      SELECT t.id, t.token, t.municipality_id, t.consultoria_id,
             t.expires_at, t.responded_at, t.created_at,
             m.nome, m.codigo_ibge, m.receita_total, m.contribuicao,
             m.recursos_receber, m.vaat, m.vaar, m.ganho_perda,
             m.total_matriculas, m.total_escolas, m.escolas_municipais,
             m.escolas_rurais, m.total_docentes,
             m.pot_total, m.pct_pot_total,
             m.ideb_ai, m.ideb_af, m.ei_mat, m.ef_mat
      FROM fundeb.intake_tokens t
      JOIN fundeb.municipalities m ON m.id = t.municipality_id
      WHERE t.token = ${token}
    `;

    if (tokens.length === 0) {
      return Response.json({ error: 'Token nao encontrado' }, { status: 404 });
    }

    const row = tokens[0];

    // Check expired
    if (new Date(row.expires_at as string) < new Date()) {
      return Response.json({ error: 'Token expirado' }, { status: 410 });
    }

    // Check already responded
    if (row.responded_at) {
      return Response.json({ error: 'Formulario ja respondido' }, { status: 409 });
    }

    // Fetch enrollments
    const enrollments = await sql`
      SELECT categoria, categoria_label, fator_vaaf, quantidade,
             quantidade_urbana, quantidade_campo, ativa, receita_estimada
      FROM fundeb.enrollments
      WHERE municipality_id = ${row.municipality_id}
      ORDER BY id
    `;

    // Compliance da seção A (5 condicionalidades VAAR) — alimenta engine
    const complianceA = await sql`
      SELECT
        COUNT(*)::int AS total,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END)::int AS done
      FROM fundeb.compliance_items
      WHERE municipality_id = ${row.municipality_id} AND section = 'A'
    `;

    return Response.json({
      token: row.token,
      municipality: {
        id: row.municipality_id,
        nome: row.nome,
        codigoIbge: row.codigo_ibge,
        receitaTotal: row.receita_total,
        contribuicao: row.contribuicao,
        recursosReceber: row.recursos_receber,
        vaat: row.vaat,
        vaar: row.vaar,
        ganhoPeerda: row.ganho_perda,
        totalMatriculas: row.total_matriculas,
        totalEscolas: row.total_escolas,
        escolasMunicipais: row.escolas_municipais,
        escolasRurais: row.escolas_rurais,
        totalDocentes: row.total_docentes,
        potTotal: row.pot_total,
        pctPotTotal: row.pct_pot_total,
        idebAi: row.ideb_ai ?? null,
        idebAf: row.ideb_af ?? null,
        eiMat: row.ei_mat ?? null,
        efMat: row.ef_mat ?? null,
        complianceASectionDone: complianceA[0]?.done ?? 0,
        complianceASectionTotal: complianceA[0]?.total ?? 5,
      },
      enrollments: enrollments.map((e: Record<string, unknown>) => ({
        categoria: e.categoria,
        categoriaLabel: e.categoria_label,
        fatorVaaf: e.fator_vaaf,
        quantidade: e.quantidade,
        quantidadeUrbana: e.quantidade_urbana,
        quantidadeCampo: e.quantidade_campo,
        ativa: e.ativa,
        receitaEstimada: e.receita_estimada,
      })),
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}

// POST /api/intake/[token] — Submit the intake response
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const sql = neon(DATABASE_URL);
    const { token } = await params;
    const body = await request.json();

    // Validate token
    const tokens = await sql`
      SELECT id, municipality_id, expires_at, responded_at
      FROM fundeb.intake_tokens
      WHERE token = ${token}
    `;

    if (tokens.length === 0) {
      return Response.json({ error: 'Token nao encontrado' }, { status: 404 });
    }

    const tokenRow = tokens[0];

    if (new Date(tokenRow.expires_at as string) < new Date()) {
      return Response.json({ error: 'Token expirado' }, { status: 410 });
    }

    if (tokenRow.responded_at) {
      return Response.json({ error: 'Formulario ja respondido' }, { status: 409 });
    }

    const { respondentName, respondentRole, respondentEmail, data } = body;

    if (!respondentName) {
      return Response.json({ error: 'respondentName required' }, { status: 400 });
    }

    // Insert response
    const result = await sql`
      INSERT INTO fundeb.intake_responses (token_id, municipality_id, respondent_name, respondent_role, respondent_email, data)
      VALUES (${tokenRow.id}, ${tokenRow.municipality_id}, ${respondentName}, ${respondentRole || null}, ${respondentEmail || null}, ${JSON.stringify(data || {})})
      RETURNING id, submitted_at
    `;

    // Mark token as responded
    await sql`
      UPDATE fundeb.intake_tokens SET responded_at = NOW() WHERE id = ${tokenRow.id}
    `;

    return Response.json({
      success: true,
      responseId: result[0].id,
      submittedAt: result[0].submitted_at,
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}
