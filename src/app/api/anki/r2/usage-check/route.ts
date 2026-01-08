import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const LIMIT_BYTES = 300 * 1024 * 1024

const UsageCheckSchema = z.object({
  deckId: z.string().min(1),
  deckTotalBytes: z.number().int().nonnegative(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await request.json().catch(() => null)

    if (!body) {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } },
        { status: 400 }
      )
    }

    const parsed = UsageCheckSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid usage check request',
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      )
    }

    if (!adminDb) {
      throw new Error('Firebase Admin DB not initialized')
    }

    const { deckId, deckTotalBytes } = parsed.data

    const snapshot = await adminDb
      .collection('anki_r2_backups')
      .where('userId', '==', session.uid)
      .get()

    let usedBytes = 0
    let existingDeckBytes = 0

    snapshot.docs.forEach(doc => {
      const data = doc.data() as { deckId?: string; totalBytes?: number }
      const bytes = data.totalBytes || 0
      usedBytes += bytes
      if (data.deckId === deckId) {
        existingDeckBytes = bytes
      }
    })

    const effectiveUsedBytes = Math.max(0, usedBytes - existingDeckBytes)
    const projectedBytes = effectiveUsedBytes + deckTotalBytes
    const allowed = projectedBytes <= LIMIT_BYTES

    if (!allowed) {
      return NextResponse.json(
        {
          error: {
            code: 'R2_STORAGE_LIMIT_EXCEEDED',
            message: 'R2 storage limit exceeded',
            limitBytes: LIMIT_BYTES,
            usedBytes: effectiveUsedBytes,
            requestedBytes: deckTotalBytes,
            availableBytes: Math.max(0, LIMIT_BYTES - effectiveUsedBytes),
          },
        },
        { status: 413 }
      )
    }

    return NextResponse.json({
      allowed: true,
      limitBytes: LIMIT_BYTES,
      usedBytes: effectiveUsedBytes,
      requestedBytes: deckTotalBytes,
    })
  } catch (error: any) {
    const message = error?.message || 'Failed to check usage'
    const status = message === 'Authentication required' ? 401 : 500

    return NextResponse.json(
      { error: { code: 'USAGE_CHECK_ERROR', message } },
      { status }
    )
  }
}
