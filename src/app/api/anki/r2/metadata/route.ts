import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { FieldValue } from 'firebase-admin/firestore'
import { requireAuth } from '@/lib/auth/session'
import { requireR2Entitlement } from '@/lib/api/r2-entitlement'
import { adminDb } from '@/lib/firebase/admin'
import { buildDeckPrefix, isValidDeckKey } from '@/lib/r2/r2-keys'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MetadataSchema = z.object({
  deckId: z.string().min(1),
  name: z.string().min(1),
  cardCount: z.number().int().nonnegative(),
  hasMedia: z.boolean(),
  totalBytes: z.number().int().nonnegative(),
  origin: z.enum(['deckmarket']).optional(),
  r2: z.object({
    packageKey: z.string().min(1),
    manifestKey: z.string().min(1),
    mediaPrefix: z.string().min(1),
  }),
  originalFilename: z.string().optional(),
})

function getDb() {
  if (!adminDb) {
    throw new Error('Database not available')
  }
  return adminDb
}

function validateKeys(userId: string, deckId: string, r2: { packageKey: string; manifestKey: string; mediaPrefix: string }) {
  const prefix = buildDeckPrefix(userId, deckId)
  if (!isValidDeckKey(r2.packageKey, prefix)) return false
  if (!isValidDeckKey(r2.manifestKey, prefix)) return false
  if (!r2.mediaPrefix.startsWith(prefix)) return false
  return true
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const entitlement = await requireR2Entitlement(session)
    if (!entitlement.allowed && entitlement.reason === 'not_premium') {
      return NextResponse.json(
        { error: { code: 'PREMIUM_REQUIRED', message: 'Premium required' } },
        { status: 403 }
      )
    }
    const body = await request.json().catch(() => null)

    if (!body) {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } },
        { status: 400 }
      )
    }

    const parsed = MetadataSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid metadata payload',
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      )
    }

    const data = parsed.data
    if (!validateKeys(session.uid, data.deckId, data.r2)) {
      return NextResponse.json(
        { error: { code: 'INVALID_KEY', message: 'Invalid R2 key prefix' } },
        { status: 400 }
      )
    }

    const metadataDoc = {
      ...data,
      userId: session.uid,
      updatedAt: FieldValue.serverTimestamp(),
    }

    const jsonSize = Buffer.byteLength(JSON.stringify(metadataDoc), 'utf8')
    if (jsonSize > 100 * 1024) {
      return NextResponse.json(
        { error: { code: 'METADATA_TOO_LARGE', message: 'Metadata document exceeds 100KB' } },
        { status: 400 }
      )
    }

    const db = getDb()
    await db.collection('anki_r2_backups').doc(data.deckId).set(metadataDoc)

    return NextResponse.json({ success: true, deckId: data.deckId })
  } catch (error: any) {
    const message = error?.message || 'Failed to write metadata'
    const status = message === 'Authentication required' ? 401 : 500
    return NextResponse.json(
      { error: { code: 'METADATA_WRITE_ERROR', message } },
      { status }
    )
  }
}

const DeleteMetadataSchema = z.object({
  deckId: z.string().min(1),
})

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth()
    const entitlement = await requireR2Entitlement(session)
    if (!entitlement.allowed && entitlement.reason === 'not_premium') {
      return NextResponse.json(
        { error: { code: 'PREMIUM_REQUIRED', message: 'Premium required' } },
        { status: 403 }
      )
    }
    const body = await request.json().catch(() => null)
    const deckIdFromQuery = new URL(request.url).searchParams.get('deckId')
    const parsed = DeleteMetadataSchema.safeParse(body || { deckId: deckIdFromQuery })
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid delete request',
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      )
    }

    const { deckId } = parsed.data
    const db = getDb()

    // Verify ownership before deleting
    const doc = await db.collection('anki_r2_backups').doc(deckId).get()
    if (doc.exists && doc.data()?.userId !== session.uid) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Not authorized to delete this metadata' } },
        { status: 403 }
      )
    }

    const deckOrigin = doc.exists && doc.data()?.origin === 'deckmarket' ? 'deckmarket' : undefined

    await db.collection('anki_r2_backups').doc(deckId).delete()

    // Record deletion tombstone to prevent resurrection across devices
    const tombstone: Record<string, any> = {
      deletedAt: Date.now(),
    }
    if (deckOrigin) {
      tombstone.origin = deckOrigin
    }
    await db
      .collection('users')
      .doc(session.uid)
      .collection('deletedAnkiDecks')
      .doc(deckId)
      .set(tombstone)

    return NextResponse.json({ success: true, deckId })
  } catch (error: any) {
    const message = error?.message || 'Failed to delete metadata'
    const status = message === 'Authentication required' ? 401 : 500
    return NextResponse.json(
      { error: { code: 'METADATA_DELETE_ERROR', message } },
      { status }
    )
  }
}
