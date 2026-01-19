import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis/client'

export const runtime = 'nodejs'

const DEBUG_KEYS = {
  lastError: 'debug:auth:google:last_error',
  lastSuccess: 'debug:auth:google:last_success',
}

function isAuthorized(request: NextRequest): boolean {
  const token = request.nextUrl.searchParams.get('token') || request.headers.get('x-debug-token')
  const expected = process.env.DEBUG_ADMIN_TOKEN
  if (!expected || !token) return false
  return token === expected
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [errorRaw, successRaw] = await redis.mget(
      DEBUG_KEYS.lastError,
      DEBUG_KEYS.lastSuccess
    )

    const lastError = errorRaw ? JSON.parse(errorRaw as string) : null
    const lastSuccess = successRaw ? JSON.parse(successRaw as string) : null

    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ''
    const secretKey = process.env.RECAPTCHA_SECRET_KEY || ''
    const mask = (value: string) => {
      if (!value) return ''
      if (value.length <= 8) return '*'.repeat(value.length)
      return `${value.slice(0, 4)}…${value.slice(-4)}`
    }

    return NextResponse.json(
      {
        lastError,
        lastSuccess,
        env: {
          NEXT_PUBLIC_RECAPTCHA_SITE_KEY: mask(siteKey),
          RECAPTCHA_SECRET_KEY: secretKey ? `set (${secretKey.length} chars)` : 'missing',
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch debug info' },
      { status: 500 }
    )
  }
}
