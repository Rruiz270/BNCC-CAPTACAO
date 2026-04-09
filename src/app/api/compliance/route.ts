import { neon } from '@neondatabase/serverless';
import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const DATABASE_URL = process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_Zu1zG2LPUovb@ep-snowy-shadow-a4hoyxtl-pooler.us-east-1.aws.neon.tech/bncc_webinar?sslmode=require";

// GET /api/compliance?municipalityId=123
export async function GET(request: NextRequest) {
  try {
    const sql = neon(DATABASE_URL);
    const municipalityId = request.nextUrl.searchParams.get('municipalityId');

    if (!municipalityId) {
      return Response.json({ error: 'municipalityId required' }, { status: 400 });
    }

    const rows = await sql`
      SELECT id, municipality_id, section, section_name, item_key, item_text, status, evidence_url, notes, updated_at
      FROM fundeb.compliance_items
      WHERE municipality_id = ${parseInt(municipalityId)}
      ORDER BY section, item_key
    `;

    // Group by section
    const sections: Record<string, { section: string; sectionName: string; items: unknown[] }> = {};
    for (const row of rows) {
      const sec = row.section as string;
      if (!sections[sec]) {
        sections[sec] = { section: sec, sectionName: row.section_name as string, items: [] };
      }
      sections[sec].items.push({
        id: row.id,
        itemKey: row.item_key,
        itemText: row.item_text,
        status: row.status,
        evidenceUrl: row.evidence_url,
        notes: row.notes,
        updatedAt: row.updated_at,
      });
    }

    const total = rows.length;
    const done = rows.filter((r: Record<string, unknown>) => r.status === 'done').length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;

    return Response.json({
      items: rows.map((r: Record<string, unknown>) => ({
        id: r.id,
        section: r.section,
        sectionName: r.section_name,
        itemKey: r.item_key,
        itemText: r.item_text,
        status: r.status,
        evidenceUrl: r.evidence_url,
        notes: r.notes,
        updatedAt: r.updated_at,
      })),
      sections: Object.values(sections),
      stats: { total, done, progress },
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}

// POST /api/compliance - bulk upsert
export async function POST(request: NextRequest) {
  try {
    const sql = neon(DATABASE_URL);
    const body = await request.json();
    const { municipalityId, items } = body;

    if (!municipalityId || !items) {
      return Response.json({ error: 'municipalityId and items required' }, { status: 400 });
    }

    for (const item of items) {
      await sql`
        UPDATE fundeb.compliance_items
        SET status = ${item.status}, notes = ${item.notes || null}, evidence_url = ${item.evidenceUrl || null}, updated_at = NOW()
        WHERE municipality_id = ${municipalityId} AND item_key = ${item.itemKey}
      `;
    }

    return Response.json({ ok: true, updated: items.length });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}
