import { neon } from '@neondatabase/serverless';
import catsData from '@/data/fundeb-cats.json';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DATABASE_URL = process.env.DATABASE_URL!;

interface CompactCat {
  u_m: number;
  u_v: number;
  u_s: number;
  c_m: number;
  c_s: number;
  q_m: number;
  q_s: number;
}

interface CompactMuni {
  nome: string;
  cats: Record<string, CompactCat>;
}

function slugify(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

interface EnrollmentRow {
  municipality_id: number;
  categoria: string;
  categoria_label: string;
  fator_vaaf: number;
  quantidade: number;
  quantidade_urbana: number;
  quantidade_campo: number;
  receita_estimada: number;
  ativa: boolean;
}

// POST /api/ops/seed-enrollments
// Idempotente: apaga e reinsere enrollments para cada municipio presente no
// bundle src/data/fundeb-cats.json. Processa em chunks para caber no maxDuration.
export async function POST() {
  try {
    if (!DATABASE_URL) {
      return Response.json({ error: 'DATABASE_URL nao configurado' }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sql: any = neon(DATABASE_URL);
    const data = catsData as unknown as CompactMuni[];

    // 1. Name → id map
    const munis = await sql`SELECT id, nome FROM fundeb.municipalities`;
    const nameToId = new Map<string, number>();
    for (const m of munis) {
      nameToId.set(m.nome as string, m.id as number);
    }

    const skipped: string[] = [];
    const allRows: EnrollmentRow[] = [];
    const touchedIds = new Set<number>();

    for (const mun of data) {
      const id = nameToId.get(mun.nome);
      if (!id) {
        skipped.push(mun.nome);
        continue;
      }
      touchedIds.add(id);

      for (const [label, c] of Object.entries(mun.cats)) {
        const urb = Number(c.u_m) || 0;
        const campo = (Number(c.c_m) || 0) + (Number(c.q_m) || 0);
        const qtd = urb + campo;
        const receita = (Number(c.u_s) || 0) + (Number(c.c_s) || 0) + (Number(c.q_s) || 0);
        allRows.push({
          municipality_id: id,
          categoria: slugify(label),
          categoria_label: label,
          fator_vaaf: Number(c.u_v) || 0,
          quantidade: Math.round(qtd),
          quantidade_urbana: Math.round(urb),
          quantidade_campo: Math.round(campo),
          receita_estimada: receita,
          ativa: qtd > 0,
        });
      }
    }

    // 2. Wipe existing rows for touched municipalities (idempotente)
    const idsArr = Array.from(touchedIds);
    const CHUNK_DELETE = 200;
    for (let i = 0; i < idsArr.length; i += CHUNK_DELETE) {
      const chunk = idsArr.slice(i, i + CHUNK_DELETE);
      await sql.query(
        `DELETE FROM fundeb.enrollments WHERE municipality_id = ANY($1::int[])`,
        [chunk]
      );
    }

    // 3. Batch insert
    const BATCH = 500; // 500 rows por INSERT
    let inserted = 0;
    for (let i = 0; i < allRows.length; i += BATCH) {
      const chunk = allRows.slice(i, i + BATCH);
      const values: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params: any[] = [];
      chunk.forEach((r, j) => {
        const idx = j * 9;
        values.push(
          `($${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, $${idx + 7}, $${idx + 8}, $${idx + 9})`
        );
        params.push(
          r.municipality_id,
          r.categoria,
          r.categoria_label,
          r.fator_vaaf,
          r.quantidade,
          r.quantidade_urbana,
          r.quantidade_campo,
          r.receita_estimada,
          r.ativa
        );
      });
      await sql.query(
        `INSERT INTO fundeb.enrollments (
           municipality_id, categoria, categoria_label, fator_vaaf,
           quantidade, quantidade_urbana, quantidade_campo, receita_estimada, ativa
         ) VALUES ${values.join(',')}`,
        params
      );
      inserted += chunk.length;
    }

    return Response.json({
      ok: true,
      municipalities_total: data.length,
      municipalities_processed: touchedIds.size,
      enrollments_inserted: inserted,
      skipped_names: skipped,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
