// User logout endpoint
// Safely signs out users and invalidates their session

import { NextRequest, NextResponse } from 'next/server'
import { clearSession, getSession } from '@/lib/auth/session'
import { getSecurityHeaders } from '@/lib/auth/validation'
import { logAuditEvent, AuditEvent } from '@/lib/auth/audit'

export async function POST(request: NextRequest) {
  try {
    // Get client information for audit logging
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                     request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Get current session before clearing it
    const currentSession = await getSession()
    
    // Clear the session (blacklist token and clear cookie)
    await clearSession()

    // Log signout event
    if (currentSession) {
      await logAuditEvent(
        AuditEvent.SIGN_OUT,
        {
          userId: currentSession.uid,
          sessionId: currentSession.sessionId,
          ipAddress,
          userAgent,
          endpoint: '/api/auth/signout',
        },
        {
          email: currentSession.email,
          sessionDuration: 'unknown', // Could calculate if we stored session start time
        },
        'success'
      )
    }

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message: 'Signed out successfully',
      },
      { 
        status: 200,
        headers: getSecurityHeaders(),
      }
    )

  } catch (error) {
    console.error('Signout error:', error)
    
    // Still clear session even if audit logging fails
    try {
      await clearSession()
    } catch (clearError) {
      console.error('Failed to clear session during error handling:', clearError)
    }
    
    // Log system error
    await logAuditEvent(
      AuditEvent.SYSTEM_ERROR,
      {
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        endpoint: '/api/auth/signout',
      },
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'failure'
    )

    // Return success anyway since signout should be idempotent
    return NextResponse.json(
      {
        success: true,
        message: 'Signed out successfully',
      },
      { 
        status: 200,
        headers: getSecurityHeaders(),
      }
    )
  }
}

// Handle GET requests (some OAuth flows use GET for logout)
export async function GET(request: NextRequest) {
  try {
    // Get client information for audit logging
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                     request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Get current session before clearing it
    const currentSession = await getSession()
    
    // Clear the session
    await clearSession()

    // Log signout event
    if (currentSession) {
      await logAuditEvent(
        AuditEvent.SIGN_OUT,
        {
          userId: currentSession.uid,
          sessionId: currentSession.sessionId,
          ipAddress,
          userAgent,
          endpoint: '/api/auth/signout',
        },
        {
          email: currentSession.email,
          method: 'GET',
        },
        'success'
      )
    }

    // For GET requests, redirect to homepage or login page
    const redirectUrl = new URL('/', request.url)
    
    return NextResponse.redirect(redirectUrl, {
      status: 302,
      headers: getSecurityHeaders(),
    })

  } catch (error) {
    console.error('Signout (GET) error:', error)
    
    // Still clear session even if audit logging fails
    try {
      await clearSession()
    } catch (clearError) {
      console.error('Failed to clear session during error handling:', clearError)
    }
    
    // Redirect to homepage anyway
    const redirectUrl = new URL('/', request.url)
    return NextResponse.redirect(redirectUrl, {
      status: 302,
      headers: getSecurityHeaders(),
    })
  }
}

// All other methods not allowed
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