import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { requireR2Entitlement } from '@/lib/api/r2-entitlement'
import { adminDb } from '@/lib/firebase/admin'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getR2Config } from '@/lib/r2/r2-client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const LIMIT_BYTES = 300 * 1024 * 1024

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const entitlement = await requireR2Entitlement(session)
    if (!entitlement.allowed && entitlement.reason === 'not_premium') {
      return NextResponse.json(
        { error: { code: 'PREMIUM_REQUIRED', message: 'Premium required' } },
        { status: 403 }
      )
    }

    if (!adminDb) {
      throw new Error('Firebase Admin DB not initialized')
    }

    const snapshot = await adminDb
      .collection('anki_r2_backups')
      .where('userId', '==', session.uid)
      .get()

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    const deletedSnapshot = await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('deletedAnkiDecks')
      .where('deletedAt', '>', thirtyDaysAgo)
      .get()
    const deletedDeckIdSet = new Set(deletedSnapshot.docs.map(doc => doc.id))

    const { client, bucket } = getR2Config()

    const streamToString = async (body: any): Promise<string> => {
      if (!body) return ''
      if (typeof body === 'string') return body
      const chunks: Uint8Array[] = []
      for await (const chunk of body) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
      }
      return Buffer.concat(chunks).toString('utf8')
    }

    let usedBytes = 0

    for (const doc of snapshot.docs) {
      if (deletedDeckIdSet.has(doc.id)) {
        continue
      }
      const data = doc.data() as { totalBytes?: number; r2?: { manifestKey?: string } }
      if (typeof data.totalBytes === 'number') {
        usedBytes += data.totalBytes
        continue
      }

      const manifestKey = data.r2?.manifestKey
      if (!manifestKey) continue

      try {
        const response = await client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: manifestKey,
          })
        )
        const body = await streamToString(response.Body)
        const manifest = JSON.parse(body) as { files?: Array<{ size?: number }> }
        const manifestFiles = manifest.files || []
        const manifestBytes = Buffer.byteLength(body, 'utf8')
        const deckBytes =
          manifestFiles.reduce((sum, file) => sum + (file.size || 0), 0) + manifestBytes

        usedBytes += deckBytes

        await doc.ref.set({ totalBytes: deckBytes }, { merge: true })
      } catch (error) {
        // Skip if manifest fetch fails; usage will be undercounted until next time.
      }
    }

    return NextResponse.json({ usedBytes, limitBytes: LIMIT_BYTES })
  } catch (error: any) {
    const message = error?.message || 'Failed to fetch usage'
    const status = message === 'Authentication required' ? 401 : 500

    return NextResponse.json(
      { error: { code: 'USAGE_FETCH_ERROR', message } },
      { status }
    )
  }
}
