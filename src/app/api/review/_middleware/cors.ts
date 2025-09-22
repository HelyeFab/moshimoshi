/**
 * CORS configuration for review API endpoints
 * Handles cross-origin requests safely
 */

import { NextRequest, NextResponse } from 'next/server'

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  // Add production domains here
].filter(Boolean) as string[]

// Allowed methods
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']

// Allowed headers
const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'X-User-Id',
  'X-User-Tier',
]

/**
 * Apply CORS headers to response
 */
export function setCorsHeaders(
  response: NextResponse,
  request: NextRequest
): NextResponse {
  const origin = request.headers.get('origin')
  
  // Check if origin is allowed
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
  } else if (process.env.NODE_ENV === 'development') {
    // Allow all origins in development
    response.headers.set('Access-Control-Allow-Origin', '*')
  }
  
  // Set other CORS headers
  response.headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '))
  response.headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '))
  response.headers.set('Access-Control-Max-Age', '86400') // 24 hours
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  
  return response
}

/**
 * Handle OPTIONS preflight requests
 */
export function handleOptions(request: NextRequest): NextResponse {
  const response = new NextResponse(null, { status: 204 })
  return setCorsHeaders(response, request)
}

/**
 * CORS middleware wrapper
 */
export async function withCors(
  request: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  // Handle preflight
  if (request.method === 'OPTIONS') {
    return handleOptions(request)
  }
  
  // Execute handler and add CORS headers
  const response = await handler()
  return setCorsHeaders(response, request)
}