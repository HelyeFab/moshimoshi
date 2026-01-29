import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { redis } from '@/lib/redis/client'

export async function GET(_request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 })
    }

    const userDoc = await adminDb.collection('users').doc(session.uid).get()
    const userData = userDoc.data()
    if (!userData?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const sessionKeys = await redis.keys('session:*')
    const count = Array.isArray(sessionKeys) ? sessionKeys.length : 0

    let sampleKey: string | null = null
    let sampleTtl: number | null = null

    if (count > 0) {
      const firstKey = sessionKeys[0] as string
      sampleKey = firstKey.replace(/^session:/, 'session:****')
      sampleTtl = await redis.ttl(firstKey)
    }

    let redisHost: string | null = null
    if (process.env.UPSTASH_REDIS_REST_URL) {
      try {
        const url = new URL(process.env.UPSTASH_REDIS_REST_URL)
        redisHost = url.host
      } catch {
        redisHost = null
      }
    }

    const usingMockRedis =
      !process.env.UPSTASH_REDIS_REST_URL ||
      process.env.UPSTASH_REDIS_REST_URL.includes('mock')

    return NextResponse.json({
      success: true,
      data: {
        sessionCount: count,
        sampleKey,
        sampleTtl,
        redisHost,
        usingMockRedis,
        nodeEnv: process.env.NODE_ENV,
      },
      timestamp: new Date().toISOString(),
      note: 'Uses Redis KEYS for diagnostics; do not call frequently in production.',
    })
  } catch (error) {
    console.error('[Auth Sessions Debug] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch session diagnostics' },
      { status: 500 }
    )
  }
}
