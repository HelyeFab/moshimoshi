/**
 * Error handling utilities for review API endpoints
 * Provides consistent error responses and logging
 */

import { NextResponse } from 'next/server'

/**
 * Standard API error codes
 */
export const ErrorCodes = {
  // Authentication & Authorization
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  ADMIN_REQUIRED: 'ADMIN_REQUIRED',
  PREMIUM_REQUIRED: 'PREMIUM_REQUIRED',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_BODY: 'INVALID_BODY',
  INVALID_QUERY: 'INVALID_QUERY',
  INVALID_PARAMS: 'INVALID_PARAMS',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Resource Errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',
  
  // Database Errors
  DB_ERROR: 'DB_ERROR',
  DB_CONNECTION: 'DB_CONNECTION',
  DB_TIMEOUT: 'DB_TIMEOUT',
  
  // Business Logic
  INVALID_STATE: 'INVALID_STATE',
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
  OPERATION_FAILED: 'OPERATION_FAILED',
  
  // Server Errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(
    public message: string,
    public code: ErrorCode,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Common error responses
 */
export const CommonErrors = {
  notFound: (resource: string) =>
    new ApiError(
      `${resource} not found`,
      ErrorCodes.NOT_FOUND,
      404
    ),
  
  alreadyExists: (resource: string) =>
    new ApiError(
      `${resource} already exists`,
      ErrorCodes.ALREADY_EXISTS,
      409
    ),
  
  invalidState: (message: string) =>
    new ApiError(
      message,
      ErrorCodes.INVALID_STATE,
      400
    ),
  
  limitExceeded: (limit: string) =>
    new ApiError(
      `${limit} limit exceeded`,
      ErrorCodes.LIMIT_EXCEEDED,
      400
    ),
  
  databaseError: (operation: string) =>
    new ApiError(
      `Database error during ${operation}`,
      ErrorCodes.DB_ERROR,
      500
    ),
  
  internalError: () =>
    new ApiError(
      'An internal error occurred',
      ErrorCodes.INTERNAL_ERROR,
      500
    ),
}

/**
 * Handle API errors and return appropriate response
 */
export function handleApiError(error: unknown): NextResponse {
  // Handle our custom API errors
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        ...(error.details && { details: error.details }),
      },
      { status: error.statusCode }
    )
  }
  
  // Handle Firebase errors
  if (error && typeof error === 'object' && 'code' in error) {
    const firebaseError = error as any
    
    // Map Firebase error codes to our error codes
    const errorMap: Record<string, { code: ErrorCode; status: number; message?: string }> = {
      'permission-denied': {
        code: ErrorCodes.AUTH_REQUIRED,
        status: 403,
        message: 'Permission denied',
      },
      'not-found': {
        code: ErrorCodes.NOT_FOUND,
        status: 404,
        message: 'Resource not found',
      },
      'already-exists': {
        code: ErrorCodes.ALREADY_EXISTS,
        status: 409,
        message: 'Resource already exists',
      },
      'resource-exhausted': {
        code: ErrorCodes.RATE_LIMIT_EXCEEDED,
        status: 429,
        message: 'Too many requests',
      },
      'unavailable': {
        code: ErrorCodes.SERVICE_UNAVAILABLE,
        status: 503,
        message: 'Service temporarily unavailable',
      },
    }
    
    const mapped = errorMap[firebaseError.code]
    if (mapped) {
      return NextResponse.json(
        {
          error: mapped.message || firebaseError.message,
          code: mapped.code,
        },
        { status: mapped.status }
      )
    }
  }
  
  // Handle standard JavaScript errors
  if (error instanceof Error) {
    console.error('Unhandled error:', error)
    
    // Don't expose internal error details in production
    const isDev = process.env.NODE_ENV === 'development'
    
    return NextResponse.json(
      {
        error: isDev ? error.message : 'An error occurred',
        code: ErrorCodes.INTERNAL_ERROR,
        ...(isDev && { stack: error.stack }),
      },
      { status: 500 }
    )
  }
  
  // Unknown error type
  console.error('Unknown error type:', error)
  
  return NextResponse.json(
    {
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    },
    { status: 500 }
  )
}

/**
 * Create a success response with consistent format
 */
export function successResponse<T>(
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
  })
}

/**
 * Create a paginated response
 */
export function paginatedResponse<T>(
  items: T[],
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
): NextResponse {
  return NextResponse.json({
    success: true,
    data: items,
    pagination: {
      total: pagination.total,
      limit: pagination.limit,
      offset: pagination.offset,
      hasMore: pagination.hasMore,
      page: Math.floor(pagination.offset / pagination.limit) + 1,
      totalPages: Math.ceil(pagination.total / pagination.limit),
    },
  })
}

/**
 * Log API errors for monitoring
 */
export async function logApiError(
  error: unknown,
  context: {
    endpoint: string
    method: string
    userId?: string
    [key: string]: any
  }
): Promise<void> {
  try {
    const errorDetails = {
      timestamp: new Date().toISOString(),
      ...context,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error,
    }
    
    // In production, this would send to a logging service
    console.error('API Error:', errorDetails)
    
    // Could also write to a log file or send to monitoring service
    // await sendToMonitoring(errorDetails)
  } catch (logError) {
    // Don't let logging errors break the application
    console.error('Failed to log error:', logError)
  }
}