/**
 * Secure Unsubscribe Token Generation & Verification
 *
 * Uses HMAC-SHA256 for unforgeable tokens.
 * Tokens contain: email + expiration + signature
 */

import * as crypto from 'crypto'
import type {
  UnsubscribeTokenPayload,
  TokenVerificationResult,
  CreateTokenOptions,
} from './types'

// Secret key for HMAC signing - MUST be set in environment
const getSecretKey = (): string => {
  const secret = process.env.UNSUBSCRIBE_TOKEN_SECRET || process.env.JWT_SECRET
  if (!secret) {
    throw new Error(
      'UNSUBSCRIBE_TOKEN_SECRET or JWT_SECRET environment variable is required'
    )
  }
  return secret
}

/**
 * Generate SHA256 hash of an email for use as document ID
 * Normalizes email to lowercase before hashing
 */
export function hashEmail(email: string): string {
  return crypto
    .createHash('sha256')
    .update(email.toLowerCase().trim())
    .digest('hex')
}

/**
 * Create HMAC signature for token payload
 */
function createSignature(payload: UnsubscribeTokenPayload): string {
  const data = `${payload.email.toLowerCase()}:${payload.exp}:${payload.iat}`
  return crypto
    .createHmac('sha256', getSecretKey())
    .update(data)
    .digest('hex')
}

/**
 * Create a secure, HMAC-signed unsubscribe token
 *
 * Token format (base64url encoded JSON):
 * {
 *   "email": "user@example.com",
 *   "exp": 1735689600,
 *   "iat": 1735084800,
 *   "sig": "abc123..."
 * }
 *
 * @param email - Email address to create token for
 * @param options - Token options
 * @returns Base64url-encoded token string
 */
export function createUnsubscribeToken(
  email: string,
  options: CreateTokenOptions = {}
): string {
  const { expiresInDays = 7 } = options

  const now = Math.floor(Date.now() / 1000)
  const exp = now + expiresInDays * 24 * 60 * 60

  const payload: UnsubscribeTokenPayload = {
    email: email.toLowerCase().trim(),
    exp,
    iat: now,
  }

  const signature = createSignature(payload)

  // Combine payload with signature
  const tokenData = {
    ...payload,
    sig: signature,
  }

  // Encode as base64url (URL-safe base64)
  const jsonString = JSON.stringify(tokenData)
  const base64 = Buffer.from(jsonString).toString('base64')

  // Make URL-safe: replace + with -, / with _, remove =
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * Verify an unsubscribe token
 *
 * Checks:
 * 1. Token is valid base64url JSON
 * 2. HMAC signature matches
 * 3. Token has not expired
 *
 * @param token - The token to verify
 * @returns Verification result with payload if valid
 */
export function verifyUnsubscribeToken(token: string): TokenVerificationResult {
  try {
    // Restore base64 padding and standard characters
    let base64 = token.replace(/-/g, '+').replace(/_/g, '/')
    const padding = base64.length % 4
    if (padding) {
      base64 += '='.repeat(4 - padding)
    }

    // Decode and parse
    const jsonString = Buffer.from(base64, 'base64').toString('utf-8')
    const tokenData = JSON.parse(jsonString)

    // Extract fields
    const { email, exp, iat, sig } = tokenData

    if (!email || !exp || !iat || !sig) {
      return { valid: false, error: 'malformed' }
    }

    // Reconstruct expected signature
    const payload: UnsubscribeTokenPayload = { email, exp, iat }
    const expectedSignature = createSignature(payload)

    // Constant-time comparison to prevent timing attacks
    const sigBuffer = Buffer.from(sig, 'hex')
    const expectedBuffer = Buffer.from(expectedSignature, 'hex')

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      console.warn('[UnsubscribeToken] Invalid signature for email:', email)
      return { valid: false, error: 'invalid_signature' }
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000)
    if (exp < now) {
      console.warn('[UnsubscribeToken] Expired token for email:', email)
      return { valid: false, error: 'expired' }
    }

    return {
      valid: true,
      payload,
    }
  } catch (error) {
    console.error('[UnsubscribeToken] Verification error:', error)
    return { valid: false, error: 'malformed' }
  }
}

/**
 * Generate an unsubscribe URL for an email
 *
 * @param email - Email address
 * @param baseUrl - Base URL of the app (defaults to NEXT_PUBLIC_APP_URL)
 * @returns Full unsubscribe URL
 */
export function generateUnsubscribeUrl(email: string, baseUrl?: string): string {
  const appUrl = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.app'
  const token = createUnsubscribeToken(email)
  return `${appUrl}/api/email/unsubscribe?token=${token}`
}

/**
 * Generate a one-click unsubscribe URL (for List-Unsubscribe-Post header)
 * This endpoint accepts POST requests without any body
 *
 * @param email - Email address
 * @param baseUrl - Base URL of the app
 * @returns Full one-click unsubscribe URL
 */
export function generateOneClickUnsubscribeUrl(
  email: string,
  baseUrl?: string
): string {
  const appUrl = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.app'
  const token = createUnsubscribeToken(email)
  return `${appUrl}/api/email/unsubscribe/one-click?token=${token}`
}
