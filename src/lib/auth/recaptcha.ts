// Server-side reCAPTCHA verification

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY
const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify'

// Minimum score to pass (0.0 to 1.0, higher is more likely human)
const MIN_SCORE = 0.5

interface ReCaptchaResponse {
  success: boolean
  score?: number
  action?: string
  challenge_ts?: string
  hostname?: string
  'error-codes'?: string[]
}

export interface ReCaptchaVerifyResult {
  success: boolean
  score?: number
  error?: string
  isBot?: boolean
}

/**
 * Verify reCAPTCHA v3 token on the server
 */
export async function verifyReCaptcha(
  token: string | null | undefined,
  expectedAction?: string
): Promise<ReCaptchaVerifyResult> {
  // If reCAPTCHA is not configured, allow bypass in development
  if (!RECAPTCHA_SECRET_KEY || RECAPTCHA_SECRET_KEY.includes('YOUR_RECAPTCHA')) {
    console.warn('[ReCAPTCHA] Not configured - bypassing verification')
    return { success: true, score: 1.0 }
  }

  // If no token provided, fail
  if (!token) {
    console.warn('[ReCAPTCHA] No token provided')
    return {
      success: false,
      error: 'reCAPTCHA token is required',
      isBot: true
    }
  }

  try {
    const response = await fetch(RECAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: RECAPTCHA_SECRET_KEY,
        response: token,
      }).toString(),
    })

    const data: ReCaptchaResponse = await response.json()

    console.log('[ReCAPTCHA] Verification response:', {
      success: data.success,
      score: data.score,
      action: data.action,
    })

    if (!data.success) {
      return {
        success: false,
        error: `reCAPTCHA verification failed: ${data['error-codes']?.join(', ') || 'unknown'}`,
        isBot: true,
      }
    }

    // Check action matches (if expected action provided)
    if (expectedAction && data.action !== expectedAction) {
      console.warn(`[ReCAPTCHA] Action mismatch: expected ${expectedAction}, got ${data.action}`)
      return {
        success: false,
        error: 'reCAPTCHA action mismatch',
        score: data.score,
        isBot: true,
      }
    }

    // Check score threshold
    const score = data.score || 0
    if (score < MIN_SCORE) {
      console.warn(`[ReCAPTCHA] Low score: ${score} (threshold: ${MIN_SCORE})`)
      return {
        success: false,
        error: 'reCAPTCHA score too low - suspected bot',
        score,
        isBot: true,
      }
    }

    return {
      success: true,
      score,
      isBot: false,
    }
  } catch (error) {
    console.error('[ReCAPTCHA] Verification error:', error)
    return {
      success: false,
      error: 'reCAPTCHA verification request failed',
      isBot: false, // Don't block on network errors
    }
  }
}

/**
 * Check if reCAPTCHA is configured
 */
export function isReCaptchaConfigured(): boolean {
  return !!(RECAPTCHA_SECRET_KEY && !RECAPTCHA_SECRET_KEY.includes('YOUR_RECAPTCHA'))
}
