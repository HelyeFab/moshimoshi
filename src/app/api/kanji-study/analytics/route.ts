import { NextRequest, NextResponse } from 'next/server'
import { FieldValue, getAdminDb } from '@/lib/firebase/admin'
import { getSession } from '@/lib/auth/session'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const eventName = typeof body?.eventName === 'string' ? body.eventName.trim() : ''
    const category = typeof body?.category === 'string' ? body.category.trim() : 'kanji-browser-study'
    const properties =
      body?.properties && typeof body.properties === 'object' && !Array.isArray(body.properties)
        ? body.properties
        : {}

    if (!eventName.startsWith('kanji_')) {
      return NextResponse.json({ error: 'Invalid event name' }, { status: 400 })
    }

    const db = getAdminDb()
    const now = new Date()
    const createdDate = now.toISOString().slice(0, 10)

    await db.collection('kanji_study_analytics_events').add({
      userId: session.uid,
      sessionId: session.sessionId,
      eventName,
      category,
      properties,
      createdAt: FieldValue.serverTimestamp(),
      createdDate,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[API /kanji-study/analytics] Error:', error)
    return NextResponse.json({ error: 'Failed to store kanji study analytics' }, { status: 500 })
  }
}
