import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore } from '@/lib/firebase/admin'
import { redis } from '@/lib/redis/client'

export const runtime = 'nodejs'

const DEBUG_KEYS = {
  lastError: 'debug:auth:google:last_error',
  lastSuccess: 'debug:auth:google:last_success',
}

export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userDoc = await adminFirestore!.collection('users').doc(session.uid).get()
    const userData = userDoc?.data()
    if (!userData?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    let lastError: any = null
    let lastSuccess: any = null

    try {
      const [errorRaw, successRaw] = await redis.mget(
        DEBUG_KEYS.lastError,
        DEBUG_KEYS.lastSuccess
      )
      if (errorRaw) {
        lastError = JSON.parse(errorRaw as string)
      }
      if (successRaw) {
        lastSuccess = JSON.parse(successRaw as string)
      }
    } catch (redisError) {
      return NextResponse.json(
        { error: 'Failed to read debug info from Redis' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        lastError,
        lastSuccess,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch debug info' },
      { status: 500 }
    )
  }
}
