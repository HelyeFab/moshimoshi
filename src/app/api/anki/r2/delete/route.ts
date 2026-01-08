import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { requireAuth } from '@/lib/auth/session'
import { getR2Config } from '@/lib/r2/r2-client'
import { buildDeckPrefix } from '@/lib/r2/r2-keys'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DeleteDeckSchema = z.object({
  deckId: z.string().min(1),
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
    const prefix = buildDeckPrefix(session.uid, deckId)
    const { client, bucket } = getR2Config()

    console.log('[R2 Delete] Starting deletion:', { userId: session.uid, deckId, prefix, bucket })

    // List all objects with this deck's prefix
    const listCommand = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
    })

    const listResponse = await client.send(listCommand)
    const objects = listResponse.Contents || []

    console.log('[R2 Delete] Found objects to delete:', {
      count: objects.length,
      keys: objects.map(obj => obj.Key)
    })

    if (objects.length === 0) {
      console.log('[R2 Delete] No files found with prefix:', prefix)
      return NextResponse.json({
        success: true,
        deletedCount: 0,
        message: 'No files found to delete'
      })
    }

    // Delete all objects
    const deleteCommand = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: objects.map(obj => ({ Key: obj.Key! })),
        Quiet: false,
      },
    })

    const deleteResponse = await client.send(deleteCommand)

    const deletedCount = deleteResponse.Deleted?.length || 0
    const errors = deleteResponse.Errors || []

    console.log('[R2 Delete] Deletion complete:', {
      deletedCount,
      errorsCount: errors.length,
      errors: errors.length > 0 ? errors : undefined
    })

    if (errors.length > 0) {
      console.error('[R2 Delete] Some files failed to delete:', errors)
    }

    return NextResponse.json({
      success: true,
      deletedCount,
      errors: errors.length > 0 ? errors : undefined,
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
