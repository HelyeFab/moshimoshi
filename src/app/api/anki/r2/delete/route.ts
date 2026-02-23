import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { requireAuth } from '@/lib/auth/session'
import { requireR2Entitlement } from '@/lib/api/r2-entitlement'
import { getR2Config } from '@/lib/r2/r2-client'
import { buildDeckPrefix } from '@/lib/r2/r2-keys'
import { adminDb } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DeleteDeckSchema = z.object({
  deckId: z.string().min(1),
})

async function recordCleanupJob(params: {
  userId: string
  deckId: string
  prefix: string
  status: 'partial'
  r2FilesFound: number
  deletedCount: number
  errors?: Array<Record<string, unknown>>
  r2Error?: string
}) {
  if (!adminDb) return

  const now = Date.now()
  const jobRef = adminDb
    .collection('users')
    .doc(params.userId)
    .collection('ankiBackupCleanupJobs')
    .doc(params.deckId)

  await jobRef.set(
    {
      deckId: params.deckId,
      userId: params.userId,
      prefix: params.prefix,
      status: params.status,
      r2FilesFound: params.r2FilesFound,
      deletedCount: params.deletedCount,
      r2Errors: params.errors || [],
      r2Error: params.r2Error || null,
      metadataDeleted: true,
      tombstoneWritten: true,
      lastAttemptAt: now,
      updatedAt: now,
      createdAt: now,
      retryable: true,
    },
    { merge: true }
  )
}

async function clearCleanupJob(userId: string, deckId: string) {
  if (!adminDb) return
  await adminDb
    .collection('users')
    .doc(userId)
    .collection('ankiBackupCleanupJobs')
    .doc(deckId)
    .delete()
    .catch(() => {})
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

    const parsed = DeleteDeckSchema.safeParse(body)
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
    if (!adminDb) {
      throw new Error('Firebase Admin DB not initialized')
    }

    // Check metadata ownership before cleanup (same ownership model as /metadata DELETE)
    const metadataRef = adminDb.collection('anki_r2_backups').doc(deckId)
    const metadataDoc = await metadataRef.get()
    if (metadataDoc.exists && metadataDoc.data()?.userId !== session.uid) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Not authorized to delete this backup' } },
        { status: 403 }
      )
    }

    const existingOrigin =
      metadataDoc.exists && metadataDoc.data()?.origin === 'deckmarket' ? 'deckmarket' : undefined

    const tombstone: Record<string, unknown> = {
      deletedAt: Date.now(),
    }
    if (existingOrigin) {
      tombstone.origin = existingOrigin
    }

    // Critical invariant first: hide backup from listings / prevent resurrection
    await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('deletedAnkiDecks')
      .doc(deckId)
      .set(tombstone, { merge: true })
    await metadataRef.delete()

    const prefix = buildDeckPrefix(session.uid, deckId)
    const { client, bucket } = getR2Config()
    let deletedCount = 0
    let r2Errors: Array<Record<string, unknown>> = []
    let r2ErrorMessage: string | null = null
    let r2FilesFound = 0

    try {
      console.log('[R2 Delete] Starting deletion:', { userId: session.uid, deckId, prefix, bucket })

      // List all objects with this deck's prefix
      const listCommand = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
      })

      const listResponse = await client.send(listCommand)
      const objects = listResponse.Contents || []
      r2FilesFound = objects.length

      console.log('[R2 Delete] Found objects to delete:', {
        count: objects.length,
        keys: objects.map(obj => obj.Key)
      })

      if (objects.length === 0) {
        console.log('[R2 Delete] No files found with prefix:', prefix)
      } else {
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: objects.map(obj => ({ Key: obj.Key! })),
            Quiet: false,
          },
        })

        const deleteResponse = await client.send(deleteCommand)
        deletedCount = deleteResponse.Deleted?.length || 0
        r2Errors = (deleteResponse.Errors || []) as Array<Record<string, unknown>>

        console.log('[R2 Delete] Deletion complete:', {
          deletedCount,
          errorsCount: r2Errors.length,
          errors: r2Errors.length > 0 ? r2Errors : undefined
        })

        if (r2Errors.length > 0) {
          console.error('[R2 Delete] Some files failed to delete:', r2Errors)
        }
      }
    } catch (r2Error: any) {
      r2ErrorMessage = r2Error?.message || 'Failed to delete backup files from R2'
      console.error('[R2 Delete] R2 deletion partially failed after metadata/tombstone cleanup:', r2Error)
    }

    const status = r2ErrorMessage || r2Errors.length > 0 ? 'partial' : 'complete'

    if (status === 'partial') {
      await recordCleanupJob({
        userId: session.uid,
        deckId,
        prefix,
        status: 'partial',
        r2FilesFound,
        deletedCount,
        errors: r2Errors,
        r2Error: r2ErrorMessage || undefined,
      })
    } else {
      await clearCleanupJob(session.uid, deckId)
    }

    return NextResponse.json({
      success: true,
      status,
      deletedCount,
      r2FilesFound,
      errors: r2Errors.length > 0 ? r2Errors : undefined,
      r2Error: r2ErrorMessage || undefined,
      metadataDeleted: true,
      tombstoneWritten: true,
      message:
        status === 'complete'
          ? 'Backup deleted successfully'
          : 'Backup hidden and metadata removed, but some R2 files may still require cleanup',
    })
  } catch (error: any) {
    console.error('[R2 Delete] Failed to delete deck files:', error)
    const message = error?.message || 'Failed to delete backup files'
    const status = message === 'Authentication required' ? 401 : 500

    return NextResponse.json(
      { error: { code: 'DELETE_ERROR', message } },
      { status }
    )
  }
}
