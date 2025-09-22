/**
 * Error types for the Universal Review Engine
 * Custom error classes for different failure scenarios
 */

/**
 * Base error class for all review engine errors
 */
export class ReviewEngineError extends Error {
  /**
   * Error code for programmatic handling
   */
  public readonly code: string
  
  /**
   * Additional error details
   */
  public readonly details?: any
  
  /**
   * Timestamp when error occurred
   */
  public readonly timestamp: Date
  
  /**
   * Whether the error is recoverable
   */
  public readonly recoverable: boolean
  
  constructor(
    message: string,
    code: string,
    details?: any,
    recoverable: boolean = false
  ) {
    super(message)
    this.name = 'ReviewEngineError'
    this.code = code
    this.details = details
    this.timestamp = new Date()
    this.recoverable = recoverable
    
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ReviewEngineError)
    }
  }
  
  /**
   * Convert error to JSON for logging/serialization
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      recoverable: this.recoverable,
      stack: this.stack
    }
  }
}

/**
 * Error for validation failures
 */
export class ValidationError extends ReviewEngineError {
  constructor(
    message: string,
    details?: {
      field?: string
      value?: any
      expected?: any
      validationType?: string
    }
  ) {
    super(message, 'VALIDATION_ERROR', details, true)
    this.name = 'ValidationError'
  }
}

/**
 * Error for session-related issues
 */
export class SessionError extends ReviewEngineError {
  constructor(
    message: string,
    details?: {
      sessionId?: string
      status?: string
      action?: string
    }
  ) {
    super(message, 'SESSION_ERROR', details, false)
    this.name = 'SessionError'
  }
}

/**
 * Error for sync operations
 */
export class SyncError extends ReviewEngineError {
  constructor(
    message: string,
    details?: {
      operation?: string
      itemsAffected?: number
      retryable?: boolean
      conflictType?: string
    }
  ) {
    super(message, 'SYNC_ERROR', details, details?.retryable ?? true)
    this.name = 'SyncError'
  }
}

/**
 * Error for content-related issues
 */
export class ContentError extends ReviewEngineError {
  constructor(
    message: string,
    details?: {
      contentId?: string
      contentType?: string
      issue?: string
    }
  ) {
    super(message, 'CONTENT_ERROR', details, false)
    this.name = 'ContentError'
  }
}

/**
 * Error for configuration issues
 */
export class ConfigurationError extends ReviewEngineError {
  constructor(
    message: string,
    details?: {
      configKey?: string
      invalidValue?: any
      validOptions?: any[]
    }
  ) {
    super(message, 'CONFIG_ERROR', details, false)
    this.name = 'ConfigurationError'
  }
}

/**
 * Error for adapter-related issues
 */
export class AdapterError extends ReviewEngineError {
  constructor(
    message: string,
    details?: {
      adapterType?: string
      operation?: string
      sourceData?: any
    }
  ) {
    super(message, 'ADAPTER_ERROR', details, false)
    this.name = 'AdapterError'
  }
}

/**
 * Error for storage/persistence issues
 */
export class StorageError extends ReviewEngineError {
  constructor(
    message: string,
    details?: {
      storageType?: string
      operation?: string
      quota?: number
      used?: number
    }
  ) {
    super(message, 'STORAGE_ERROR', details, true)
    this.name = 'StorageError'
  }
}

/**
 * Error for network-related issues
 */
export class NetworkError extends ReviewEngineError {
  constructor(
    message: string,
    details?: {
      url?: string
      method?: string
      statusCode?: number
      offline?: boolean
    }
  ) {
    super(message, 'NETWORK_ERROR', details, true)
    this.name = 'NetworkError'
  }
}

/**
 * Error for timeout scenarios
 */
export class TimeoutError extends ReviewEngineError {
  constructor(
    message: string,
    details?: {
      operation?: string
      timeoutMs?: number
      elapsed?: number
    }
  ) {
    super(message, 'TIMEOUT_ERROR', details, true)
    this.name = 'TimeoutError'
  }
}

/**
 * Error for authentication/authorization issues
 */
export class AuthError extends ReviewEngineError {
  constructor(
    message: string,
    details?: {
      userId?: string
      required?: string[]
      provided?: string[]
    }
  ) {
    super(message, 'AUTH_ERROR', details, false)
    this.name = 'AuthError'
  }
}

/**
 * Error codes for common scenarios
 */
export const ERROR_CODES = {
  // Validation errors
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  TYPE_MISMATCH: 'TYPE_MISMATCH',
  OUT_OF_RANGE: 'OUT_OF_RANGE',
  
  // Session errors
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_ALREADY_ACTIVE: 'SESSION_ALREADY_ACTIVE',
  SESSION_LOCKED: 'SESSION_LOCKED',
  
  // Content errors
  CONTENT_NOT_FOUND: 'CONTENT_NOT_FOUND',
  CONTENT_TYPE_UNSUPPORTED: 'CONTENT_TYPE_UNSUPPORTED',
  CONTENT_CORRUPTED: 'CONTENT_CORRUPTED',
  
  // Sync errors
  SYNC_CONFLICT: 'SYNC_CONFLICT',
  SYNC_QUOTA_EXCEEDED: 'SYNC_QUOTA_EXCEEDED',
  SYNC_VERSION_MISMATCH: 'SYNC_VERSION_MISMATCH',
  
  // Storage errors
  STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
  STORAGE_CORRUPTED: 'STORAGE_CORRUPTED',
  
  // Network errors
  NETWORK_OFFLINE: 'NETWORK_OFFLINE',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  NETWORK_REQUEST_FAILED: 'NETWORK_REQUEST_FAILED',
  
  // Auth errors
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
} as const

/**
 * Type guard to check if an error is a ReviewEngineError
 */
export function isReviewEngineError(error: any): error is ReviewEngineError {
  return error instanceof ReviewEngineError
}

/**
 * Type guard to check if an error is recoverable
 */
export function isRecoverableError(error: any): boolean {
  return isReviewEngineError(error) && error.recoverable
}

/**
 * Helper to create a formatted error message
 */
export function formatErrorMessage(error: Error): string {
  if (isReviewEngineError(error)) {
    return `[${error.code}] ${error.message}`
  }
  return error.message
}