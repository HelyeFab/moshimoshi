import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore as adminDb, FieldValue } from '@/lib/firebase/admin';

const VALID_TYPES = new Set(['resource', 'video']);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const type = typeof body.type === 'string' ? body.type : '';
    const contentId = typeof body.contentId === 'string' ? body.contentId.trim() : '';
    const source = typeof body.source === 'string' ? body.source.trim() : '';
    const title = typeof body.title === 'string' ? body.title.trim() : undefined;
    const url = typeof body.url === 'string' ? body.url.trim() : undefined;

    if (!VALID_TYPES.has(type) || !contentId || !source) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const docId = `${type}_${contentId}`;
    const docRef = adminDb.collection('content_clicks').doc(docId);

    const updateData: Record<string, unknown> = {
      type,
      contentId,
      totalClicks: FieldValue.increment(1),
      lastClickedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      [`sourceClicks.${source}`]: FieldValue.increment(1),
    };

    if (title) updateData.title = title;
    if (url) updateData.url = url;

    await docRef.set(updateData, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API /analytics/content-click] Error:', error);
    return NextResponse.json({ success: true });
  }
}
