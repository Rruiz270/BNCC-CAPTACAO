import { neon } from '@neondatabase/serverless';
import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const DATABASE_URL = process.env.DATABASE_URL!;

// POST /api/ops/recalcular/[municipalityId]
// Dispara fundeb.sp_recalcular_potencial para o municipio.
// Retorna o snapshot atualizado das colunas de potencial.
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ municipalityId: string }> }
) {
  try {
    if (!DATABASE_URL) {
      return Response.json({ error: 'DATABASE_URL nao configurado' }, { status: 500 });
    }
    const { municipalityId } = await ctx.params;
    const id = parseInt(municipalityId, 10);
    if (Number.isNaN(id)) {
      return Response.json({ error: 'municipalityId invalido' }, { status: 400 });
    }

    const sql = neon(DATABASE_URL);

    // Ensure SP is up-to-date before calling it
    await sql.query(`CREATE OR REPLACE PROCEDURE fundeb.sp_recalcular_potencial(p_municipality_id INTEGER)
LANGUAGE plpgsql AS $BODY$
DECLARE
  v_receita_atual  REAL;
  v_pot_total      REAL := 0;
  v_n_faltantes    INTEGER := 0;
  v_cats           JSONB := '[]'::jsonb;
  v_potencial_simple JSONB := '[]'::jsonb;
  v_has_rich       BOOLEAN := FALSE;
  r                RECORD;
BEGIN
  SELECT receita_total,
         CASE WHEN potencial IS NOT NULL
               AND jsonb_typeof(potencial) = 'object'
               AND potencial ? 't1'
              THEN TRUE ELSE FALSE END
    INTO v_receita_atual, v_has_rich
  FROM fundeb.municipalities WHERE id = p_municipality_id;

  FOR r IN
    SELECT categoria, categoria_label, fator_vaaf, quantidade, ativa
    FROM fundeb.enrollments
    WHERE municipality_id = p_municipality_id
  LOOP
    IF r.ativa IS FALSE OR r.quantidade IS NULL OR r.quantidade = 0 THEN
      v_n_faltantes := v_n_faltantes + 1;
      v_pot_total := v_pot_total + (COALESCE(r.fator_vaaf, 0) * 10);
      v_potencial_simple := v_potencial_simple || jsonb_build_object(
        'categoria', r.categoria,
        'label', r.categoria_label,
        'fator', r.fator_vaaf,
        'estimado_min', COALESCE(r.fator_vaaf, 0) * 10
      );
    END IF;
    v_cats := v_cats || jsonb_build_object(
      'categoria', r.categoria,
      'quantidade', COALESCE(r.quantidade,0),
      'ativa', COALESCE(r.ativa,false)
    );
  END LOOP;

  IF v_has_rich THEN
    UPDATE fundeb.municipalities
       SET pot_total = v_pot_total,
           pct_pot_total = CASE WHEN COALESCE(v_receita_atual,0) > 0
                                THEN ROUND((v_pot_total / v_receita_atual)::numeric * 100, 2)
                                ELSE 0 END,
           n_faltantes = v_n_faltantes,
           cats = v_cats,
           updated_at = NOW()
     WHERE id = p_municipality_id;
  ELSE
    UPDATE fundeb.municipalities
       SET pot_total = v_pot_total,
           pct_pot_total = CASE WHEN COALESCE(v_receita_atual,0) > 0
                                THEN ROUND((v_pot_total / v_receita_atual)::numeric * 100, 2)
                                ELSE 0 END,
           n_faltantes = v_n_faltantes,
           cats = v_cats,
           potencial = v_potencial_simple,
           updated_at = NOW()
     WHERE id = p_municipality_id;
  END IF;

  INSERT INTO audit.event_log (actor_id, actor_role, action, entity_type, entity_id, after_state)
  VALUES ('system', 'sistema', 'recalculo.potencial', 'municipality', p_municipality_id,
          jsonb_build_object('pot_total', v_pot_total, 'n_faltantes', v_n_faltantes));

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY ops.v_consultoria_kpis;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END;
$BODY$`);

    await sql.query(`CALL fundeb.sp_recalcular_potencial($1)`, [id]);

    const rows = await sql.query(
      `SELECT id, nome, pot_total, pct_pot_total, n_faltantes, updated_at
         FROM fundeb.municipalities WHERE id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return Response.json({ error: 'municipio nao encontrado' }, { status: 404 });
    }

    return Response.json({ ok: true, municipality: rows[0] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
