// JWT utilities for secure session management
// Provides JWT signing, verification, and token management

import jwt from 'jsonwebtoken'
const crypto = require('crypto')

// Environment variables - check at runtime not initialization for edge runtime
const JWT_SECRET = process.env.JWT_SECRET
const JWT_ISSUER = process.env.JWT_ISSUER || 'moshimoshi'
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'moshimoshi-app'

// Ensure JWT secret is properly configured
const getJWTSecret = (): string => {
  if (!JWT_SECRET) {
    // Critical security error - JWT_SECRET must be set
    const errorMessage = process.env.NODE_ENV === 'development'
      ? 'JWT_SECRET environment variable is required. Please set it in your .env.local file. Generate with: openssl rand -base64 32'
      : 'Authentication configuration error'

    console.error('[SECURITY] ' + errorMessage)
    throw new Error(errorMessage)
  }

  // Validate minimum length for security
  if (JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters for security')
  }

  return JWT_SECRET
}

// Session payload interface
export interface SessionPayload {
  // User identification
  uid: string
  email: string

  // Session metadata
  sid: string          // Session ID
  iat: number         // Issued at
  exp: number         // Expiration

  // User tier (optional - being phased out in favor of TierCache)
  // Made optional for gradual migration from JWT-embedded to Redis-cached tiers
  tier?: 'guest' | 'free' | 'premium_monthly' | 'premium_yearly'

  // Security
  fingerprint: string  // Browser fingerprint hash

  // Admin flag
  admin?: boolean
}

// JWT signing options
const JWT_SIGN_OPTIONS: jwt.SignOptions = {
  algorithm: 'HS256',
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
}

// JWT verify options
const JWT_VERIFY_OPTIONS: jwt.VerifyOptions = {
  algorithms: ['HS256'],
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
}

// Session validation result interface
export interface SessionValidation {
  valid: boolean
  payload?: SessionPayload
  reason?: string
  expiresIn?: number
}

/**
 * Generate a secure session ID
 */
export function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Generate browser fingerprint hash
 */
export function generateFingerprint(userAgent?: string, ip?: string): string {
  const data = `${userAgent || 'unknown'}-${ip || 'unknown'}-${Date.now()}`
  return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * Create a JWT session token
 */
export function createSessionToken(
  payload: Omit<SessionPayload, 'iat' | 'exp' | 'sid'>,
  duration: number = 3600000 // 1 hour in milliseconds
): string {
  const now = Math.floor(Date.now() / 1000)
  const exp = Math.floor((Date.now() + duration) / 1000)

  // Build payload, omitting tier if not provided (Phase 5 migration)
  const fullPayload: SessionPayload = {
    ...payload,
    sid: generateSessionId(),
    iat: now,
    exp,
  }

  // Don't use expiresIn option since we're setting exp in the payload
  return jwt.sign(fullPayload, getJWTSecret(), JWT_SIGN_OPTIONS)
}

/**
 * Verify and decode a JWT session token
 */
export function verifySessionToken(token: string): SessionValidation {
  try {
    let secret: string;
    try {
      secret = getJWTSecret();
    } catch (secretError) {
      console.error('[JWT] Failed to get JWT secret:', secretError);
      return { valid: false, reason: 'verification_failed' };
    }

    const decoded = jwt.verify(token, secret, JWT_VERIFY_OPTIONS) as unknown as SessionPayload

    // Additional validation
    if (!decoded.uid || !decoded.email || !decoded.sid) {
      return { valid: false, reason: 'invalid_payload' }
    }

    const expiresIn = (decoded.exp * 1000) - Date.now()
    if (expiresIn <= 0) {
      return { valid: false, reason: 'expired' }
    }

    return {
      valid: true,
      payload: decoded,
      expiresIn,
    }
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return { valid: false, reason: 'expired' }
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return { valid: false, reason: 'invalid_token' }
    }
    console.error('[JWT] Token verification error:', error);
    return { valid: false, reason: 'verification_failed' }
  }
}

/**
 * Decode JWT without verification (for checking blacklists)
 */
export function decodeSessionToken(token: string): SessionPayload | null {
  try {
    return jwt.decode(token) as SessionPayload
  } catch (error) {
    console.error('Error decoding token:', error)
    return null
  }
}

/**
 * Create a refresh token (longer duration, single use)
 */
export function createRefreshToken(
  userId: string, 
  sessionId: string,
  duration: number = 7 * 24 * 60 * 60 * 1000 // 7 days
): string {
  const payload = {
    type: 'refresh',
    uid: userId,
    sid: sessionId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor((Date.now() + duration) / 1000),
  }

  return jwt.sign(payload, getJWTSecret(), {
    ...JWT_SIGN_OPTIONS,
    expiresIn: Math.floor(duration / 1000),
  })
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): { valid: boolean; userId?: string; sessionId?: string } {
  try {
    const decoded = jwt.verify(token, getJWTSecret(), JWT_VERIFY_OPTIONS) as any
    
    if (decoded.type !== 'refresh' || !decoded.uid || !decoded.sid) {
      return { valid: false }
    }

    return {
      valid: true,
      userId: decoded.uid,
      sessionId: decoded.sid,
    }
  } catch (error) {
    return { valid: false }
  }
}

/**
 * Create a password reset token
 */
export function createPasswordResetToken(
  email: string,
  userId: string,
  duration: number = 60 * 60 * 1000 // 1 hour
): string {
  const payload = {
    type: 'password_reset',
    email,
    uid: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor((Date.now() + duration) / 1000),
  }

  return jwt.sign(payload, getJWTSecret(), {
    ...JWT_SIGN_OPTIONS,
    expiresIn: Math.floor(duration / 1000),
  })
}

/**
 * Verify password reset token
 */
export function verifyPasswordResetToken(token: string): { 
  valid: boolean; 
  email?: string; 
  userId?: string 
} {
  try {
    const decoded = jwt.verify(token, getJWTSecret(), JWT_VERIFY_OPTIONS) as any
    
    if (decoded.type !== 'password_reset' || !decoded.email || !decoded.uid) {
      return { valid: false }
    }

    return {
      valid: true,
      email: decoded.email,
      userId: decoded.uid,
    }
  } catch (error) {
    return { valid: false }
  }
}

/**
 * Create email verification token
 */
export function createEmailVerificationToken(
  email: string,
  userId: string,
  duration: number = 24 * 60 * 60 * 1000 // 24 hours
): string {
  const payload = {
    type: 'email_verification',
    email,
    uid: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor((Date.now() + duration) / 1000),
  }

  return jwt.sign(payload, getJWTSecret(), {
    ...JWT_SIGN_OPTIONS,
    expiresIn: Math.floor(duration / 1000),
  })
}

/**
 * Verify email verification token
 */
export function verifyEmailVerificationToken(token: string): { 
  valid: boolean; 
  email?: string; 
  userId?: string 
} {
  try {
    const decoded = jwt.verify(token, getJWTSecret(), JWT_VERIFY_OPTIONS) as any
    
    if (decoded.type !== 'email_verification' || !decoded.email || !decoded.uid) {
      return { valid: false }
    }

    return {
      valid: true,
      email: decoded.email,
      userId: decoded.uid,
    }
  } catch (error) {
    return { valid: false }
  }
}

/**
 * Extract user ID from any token type (without full verification)
 */
export function extractUserId(token: string): string | null {
  try {
    const decoded = jwt.decode(token) as any
    return decoded?.uid || null
  } catch {
    return null
  }
}

/**
 * Check if token is close to expiration (for refresh logic)
 */
export function isTokenNearExpiration(
  token: string, 
  thresholdMs: number = 15 * 60 * 1000 // 15 minutes
): boolean {
  try {
    const decoded = jwt.decode(token) as any
    if (!decoded?.exp) return false
    
    const expiresIn = (decoded.exp * 1000) - Date.now()
    return expiresIn <= thresholdMs && expiresIn > 0
  } catch {
    return false
  }
}

/**
 * Get token expiration time
 */
export function getTokenExpiration(token: string): Date | null {
  try {
    const decoded = jwt.decode(token) as any
    if (!decoded?.exp) return null
    
    return new Date(decoded.exp * 1000)
  } catch {
    return null
  }
}

/**
 * Token security utilities
 */
export const TokenSecurity = {
  // Constant time string comparison to prevent timing attacks
  constantTimeCompare: (a: string, b: string): boolean => {
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
  },

  // Generate cryptographically secure random token
  generateSecureToken: (length: number = 32): string => {
    return crypto.randomBytes(length).toString('hex')
  },

  // Hash sensitive data
  hashData: (data: string, salt?: string): string => {
    const actualSalt = salt || crypto.randomBytes(16).toString('hex')
    return crypto.pbkdf2Sync(data, actualSalt, 10000, 64, 'sha512').toString('hex')
  },
}