import { neon } from '@neondatabase/serverless';
import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const DATABASE_URL = process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_Zu1zG2LPUovb@ep-snowy-shadow-a4hoyxtl-pooler.us-east-1.aws.neon.tech/bncc_webinar?sslmode=require";

// GET /api/compliance/[slug]?municipalityId=123 — items for a specific section
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const sql = neon(DATABASE_URL);
    const municipalityId = request.nextUrl.searchParams.get('municipalityId');

    if (!municipalityId) {
      return Response.json({ error: 'municipalityId required' }, { status: 400 });
    }

    const sectionId = slug.toUpperCase();
    const rows = await sql`
      SELECT id, item_key, item_text, status, evidence_url, notes, updated_at
      FROM fundeb.compliance_items
      WHERE municipality_id = ${parseInt(municipalityId)} AND section = ${sectionId}
      ORDER BY item_key
    `;

    const total = rows.length;
    const done = rows.filter((r: Record<string, unknown>) => r.status === 'done').length;

    return Response.json({
      section: sectionId,
      items: rows.map((r: Record<string, unknown>) => ({
        id: r.id,
        itemKey: r.item_key,
        itemText: r.item_text,
        status: r.status,
        evidenceUrl: r.evidence_url,
        notes: r.notes,
        updatedAt: r.updated_at,
      })),
      stats: { total, done, progress: total > 0 ? Math.round((done / total) * 100) : 0 },
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}

// PATCH /api/compliance/[slug] — update a single item
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: _slug } = await params;
  try {
    const sql = neon(DATABASE_URL);
    const body = await request.json();
    const { municipalityId, itemKey, status, notes, evidenceUrl } = body;

    if (!municipalityId || !itemKey) {
      return Response.json({ error: 'municipalityId and itemKey required' }, { status: 400 });
    }

    await sql`
      UPDATE fundeb.compliance_items
      SET status = COALESCE(${status || null}, status),
          notes = COALESCE(${notes !== undefined ? notes : null}, notes),
          evidence_url = COALESCE(${evidenceUrl || null}, evidence_url),
          updated_at = NOW()
      WHERE municipality_id = ${municipalityId} AND item_key = ${itemKey}
    `;

    return Response.json({ ok: true });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}
