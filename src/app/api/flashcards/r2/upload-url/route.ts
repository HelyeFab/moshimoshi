import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAdminDb } from '@/lib/firebase/admin'
import { getR2Config } from '@/lib/r2/r2-client'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { z } from 'zod'
import { evaluateFeatureAccess, getUserPlan } from '@/lib/entitlements/server'

const UploadUrlSchema = z.object({
  deckId: z.string().min(1),
  key: z.string().min(1),
  contentType: z.string().optional(),
  deckTotalBytes: z.number().int().nonnegative().optional(),
})

function isValidUploadKey(key: string): boolean {
  if (key.startsWith('/')) return false
  if (key.includes('..')) return false
  if (key.includes('\\')) return false
  return true
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = getAdminDb()
    const plan = await getUserPlan(session.uid)
    const nowUtcISO = new Date().toISOString()
    const { decision } = await evaluateFeatureAccess({
      featureId: 'flashcards',
      userId: session.uid,
      plan,
      nowUtcISO
    })

    if (!decision.allow) {
      return NextResponse.json(
        {
          error: decision.reason === 'limit_reached' ? 'Daily limit reached' : 'Access denied',
          decision
        },
        { status: decision.reason === 'limit_reached' ? 429 : 403 }
      )
    }

    if (plan === 'free' || plan === 'guest') {
      return NextResponse.json({ error: 'Premium required for cloud backup' }, { status: 403 })
    }

    // 3. Validate request
    const body = await request.json()
    const validation = UploadUrlSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        error: 'Invalid request',
        details: validation.error.issues
      }, { status: 400 })
    }

    const { deckId, key, contentType, deckTotalBytes } = validation.data
    if (!isValidUploadKey(key)) {
      return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
    }

    // 4. Storage quota check (300MB per user)
    let usageDoc
    try {
      usageDoc = await db.collection('r2Usage').doc(session.uid).get()
    } catch (error) {
      console.error('[upload-url] Error fetching usage document:', error)
      return NextResponse.json({ error: 'Failed to check storage quota' }, { status: 500 })
    }

    const currentUsage = usageDoc.data()?.totalBytes || 0

    if (deckTotalBytes && currentUsage + deckTotalBytes > 300_000_000) {
      return NextResponse.json({
        error: 'R2_STORAGE_LIMIT_EXCEEDED',
        message: 'You have exceeded your 300MB storage limit',
        currentUsage,
        limit: 300_000_000
      }, { status: 413 })
    }

    // 5. Generate R2 key
    const r2Key = `users/${session.uid}/flashcards/${deckId}/${key}`

    // 6. Generate presigned URL (15 min expiry)
    let client, bucket
    try {
      const r2Config = getR2Config()
      client = r2Config.client
      bucket = r2Config.bucket
    } catch (error) {
      console.error('[upload-url] Error getting R2 config:', error)
      return NextResponse.json({ error: 'Failed to configure R2 client' }, { status: 500 })
    }

    let presignedUrl
    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: r2Key,
        ContentType: contentType || 'application/octet-stream',
      })

      presignedUrl = await getSignedUrl(client, command, { expiresIn: 900 })
    } catch (error) {
      console.error('[upload-url] Error generating presigned URL:', error)
      return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 })
    }

    return NextResponse.json({
      url: presignedUrl,
      key: r2Key,
      expiresIn: 900
    })
  } catch (error) {
    console.error('[upload-url] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
