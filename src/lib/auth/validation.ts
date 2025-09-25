// Authentication validation schemas and sanitization utilities
// Provides input validation, sanitization, and type safety for auth operations

import { z } from 'zod'
import DOMPurify from 'isomorphic-dompurify'
import bcrypt from 'bcryptjs'

// Password strength requirements
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 128

// Email validation regex (more permissive than strict RFC)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

// Display name validation
const DISPLAY_NAME_MIN_LENGTH = 1
const DISPLAY_NAME_MAX_LENGTH = 50

// Common validation schemas
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .max(254, 'Email is too long')
  .refine((email) => EMAIL_REGEX.test(email), {
    message: 'Please enter a valid email address',
  })
  .transform((email) => email.toLowerCase().trim())

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must not exceed ${PASSWORD_MAX_LENGTH} characters`)
  .refine((password) => {
    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) return false
    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) return false
    // Check for at least one number
    if (!/\d/.test(password)) return false
    // Check for at least one special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return false
    return true
  }, {
    message: 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character',
  })

export const displayNameSchema = z
  .string()
  .min(DISPLAY_NAME_MIN_LENGTH, 'Display name is required')
  .max(DISPLAY_NAME_MAX_LENGTH, `Display name must not exceed ${DISPLAY_NAME_MAX_LENGTH} characters`)
  .refine((name) => {
    // Allow letters, numbers, spaces, and common punctuation
    return /^[a-zA-Z0-9\s\-_.]+$/.test(name)
  }, {
    message: 'Display name can only contain letters, numbers, spaces, hyphens, underscores, and periods',
  })
  .transform((name) => DOMPurify.sanitize(name.trim()))

// Optional display name schema for signup
export const optionalDisplayNameSchema = z
  .string()
  .max(DISPLAY_NAME_MAX_LENGTH, `Display name must not exceed ${DISPLAY_NAME_MAX_LENGTH} characters`)
  .refine((name) => {
    // If empty, it's valid for optional fields
    if (!name || name.trim() === '') return true
    // Otherwise apply the same validation
    return /^[a-zA-Z0-9\s\-_.]+$/.test(name)
  }, {
    message: 'Display name can only contain letters, numbers, spaces, hyphens, underscores, and periods',
  })
  .transform((name) => name ? DOMPurify.sanitize(name.trim()) : '')
  .optional()

// Authentication form schemas
export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: optionalDisplayNameSchema,
  termsAccepted: z.boolean().refine((val) => val === true, {
    message: 'You must accept the terms and conditions',
  }),
})

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
})

export const magicLinkRequestSchema = z.object({
  email: emailSchema,
})

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
})

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: passwordSchema,
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const updateProfileSchema = z.object({
  displayName: displayNameSchema.optional(),
  photoURL: z.string().url().optional().or(z.literal('')),
  bio: z.string().max(500).optional().transform((bio) => 
    bio ? DOMPurify.sanitize(bio.trim()) : bio
  ),
  preferences: z.object({
    language: z.enum(['en', 'ja']).optional(),
    notifications: z.object({
      email: z.boolean().optional(),
      push: z.boolean().optional(),
    }).optional(),
  }).optional(),
})

// Admin schemas
export const adminUserUpdateSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  updates: z.object({
    tier: z.enum(['guest', 'free', 'premium_monthly', 'premium_yearly']).optional(),
    userState: z.enum(['active', 'suspended', 'deleted']).optional(),
    admin: z.boolean().optional(),
  }),
})

// Type exports
export type SignUpData = z.infer<typeof signUpSchema>
export type SignInData = z.infer<typeof signInSchema>
export type MagicLinkRequestData = z.infer<typeof magicLinkRequestSchema>
export type PasswordResetRequestData = z.infer<typeof passwordResetRequestSchema>
export type PasswordResetConfirmData = z.infer<typeof passwordResetConfirmSchema>
export type ChangePasswordData = z.infer<typeof changePasswordSchema>
export type UpdateProfileData = z.infer<typeof updateProfileSchema>
export type AdminUserUpdateData = z.infer<typeof adminUserUpdateSchema>

// Validation helper functions
export const ValidationHelpers = {
  /**
   * Sanitize user input to prevent XSS attacks
   */
  sanitizeInput: (input: string): string => {
    return DOMPurify.sanitize(input.trim())
  },

  /**
   * Sanitize HTML content (for user-generated content)
   */
  sanitizeHTML: (html: string, allowedTags?: string[]): string => {
    const config = allowedTags ? {
      ALLOWED_TAGS: allowedTags,
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    } : {}
    
    return DOMPurify.sanitize(html, config)
  },

  /**
   * Validate email format (additional check)
   */
  isValidEmail: (email: string): boolean => {
    return EMAIL_REGEX.test(email)
  },

  /**
   * Check password strength
   */
  checkPasswordStrength: (password: string): {
    score: number; // 0-4
    feedback: string[];
    isStrong: boolean;
  } => {
    const feedback: string[] = []
    let score = 0

    if (password.length >= 8) score++
    else feedback.push('Use at least 8 characters')

    if (/[a-z]/.test(password)) score++
    else feedback.push('Add lowercase letters')

    if (/[A-Z]/.test(password)) score++
    else feedback.push('Add uppercase letters')

    if (/\d/.test(password)) score++
    else feedback.push('Add numbers')

    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++
    else feedback.push('Add special characters')

    return {
      score,
      feedback,
      isStrong: score >= 4,
    }
  },

  /**
   * Normalize email address
   */
  normalizeEmail: (email: string): string => {
    return email.toLowerCase().trim()
  },

  /**
   * Extract domain from email
   */
  getEmailDomain: (email: string): string => {
    return email.split('@')[1]?.toLowerCase() || ''
  },

  /**
   * Check if email domain is disposable
   */
  isDisposableEmailDomain: (domain: string): boolean => {
    // Common disposable email domains
    const disposableDomains = [
      '10minutemail.com',
      'mailinator.com',
      'guerrillamail.com',
      'tempmail.org',
      'temp-mail.org',
      'throwaway.email',
    ]
    
    return disposableDomains.includes(domain.toLowerCase())
  },

  /**
   * Generate safe display name from email
   */
  generateDisplayNameFromEmail: (email: string): string => {
    const localPart = email.split('@')[0]
    // Remove numbers and special characters, capitalize first letter
    const safeName = localPart
      .replace(/[^a-zA-Z]/g, '')
      .replace(/^\w/, (c) => c.toUpperCase())
    
    return safeName || 'User'
  },
}

// Password hashing utilities
export const PasswordUtils = {
  /**
   * Hash password with bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12 // High security
    return bcrypt.hash(password, saltRounds)
  },

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  },

  /**
   * Generate secure random password
   */
  generateSecurePassword(length: number = 16): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-='
    let password = ''
    
    // Ensure at least one character from each category
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]
    password += '0123456789'[Math.floor(Math.random() * 10)]
    password += '!@#$%^&*()_+-='[Math.floor(Math.random() * 13)]
    
    // Fill remaining length
    for (let i = password.length; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)]
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('')
  },
}

// Error formatting
export interface ValidationError {
  field: string
  message: string
  code?: string
}

export function formatZodErrors(error: z.ZodError): ValidationError[] {
  if (!error || !error.issues) {
    return [{
      field: 'unknown',
      message: 'Validation error',
      code: 'VALIDATION_ERROR'
    }]
  }
  return error.issues.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }))
}

// Security headers for API responses
export function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  }
}

// CSRF token validation
export function validateCSRFToken(token: string, sessionToken: string): boolean {
  // Simple implementation - in production, use more sophisticated CSRF protection
  const expectedToken = Buffer.from(sessionToken).toString('base64').slice(0, 32)
  return token === expectedToken
}

// Input length limits for different fields
export const InputLimits = {
  EMAIL_MAX: 254,
  PASSWORD_MIN: PASSWORD_MIN_LENGTH,
  PASSWORD_MAX: PASSWORD_MAX_LENGTH,
  DISPLAY_NAME_MIN: DISPLAY_NAME_MIN_LENGTH,
  DISPLAY_NAME_MAX: DISPLAY_NAME_MAX_LENGTH,
  BIO_MAX: 500,
  REFERRAL_CODE_MAX: 20,
} as const

// Common regex patterns
export const ValidationPatterns = {
  EMAIL: EMAIL_REGEX,
  SAFE_STRING: /^[a-zA-Z0-9\s\-_.]+$/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  HEX_COLOR: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
  URL: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
} as const