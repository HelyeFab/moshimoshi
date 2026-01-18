// Magic link verification endpoint (deprecated)
// Legacy JWT/Redis flow is removed in favor of Firebase email-link verification on the client.

import { NextRequest, NextResponse } from 'next/server'
import { getSecurityHeaders } from '@/lib/auth/validation'

export async function GET(request: NextRequest) {
  const errorUrl = new URL('/auth/error', request.url)
  errorUrl.searchParams.set('code', 'INVALID_LINK')
  return NextResponse.redirect(errorUrl, { status: 302, headers: getSecurityHeaders() })
}

// All other methods not allowed
export async function POST() {
  return NextResponse.json(
    { error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } },
    { status: 405, headers: getSecurityHeaders() }
  )
}

export async function PUT() {
  return NextResponse.json(
    { error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } },
    { status: 405, headers: getSecurityHeaders() }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } },
    { status: 405, headers: getSecurityHeaders() }
  )
}

export async function PATCH() {
  return NextResponse.json(
    { error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } },
    { status: 405, headers: getSecurityHeaders() }
  )
}
