import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { requireAuth } from '@/lib/auth/session'
import { requireR2Entitlement } from '@/lib/api/r2-entitlement'
import { getR2Config } from '@/lib/r2/r2-client'
import { buildDeckPrefix, isValidDeckKey } from '@/lib/r2/r2-keys'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DownloadUrlsSchema = z.object({
  deckId: z.string().min(1),
  keys: z.array(z.string().min(1)).min(1),
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

    const parsed = DownloadUrlsSchema.safeParse(body)
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

    const { deckId, keys } = parsed.data
    const prefix = buildDeckPrefix(session.uid, deckId)

    const invalidKey = keys.find(key => !isValidDeckKey(key, prefix))
    if (invalidKey) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_KEY',
            message: 'Key must be within the user deck prefix',
            details: invalidKey,
          },
        },
        { status: 400 }
      )
    }

    const { client, bucket, signedUrlTtlSeconds } = getR2Config()
    const urls = await Promise.all(
      keys.map(async key => {
        const command = new GetObjectCommand({ Bucket: bucket, Key: key })
        const url = await getSignedUrl(client, command, { expiresIn: signedUrlTtlSeconds })
        return { key, url }
      })
    )

    return NextResponse.json({ urls, expiresIn: signedUrlTtlSeconds })
  } catch (error: any) {
    const message = error?.message || 'Failed to create download URLs'
    const status = message === 'Authentication required' ? 401 : 500

    return NextResponse.json(
      { error: { code: 'DOWNLOAD_URLS_ERROR', message } },
      { status }
    )
  }
}
