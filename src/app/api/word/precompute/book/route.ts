import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAdminDb, Timestamp } from '@/lib/firebase/admin'
import crypto from 'crypto'

export const runtime = 'nodejs'

const PRECOMPUTE_VERSION = 'v2_all_tokens'

export async function POST(request: NextRequest) {
  let contentId: string | undefined
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ success: false, error: 'UNAUTHENTICATED' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { contentId: bodyContentId } = body || {}
    contentId = bodyContentId

    if (!contentId) {
      return NextResponse.json(
        { success: false, error: 'contentId is required' },
        { status: 400 }
      )
    }

    const db = getAdminDb()
    const docRef = db.collection('book_word_explanations').doc(contentId)
    const lockId = crypto.randomUUID()
    const lockTtlMs = 30 * 60 * 1000
    const now = Timestamp.now()

    const lockResult = await db.runTransaction(async tx => {
      const snap = await tx.get(docRef)
      const data = snap.exists ? snap.data() : undefined
      const status = data?.precomputeStatus
      const startedAt = data?.precomputeStartedAt?.toDate?.()
      const isFresh =
        status === 'generating' &&
        startedAt &&
        Date.now() - startedAt.getTime() < lockTtlMs

      if (
        !isFresh &&
        status === 'complete' &&
        data?.words?.length &&
        data?.precomputeVersion === PRECOMPUTE_VERSION
      ) {
        return { allowed: false, reason: 'complete' }
      }

      if (isFresh) {
        return { allowed: false, reason: 'locked' }
      }

      tx.set(
        docRef,
        {
          precomputeStatus: 'generating',
          precomputeStartedAt: now,
          precomputeLockId: lockId,
          precomputeUpdatedAt: now,
          precomputeVersion: PRECOMPUTE_VERSION,
          precomputeOptions: {
            includeParticles: true,
            minLength: 1,
          },
        },
        { merge: true }
      )

      return { allowed: true }
    })

    if (!lockResult.allowed) {
      return NextResponse.json({ success: true, skipped: lockResult.reason })
    }

    await db.collection('book_word_precompute_requests').add({
      bookId: contentId,
      requestedAt: now,
      precomputeVersion: PRECOMPUTE_VERSION,
      includeParticles: true,
      minLength: 1,
      source: 'client',
    })

    return NextResponse.json({ success: true, queued: true })
  } catch (error) {
    if (contentId) {
      try {
        const db = getAdminDb()
        await db.collection('book_word_explanations').doc(contentId).set(
          {
            precomputeStatus: 'failed',
            precomputeError: error instanceof Error ? error.message : String(error),
            precomputeUpdatedAt: Timestamp.now(),
            precomputeVersion: PRECOMPUTE_VERSION,
            precomputeOptions: {
              includeParticles: true,
              minLength: 1,
            },
          },
          { merge: true }
        )
      } catch {
        // ignore
      }
    }
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
