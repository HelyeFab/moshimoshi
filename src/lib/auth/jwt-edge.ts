// Edge-runtime compatible JWT utilities
// Uses base64 decoding without Node.js crypto module

export interface EdgeSessionPayload {
  uid: string
  email: string
  sid: string
  iat: number
  exp: number
  tier: string
  admin?: boolean
}

/**
 * Decode JWT token without verification (Edge Runtime compatible)
 * Used in middleware for basic token inspection
 */
export function decodeJWTForEdge(token: string): EdgeSessionPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    // Decode the payload (middle part)
    const payload = parts[1]
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decoded) as EdgeSessionPayload
  } catch (error) {
    console.error('[Edge JWT] Failed to decode token:', error)
    return null
  }
}

/**
 * Check if token is expired (Edge Runtime compatible)
 */
export function isTokenExpired(payload: EdgeSessionPayload): boolean {
  const now = Math.floor(Date.now() / 1000)
  return payload.exp <= now
}

/**
 * Basic token validation for Edge Runtime
 * Note: This does NOT verify the signature - that requires Node.js crypto
 * Use this only for preliminary checks in middleware
 */
export function validateTokenBasic(token: string): {
  valid: boolean
  payload?: EdgeSessionPayload
  reason?: string
} {
  try {
    const payload = decodeJWTForEdge(token)

    if (!payload) {
      return { valid: false, reason: 'invalid_format' }
    }

    if (!payload.uid || !payload.email || !payload.sid) {
      return { valid: false, reason: 'missing_fields' }
    }

    if (isTokenExpired(payload)) {
      return { valid: false, reason: 'expired' }
    }

    return { valid: true, payload }
  } catch (error) {
    return { valid: false, reason: 'decode_error' }
  }
}