import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { requireAuth } from '@/lib/auth/session'
import { getR2Config } from '@/lib/r2/r2-client'
import { buildDeckPrefix, isValidDeckKey } from '@/lib/r2/r2-keys'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DownloadUrlSchema = z.object({
  deckId: z.string().min(1),
  key: z.string().min(1),
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

    const parsed = DownloadUrlSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid download request',
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      )
    }

    const { deckId, key } = parsed.data
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

    const { client, bucket, signedUrlTtlSeconds } = getR2Config()

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })

    const url = await getSignedUrl(client, command, {
      expiresIn: signedUrlTtlSeconds,
    })

    return NextResponse.json({ url, expiresIn: signedUrlTtlSeconds, key })
  } catch (error: any) {
    const message = error?.message || 'Failed to create download URL'
    const status = message === 'Authentication required' ? 401 : 500

    return NextResponse.json(
      { error: { code: 'DOWNLOAD_URL_ERROR', message } },
      { status }
    )
  }
}
