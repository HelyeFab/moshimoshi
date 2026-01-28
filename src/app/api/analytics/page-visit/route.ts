import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminFirestore, ensureAdminInitialized, FieldValue } from '@/lib/firebase/admin'
import { getSession } from '@/lib/auth/session'
import { trackUserActivity } from '@/lib/admin/trackActivity'

const pageVisitSchema = z.object({
  type: z.enum(['start', 'end']),
  visitId: z.string().uuid(),
  path: z.string().min(1),
  locale: z.string().length(2).optional().nullable(),
  startedAt: z.string().optional().nullable(),
  endedAt: z.string().optional().nullable(),
  durationMs: z.number().nonnegative().optional(),
  visitorType: z.enum(['user', 'guest']).optional(),
  userId: z.string().optional().nullable(),
  anonId: z.string().optional().nullable(),
  referrer: z.string().optional().nullable(),
})

function buildPathDocId(path: string): string {
  return Buffer.from(path, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function getUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getPathMeta(path: string): { section: string | null; isAdmin: boolean } {
  const withoutQuery = path.split('?')[0] || ''
  const segments = withoutQuery.split('/').filter(Boolean)
  if (segments.length === 0) return { section: null, isAdmin: false }
  const [first, second] = segments
  const section = first.length === 2 ? second : first
  return { section: section || null, isAdmin: section === 'admin' }
}

export async function POST(request: NextRequest) {
  try {
    ensureAdminInitialized()

    if (!adminFirestore) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 })
    }

    const body = await request.json()
    const data = pageVisitSchema.parse(body)

    let sessionUserId: string | null = null
    try {
      const session = await getSession()
      sessionUserId = session?.uid || null
      if (session?.uid) {
        trackUserActivity(session.uid).catch(console.error)
      }
    } catch {
      sessionUserId = null
    }

    const anonId = typeof data.anonId === 'string' ? data.anonId : null
    const visitorType: 'user' | 'guest' = sessionUserId ? 'user' : 'guest'
    const visitorId = sessionUserId || anonId

    if (!visitorId) {
      return NextResponse.json({ error: 'Missing visitor identity' }, { status: 400 })
    }

    const docRef = adminFirestore.collection('page_visits').doc(data.visitId)

    const basePayload: Record<string, unknown> = {
      visitId: data.visitId,
      path: data.path,
      locale: data.locale ?? null,
      visitorType,
      visitorId,
      userId: sessionUserId,
      anonId,
      updatedAt: FieldValue.serverTimestamp(),
    }

    if (data.type === 'start') {
      const summaryRef = adminFirestore
        .collection('page_visit_summaries')
        .doc(buildPathDocId(data.path))
      const dateKey = getUtcDateKey(new Date())
      const { section, isAdmin } = getPathMeta(data.path)
      const dailySummaryRef = adminFirestore
        .collection('page_visit_daily_summaries')
        .doc(`${dateKey}__${buildPathDocId(data.path)}`)

      await adminFirestore.runTransaction(async (tx) => {
        const existing = await tx.get(docRef)
        const startAlreadyLogged = existing.exists && existing.data()?.startLogged === true

        tx.set(
          docRef,
          {
            ...basePayload,
            createdAt: FieldValue.serverTimestamp(),
            startedAt: FieldValue.serverTimestamp(),
            startedAtClient: data.startedAt ?? null,
            referrer: data.referrer ?? null,
            startLogged: true,
          },
          { merge: true }
        )

        if (!startAlreadyLogged) {
          tx.set(
            summaryRef,
            {
              path: data.path,
              section,
              isAdmin,
              totalViews: FieldValue.increment(1),
              lastViewAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          )

          tx.set(
            dailySummaryRef,
            {
              path: data.path,
              date: dateKey,
              section,
              isAdmin,
              totalViews: FieldValue.increment(1),
              lastViewAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          )
        }
      })
    } else {
      const rawDuration = typeof data.durationMs === 'number' ? data.durationMs : null
      const durationMs = rawDuration === null ? null : Math.max(0, Math.round(rawDuration))
      const endPayload: Record<string, unknown> = {
        ...basePayload,
        endedAt: FieldValue.serverTimestamp(),
        endedAtClient: data.endedAt ?? null,
      }
      if (durationMs !== null) {
        endPayload.durationMs = durationMs
      }

      await docRef.set(endPayload, { merge: true })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    console.error('[API /analytics/page-visit] Error:', error)
    return NextResponse.json({ success: true })
  }
}
