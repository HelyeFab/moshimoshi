import { NextRequest, NextResponse } from 'next/server'
import { DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { requireAuth } from '@/lib/auth/session'
import { getR2Config } from '@/lib/r2/r2-client'
import { buildDeckPrefix } from '@/lib/r2/r2-keys'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * DELETE /api/anki/r2/cleanup
 * Deletes all R2 files for the authenticated user
 * Useful for cleaning up orphaned/duplicate files
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth()
    const { client, bucket } = getR2Config()

    // Build user prefix - this will match all decks for this user
    const userPrefix = `users/${session.uid}/decks/`

    console.log('[R2 Cleanup] Starting cleanup for user:', {
      userId: session.uid,
      prefix: userPrefix,
      bucket
    })

    // List all objects with this user's prefix
    let allObjects: { Key: string }[] = []
    let continuationToken: string | undefined

    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: userPrefix,
        ContinuationToken: continuationToken,
      })

      const listResponse = await client.send(listCommand)
      const objects = listResponse.Contents || []

      allObjects.push(...objects.map(obj => ({ Key: obj.Key! })))
      continuationToken = listResponse.NextContinuationToken

      console.log('[R2 Cleanup] Listed batch:', {
        batchSize: objects.length,
        totalSoFar: allObjects.length,
        hasMore: !!continuationToken
      })
    } while (continuationToken)

    console.log('[R2 Cleanup] Found total objects:', allObjects.length)

    if (allObjects.length === 0) {
      return NextResponse.json({
        success: true,
        deletedCount: 0,
        message: 'No files found to delete'
      })
    }

    // Delete in batches of 1000 (R2 limit)
    const BATCH_SIZE = 1000
    let totalDeleted = 0
    const errors: any[] = []

    for (let i = 0; i < allObjects.length; i += BATCH_SIZE) {
      const batch = allObjects.slice(i, i + BATCH_SIZE)

      console.log('[R2 Cleanup] Deleting batch:', {
        batchNumber: Math.floor(i / BATCH_SIZE) + 1,
        batchSize: batch.length
      })

      const deleteCommand = new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: batch,
          Quiet: false,
        },
      })

      const deleteResponse = await client.send(deleteCommand)

      totalDeleted += deleteResponse.Deleted?.length || 0

      if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
        errors.push(...deleteResponse.Errors)
        console.error('[R2 Cleanup] Batch errors:', deleteResponse.Errors)
      }
    }

    console.log('[R2 Cleanup] Cleanup complete:', {
      totalDeleted,
      totalErrors: errors.length
    })

    return NextResponse.json({
      success: true,
      deletedCount: totalDeleted,
      totalFiles: allObjects.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Return first 10 errors
      message: `Deleted ${totalDeleted} files from R2`
    })
  } catch (error: any) {
    console.error('[R2 Cleanup] Failed to cleanup:', error)
    const message = error?.message || 'Failed to cleanup R2 files'
    const status = message === 'Authentication required' ? 401 : 500

    return NextResponse.json(
      { error: { code: 'CLEANUP_ERROR', message } },
      { status }
    )
  }
}
