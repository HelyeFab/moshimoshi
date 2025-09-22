/**
 * Centralized error handling for all API endpoints
 * Provides consistent error responses and logging
 */

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

/**
 * Standard API error codes
 */
export const ErrorCodes = {
  // Authentication & Authorization
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  ADMIN_REQUIRED: 'ADMIN_REQUIRED',
  PREMIUM_REQUIRED: 'PREMIUM_REQUIRED',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_BODY: 'INVALID_BODY',
  INVALID_QUERY: 'INVALID_QUERY',
  INVALID_PARAMS: 'INVALID_PARAMS',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  
  // Resource Errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',
  RESOURCE_LOCKED: 'RESOURCE_LOCKED',
  
  // Database Errors
  DB_ERROR: 'DB_ERROR',
  DB_CONNECTION: 'DB_CONNECTION',
  DB_TIMEOUT: 'DB_TIMEOUT',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  
  // Business Logic
  INVALID_STATE: 'INVALID_STATE',
  PRECONDITION_FAILED: 'PRECONDITION_FAILED',
  OPERATION_FAILED: 'OPERATION_FAILED',
  DEPENDENCY_FAILED: 'DEPENDENCY_FAILED',
  
  // External Services
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  STRIPE_ERROR: 'STRIPE_ERROR',
  FIREBASE_ERROR: 'FIREBASE_ERROR',
  TTS_SERVICE_ERROR: 'TTS_SERVICE_ERROR',
  
  // Server Errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  error: {
    code: ErrorCode
    message: string
    details?: any
    timestamp: string
    requestId?: string
  }
}

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Error context for logging and debugging
 */
export interface ErrorContext {
  endpoint: string
  method: string
  userId?: string
  requestId?: string
  userAgent?: string
  ipAddress?: string
  [key: string]: any
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  error: unknown,
  context?: ErrorContext
): NextResponse {
  const timestamp = new Date().toISOString()
  const requestId = context?.requestId || generateRequestId()
  
  // Log error for monitoring
  logError(error, context)
  
  // Handle ApiError instances
  if (error instanceof ApiError) {
    return NextResponse.json<ErrorResponse>(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          timestamp,
          requestId,
        },
      },
      { status: error.statusCode }
    )
  }
  
  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return NextResponse.json<ErrorResponse>(
      {
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Validation failed',
          details: error.issues.map(err => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
          timestamp,
          requestId,
        },
      },
      { status: 400 }
    )
  }
  
  // Handle Firebase errors
  if (isFirebaseError(error)) {
    const { code, message, status } = mapFirebaseError(error)
    return NextResponse.json<ErrorResponse>(
      {
        error: {
          code,
          message,
          timestamp,
          requestId,
        },
      },
      { status }
    )
  }
  
  // Handle Stripe errors
  if (isStripeError(error)) {
    const { code, message, status } = mapStripeError(error)
    return NextResponse.json<ErrorResponse>(
      {
        error: {
          code,
          message,
          timestamp,
          requestId,
        },
      },
      { status }
    )
  }
  
  // Handle standard JavaScript errors
  if (error instanceof Error) {
    const isDev = process.env.NODE_ENV === 'development'
    
    return NextResponse.json<ErrorResponse>(
      {
        error: {
          code: ErrorCodes.INTERNAL_ERROR,
          message: isDev ? error.message : 'An error occurred',
          details: isDev ? { stack: error.stack } : undefined,
          timestamp,
          requestId,
        },
      },
      { status: 500 }
    )
  }
  
  // Unknown error type
  return NextResponse.json<ErrorResponse>(
    {
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message: 'An unexpected error occurred',
        timestamp,
        requestId,
      },
    },
    { status: 500 }
  )
}

/**
 * Common error factories
 */
export const Errors = {
  notFound: (resource: string) =>
    new ApiError(ErrorCodes.NOT_FOUND, `${resource} not found`, 404),
  
  unauthorized: (message = 'Authentication required') =>
    new ApiError(ErrorCodes.AUTH_REQUIRED, message, 401),
  
  forbidden: (message = 'Insufficient permissions') =>
    new ApiError(ErrorCodes.INSUFFICIENT_PERMISSIONS, message, 403),
  
  validation: (message: string, details?: any) =>
    new ApiError(ErrorCodes.VALIDATION_ERROR, message, 400, details),
  
  conflict: (message: string) =>
    new ApiError(ErrorCodes.CONFLICT, message, 409),
  
  rateLimit: (retryAfter?: number) =>
    new ApiError(
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      'Too many requests',
      429,
      { retryAfter }
    ),
  
  internal: (message = 'Internal server error') =>
    new ApiError(ErrorCodes.INTERNAL_ERROR, message, 500),
  
  serviceUnavailable: (message = 'Service temporarily unavailable') =>
    new ApiError(ErrorCodes.SERVICE_UNAVAILABLE, message, 503),
  
  methodNotAllowed: (method: string) =>
    new ApiError(
      ErrorCodes.METHOD_NOT_ALLOWED,
      `Method ${method} not allowed`,
      405
    ),
}

/**
 * Check if error is from Firebase
 */
function isFirebaseError(error: any): boolean {
  return error?.code?.startsWith('auth/') || 
         error?.code?.startsWith('firestore/') ||
         error?.code?.includes('firebase')
}

/**
 * Map Firebase error to standard error
 */
function mapFirebaseError(error: any): {
  code: ErrorCode
  message: string
  status: number
} {
  const errorMap: Record<string, { code: ErrorCode; status: number; message?: string }> = {
    'auth/user-not-found': {
      code: ErrorCodes.NOT_FOUND,
      status: 404,
      message: 'User not found',
    },
    'auth/wrong-password': {
      code: ErrorCodes.AUTH_INVALID,
      status: 401,
      message: 'Invalid credentials',
    },
    'auth/email-already-exists': {
      code: ErrorCodes.ALREADY_EXISTS,
      status: 409,
      message: 'Email already registered',
    },
    'auth/invalid-email': {
      code: ErrorCodes.VALIDATION_ERROR,
      status: 400,
      message: 'Invalid email address',
    },
    'auth/weak-password': {
      code: ErrorCodes.VALIDATION_ERROR,
      status: 400,
      message: 'Password is too weak',
    },
    'auth/too-many-requests': {
      code: ErrorCodes.RATE_LIMIT_EXCEEDED,
      status: 429,
      message: 'Too many attempts',
    },
    'permission-denied': {
      code: ErrorCodes.INSUFFICIENT_PERMISSIONS,
      status: 403,
      message: 'Permission denied',
    },
    'not-found': {
      code: ErrorCodes.NOT_FOUND,
      status: 404,
      message: 'Resource not found',
    },
  }
  
  const mapped = errorMap[error.code] || {
    code: ErrorCodes.FIREBASE_ERROR,
    status: 500,
  }
  
  return {
    code: mapped.code,
    message: mapped.message || error.message || 'Firebase error',
    status: mapped.status,
  }
}

/**
 * Check if error is from Stripe
 */
function isStripeError(error: any): boolean {
  return error?.type?.includes('Stripe') || error?.raw?.type?.includes('stripe')
}

/**
 * Map Stripe error to standard error
 */
function mapStripeError(error: any): {
  code: ErrorCode
  message: string
  status: number
} {
  const errorMap: Record<string, { code: ErrorCode; status: number; message?: string }> = {
    'card_declined': {
      code: ErrorCodes.STRIPE_ERROR,
      status: 402,
      message: 'Card declined',
    },
    'payment_intent_authentication_failure': {
      code: ErrorCodes.STRIPE_ERROR,
      status: 402,
      message: 'Payment authentication failed',
    },
    'subscription_payment_failed': {
      code: ErrorCodes.STRIPE_ERROR,
      status: 402,
      message: 'Subscription payment failed',
    },
  }
  
  const mapped = errorMap[error.code] || {
    code: ErrorCodes.STRIPE_ERROR,
    status: 402,
  }
  
  return {
    code: mapped.code,
    message: mapped.message || error.message || 'Payment error',
    status: mapped.status,
  }
}

/**
 * Log error for monitoring
 */
function logError(error: unknown, context?: ErrorContext): void {
  const errorLog = {
    timestamp: new Date().toISOString(),
    ...context,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error,
  }
  
  // In production, send to monitoring service
  if (process.env.NODE_ENV === 'production') {
    // TODO: Send to Sentry, DataDog, etc.
    console.error('[API Error]', JSON.stringify(errorLog))
  } else {
    console.error('[API Error]', errorLog)
  }
}

/**
 * Generate request ID for tracking
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Create success response with consistent format
 */
export function createSuccessResponse<T>(
  data: T,
  meta?: {
    message?: string
    count?: number
    nextCursor?: string
    [key: string]: any
  }
): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    ...(meta && { meta }),
    timestamp: new Date().toISOString(),
  })
}

/**
 * Create paginated response
 */
export function createPaginatedResponse<T>(
  items: T[],
  pagination: {
    total: number
    limit: number
    offset: number
  }
): NextResponse {
  const hasMore = pagination.offset + pagination.limit < pagination.total
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1
  const totalPages = Math.ceil(pagination.total / pagination.limit)
  
  return NextResponse.json({
    success: true,
    data: items,
    pagination: {
      total: pagination.total,
      limit: pagination.limit,
      offset: pagination.offset,
      currentPage,
      totalPages,
      hasMore,
    },
    timestamp: new Date().toISOString(),
  })
}

/**
 * Add standard security headers to response
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  
  return response
}