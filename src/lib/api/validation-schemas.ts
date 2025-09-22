/**
 * Centralized validation schemas for all API endpoints
 * Ensures consistent validation across the entire API surface
 */

import { z } from 'zod'

// ============================================
// Common Schemas & Utilities
// ============================================

export const commonSchemas = {
  // UUID validation
  uuid: z.string().uuid(),
  
  // Pagination
  pagination: z.object({
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
    cursor: z.string().optional(),
  }),
  
  // Sort order
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  
  // Date range
  dateRange: z.object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  }),
  
  // Language codes
  language: z.enum(['en', 'ja', 'es', 'fr', 'de', 'zh', 'ko']),
  
  // File upload
  fileUpload: z.object({
    filename: z.string().max(255),
    mimetype: z.string().max(100),
    size: z.number().max(10 * 1024 * 1024), // 10MB max
  }),
}

// ============================================
// Admin API Schemas
// ============================================

export const adminSchemas = {
  // GET /api/admin/stats
  getStats: z.object({
    period: z.enum(['day', 'week', 'month', 'year', 'all']).default('week'),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    metrics: z.array(z.enum([
      'users',
      'sessions',
      'reviews',
      'revenue',
      'retention',
      'engagement'
    ])).optional(),
  }),
  
  // POST /api/admin/init
  initAdmin: z.object({
    adminKey: z.string().min(32),
    forceReinit: z.boolean().default(false),
  }),
}

// ============================================
// TTS (Text-to-Speech) API Schemas
// ============================================

export const ttsSchemas = {
  // POST /api/tts/synthesize
  synthesize: z.object({
    text: z.string().min(1).max(5000),
    language: z.enum(['ja', 'en']).default('ja'),
    voice: z.string().optional(),
    speed: z.number().min(0.5).max(2.0).default(1.0),
    pitch: z.number().min(-20).max(20).default(0),
  }),
  
  // POST /api/tts/batch
  batch: z.object({
    items: z.array(z.object({
      id: z.string(),
      text: z.string().min(1).max(5000),
      language: z.enum(['ja', 'en']).default('ja'),
      voice: z.string().optional(),
    })).min(1).max(100),
    priority: z.enum(['low', 'normal', 'high']).default('normal'),
  }),
  
  // POST /api/tts/preload
  preload: z.object({
    contentType: z.enum(['kana', 'kanji', 'vocabulary', 'sentence']),
    contentIds: z.array(z.string()).min(1).max(1000),
    priority: z.enum(['low', 'normal', 'high']).default('normal'),
  }),
  
  // GET /api/tts/cache/check
  cacheCheck: z.object({
    hash: z.string().optional(),
    text: z.string().optional(),
  }).refine(data => data.hash || data.text, {
    message: 'Either hash or text must be provided',
  }),
  
  // GET /api/tts/cache/stats
  cacheStats: z.object({
    detailed: z.coerce.boolean().default(false),
  }),
}

// ============================================
// User API Schemas
// ============================================

export const userSchemas = {
  // GET/PATCH /api/user/profile
  getProfile: z.object({
    includeStats: z.coerce.boolean().default(false),
    includeSubscription: z.coerce.boolean().default(false),
  }),
  
  updateProfile: z.object({
    displayName: z.string().min(1).max(50).optional(),
    bio: z.string().max(500).optional(),
    profileImage: z.string().url().optional(),
    preferences: z.object({
      language: commonSchemas.language.optional(),
      theme: z.enum(['light', 'dark', 'system']).optional(),
      notifications: z.object({
        email: z.boolean().optional(),
        push: z.boolean().optional(),
        daily: z.boolean().optional(),
      }).optional(),
      learning: z.object({
        dailyGoal: z.number().min(1).max(500).optional(),
        reminderTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
        difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
      }).optional(),
    }).optional(),
  }),
  
  // POST /api/user/delete-account
  deleteAccount: z.object({
    confirmation: z.literal('DELETE'),
    password: z.string().min(1),
    reason: z.string().max(500).optional(),
    feedback: z.string().max(1000).optional(),
  }),
  
  // POST /api/user/export-data
  exportData: z.object({
    format: z.enum(['json', 'csv', 'pdf']).default('json'),
    includeProgress: z.boolean().default(true),
    includeSettings: z.boolean().default(true),
    includeAnalytics: z.boolean().default(false),
  }),
}

// ============================================
// Session API Schemas
// ============================================

export const sessionSchemas = {
  // GET /api/review/sessions
  getSessions: z.object({
    ...commonSchemas.pagination.shape,
    status: z.enum(['active', 'completed', 'abandoned']).optional(),
    dateRange: commonSchemas.dateRange.optional(),
    sortBy: z.enum(['date', 'duration', 'score', 'items']).default('date'),
    sortOrder: commonSchemas.sortOrder,
  }),
  
  // GET /api/review/sessions/[sessionId]
  getSession: z.object({
    includeItems: z.coerce.boolean().default(true),
    includeAnalytics: z.coerce.boolean().default(false),
  }),
}

// ============================================
// Auth API Schemas (Additional)
// ============================================

export const authSchemas = {
  // POST /api/auth/google
  googleAuth: z.object({
    idToken: z.string().min(1),
    returnUrl: z.string().url().optional(),
  }),
  
  // POST /api/auth/login
  login: z.object({
    idToken: z.string().min(1),
  }),
  
  // POST /api/auth/logout & /api/auth/signout
  logout: z.object({
    everywhere: z.boolean().default(false),
  }),
  
  // POST /api/auth/refresh
  refresh: z.object({
    refreshToken: z.string().min(1),
  }),
  
  // GET /api/auth/session
  getSession: z.object({
    extended: z.coerce.boolean().default(false),
  }),
  
  // POST /api/auth/magic-link/verify
  verifyMagicLink: z.object({
    token: z.string().min(1),
    deviceId: z.string().optional(),
  }),
}

// ============================================
// Validation Helper Functions
// ============================================

/**
 * Validate request body with proper error handling
 */
export async function validateRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ data: T | null; error?: any }> {
  try {
    const body = await request.json()
    const data = schema.parse(body)
    return { data }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: error.issues.map(err => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        },
      }
    }
    return {
      data: null,
      error: {
        code: 'INVALID_BODY',
        message: 'Failed to parse request body',
      },
    }
  }
}

/**
 * Validate URL search params
 */
export function validateSearchParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): { data: T | null; error?: any } {
  try {
    const params: Record<string, any> = {}
    searchParams.forEach((value, key) => {
      if (params[key]) {
        if (Array.isArray(params[key])) {
          params[key].push(value)
        } else {
          params[key] = [params[key], value]
        }
      } else {
        params[key] = value
      }
    })
    
    const data = schema.parse(params)
    return { data }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        data: null,
        error: {
          code: 'INVALID_QUERY',
          message: 'Invalid query parameters',
          details: error.issues.map(err => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        },
      }
    }
    return {
      data: null,
      error: {
        code: 'INVALID_QUERY',
        message: 'Failed to parse query parameters',
      },
    }
  }
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
}

/**
 * Validate and sanitize JSON input
 */
export function sanitizeJSON(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeString(obj)
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeJSON)
  }
  if (obj && typeof obj === 'object') {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(obj)) {
      sanitized[sanitizeString(key, 100)] = sanitizeJSON(value)
    }
    return sanitized
  }
  return obj
}

// Type exports
export type AdminStatsQuery = z.infer<typeof adminSchemas.getStats>
export type TTSSynthesizeBody = z.infer<typeof ttsSchemas.synthesize>
export type TTSBatchBody = z.infer<typeof ttsSchemas.batch>
export type UserProfileUpdate = z.infer<typeof userSchemas.updateProfile>
export type UserDeleteAccount = z.infer<typeof userSchemas.deleteAccount>
export type UserExportData = z.infer<typeof userSchemas.exportData>