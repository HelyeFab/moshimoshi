import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { requireAuth } from '@/lib/auth/session'
import { requireR2Entitlement } from '@/lib/api/r2-entitlement'
import { getR2Config } from '@/lib/r2/r2-client'
import { buildDeckPrefix, isValidDeckKey } from '@/lib/r2/r2-keys'
import { adminDb } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const LIMIT_BYTES = 300 * 1024 * 1024

const UploadUrlSchema = z.object({
  deckId: z.string().min(1),
  key: z.string().min(1),
  contentType: z.string().min(1).optional(),
  deckTotalBytes: z.number().int().nonnegative().optional(),
})

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

    const parsed = UploadUrlSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid upload request',
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      )
    }

    const { deckId, key, contentType, deckTotalBytes } = parsed.data
    const prefix = buildDeckPrefix(session.uid, deckId)

    if (!isValidDeckKey(key, prefix)) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_KEY',
            message: 'Key must be within the user deck prefix',
          },
        },
        { status: 400 }
      )
    }

    if (typeof deckTotalBytes === 'number' && key.endsWith('package.apkg')) {
      if (!adminDb) {
        throw new Error('Firebase Admin DB not initialized')
      }

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

      if (projectedBytes > LIMIT_BYTES) {
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
    }

    const { client, bucket, signedUrlTtlSeconds } = getR2Config()

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    })

    // Generate presigned URL (checksums disabled at client level)
    const url = await getSignedUrl(client, command, {
      expiresIn: signedUrlTtlSeconds,
    })

    return NextResponse.json({ url, expiresIn: signedUrlTtlSeconds, key })
  } catch (error: any) {
    const message = error?.message || 'Failed to create upload URL'
    const status = message === 'Authentication required' ? 401 : 500

    return NextResponse.json(
      { error: { code: 'UPLOAD_URL_ERROR', message } },
      { status }
    )
  }
}
