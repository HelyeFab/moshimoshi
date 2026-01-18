// Magic link request endpoint
// Generates and sends passwordless authentication links

import { NextRequest, NextResponse } from 'next/server'
import { getSecurityHeaders } from '@/lib/auth/validation'

// Magic link email sending is handled by /api/auth/magic-link.

export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: {
        code: 'ENDPOINT_DEPRECATED',
        message: 'Use /api/auth/magic-link instead of /api/auth/magic-link/request',
      },
    },
    {
      status: 410,
      headers: getSecurityHeaders(),
    }
  )
}

// All other methods not allowed
export async function GET() {
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
