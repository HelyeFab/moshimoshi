/**
 * Request validation middleware using Zod schemas
 * Provides type-safe validation for API endpoints
 */

import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError, ZodSchema } from 'zod'

/**
 * Common validation schemas used across endpoints
 */
export const commonSchemas = {
  // Content type enum
  contentType: z.enum([
    'kana',
    'kanji',
    'vocabulary',
    'sentence',
    'phrase',
    'grammar',
    'custom',
  ]),
  
  // Priority levels
  priority: z.enum(['low', 'normal', 'high']),
  
  // Review status
  reviewStatus: z.enum(['new', 'learning', 'review', 'mastered']),
  
  // Session types
  sessionType: z.enum(['daily', 'quick', 'custom', 'test']),
  
  // Date string validation
  dateString: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
  
  // Pagination
  pagination: z.object({
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
  }),
  
  // Sort order
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
}

/**
 * Pin operation schemas
 */
export const pinSchemas = {
  pinSingle: z.object({
    contentType: commonSchemas.contentType,
    contentId: z.string().min(1),
    tags: z.array(z.string()).optional(),
    priority: commonSchemas.priority.optional(),
    setId: z.string().optional(),
  }),
  
  pinBulk: z.object({
    items: z.array(z.object({
      contentType: commonSchemas.contentType,
      contentId: z.string().min(1),
    })).min(1).max(1000),
    tags: z.array(z.string()).optional(),
    priority: commonSchemas.priority.optional(),
    releaseSchedule: z.enum(['immediate', 'gradual']).optional(),
    dailyLimit: z.number().min(1).max(100).optional(),
  }),
  
  unpin: z.object({
    itemIds: z.array(z.string().min(1)).min(1).max(1000),
  }),
  
  checkPinned: z.object({
    contentType: commonSchemas.contentType.optional(),
    contentIds: z.array(z.string()).min(1).max(100),
  }),
}

/**
 * Queue operation schemas
 */
export const queueSchemas = {
  getQueue: z.object({
    limit: z.number().min(1).max(100).default(20),
    type: commonSchemas.sessionType.optional(),
    contentType: commonSchemas.contentType.optional(),
  }),
  
  customQueue: z.object({
    filters: z.object({
      contentTypes: z.array(commonSchemas.contentType).optional(),
      tags: z.array(z.string()).optional(),
      status: z.array(commonSchemas.reviewStatus).optional(),
      dueByDate: commonSchemas.dateString.optional(),
    }).optional(),
    limit: z.number().min(1).max(100).default(20),
    order: z.enum(['due', 'random', 'difficulty', 'priority']).default('due'),
  }),
  
  queuePreview: z.object({
    days: z.number().min(1).max(30).default(7),
  }),
}

/**
 * Session operation schemas
 */
export const sessionSchemas = {
  startSession: z.object({
    type: commonSchemas.sessionType,
    itemIds: z.array(z.string()).optional(),
    settings: z.object({
      shuffleOrder: z.boolean().optional(),
      showTimer: z.boolean().optional(),
      allowSkip: z.boolean().optional(),
      maxItems: z.number().min(1).max(500).optional(),
    }).optional(),
  }),
  
  submitAnswer: z.object({
    itemId: z.string().min(1),
    correct: z.boolean(),
    responseTime: z.number().min(0),
    answerType: z.string().optional(),
    confidence: z.number().min(1).max(5).optional(),
    userAnswer: z.string().optional(),
  }),
  
  completeSession: z.object({
    feedback: z.string().max(1000).optional(),
    rating: z.number().min(1).max(5).optional(),
  }),
}

/**
 * Statistics operation schemas
 */
export const statsSchemas = {
  getStats: z.object({
    period: z.enum(['day', 'week', 'month', 'year', 'all']).default('week'),
    detailed: z.boolean().default(false),
    contentType: commonSchemas.contentType.optional(),
  }),
  
  heatmap: z.object({
    days: z.number().min(1).max(365).default(365),
  }),
  
  progress: z.object({
    contentType: commonSchemas.contentType.optional(),
    days: z.number().min(1).max(365).default(30),
  }),
}

/**
 * Review sets operation schemas
 */
export const setSchemas = {
  getSets: z.object({
    category: z.enum(['official', 'custom', 'shared']).optional(),
    includeProgress: z.boolean().default(false),
  }),
  
  createSet: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    itemIds: z.array(z.string()).optional(),
    contentFilters: z.object({
      types: z.array(commonSchemas.contentType).optional(),
      tags: z.array(z.string()).optional(),
      sources: z.array(z.string()).optional(),
    }).optional(),
    settings: z.object({
      dailyNewLimit: z.number().min(1).max(100).default(10),
      reviewOrder: z.enum(['sequential', 'random', 'difficulty']).default('random'),
      isPublic: z.boolean().default(false),
    }).optional(),
  }),
  
  updateSet: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    settings: z.object({
      dailyNewLimit: z.number().min(1).max(100).optional(),
      reviewOrder: z.enum(['sequential', 'random', 'difficulty']).optional(),
      isPublic: z.boolean().optional(),
    }).optional(),
  }),
  
  setItems: z.object({
    itemIds: z.array(z.string()).optional(),
    contentIds: z.array(z.string()).optional(),
  }).refine(data => data.itemIds || data.contentIds, {
    message: 'Either itemIds or contentIds must be provided',
  }),
  
  addPreset: z.object({
    presetId: z.string().min(1),
  }),
}

/**
 * Validate request body against a schema
 */
export async function validateBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<{ data: T | null; response?: NextResponse }> {
  try {
    const body = await request.json()
    const data = schema.parse(body)
    return { data }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        data: null,
        response: NextResponse.json(
          {
            error: 'Validation error',
            code: 'VALIDATION_ERROR',
            details: error.issues.map((e) => ({
              path: e.path.join('.'),
              message: e.message,
            })),
          },
          { status: 400 }
        ),
      }
    }
    
    return {
      data: null,
      response: NextResponse.json(
        {
          error: 'Invalid request body',
          code: 'INVALID_BODY',
        },
        { status: 400 }
      ),
    }
  }
}

/**
 * Validate query parameters against a schema
 */
export function validateQuery<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): { data: T | null; response?: NextResponse } {
  try {
    const { searchParams } = new URL(request.url)
    const params: Record<string, any> = {}
    
    searchParams.forEach((value, key) => {
      // Handle array parameters (e.g., ?ids=1&ids=2)
      if (params[key]) {
        if (Array.isArray(params[key])) {
          params[key].push(value)
        } else {
          params[key] = [params[key], value]
        }
      } else {
        // Try to parse numbers
        const numValue = Number(value)
        params[key] = !isNaN(numValue) && value !== '' ? numValue : value
      }
    })
    
    const data = schema.parse(params)
    return { data }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        data: null,
        response: NextResponse.json(
          {
            error: 'Invalid query parameters',
            code: 'INVALID_QUERY',
            details: error.issues.map((e) => ({
              path: e.path.join('.'),
              message: e.message,
            })),
          },
          { status: 400 }
        ),
      }
    }
    
    return {
      data: null,
      response: NextResponse.json(
        {
          error: 'Invalid query parameters',
          code: 'INVALID_QUERY',
        },
        { status: 400 }
      ),
    }
  }
}

/**
 * Validate path parameters
 */
export function validateParams<T>(
  params: any,
  schema: ZodSchema<T>
): { data: T | null; response?: NextResponse } {
  try {
    const data = schema.parse(params)
    return { data }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        data: null,
        response: NextResponse.json(
          {
            error: 'Invalid path parameters',
            code: 'INVALID_PARAMS',
            details: error.issues.map((e) => ({
              path: e.path.join('.'),
              message: e.message,
            })),
          },
          { status: 400 }
        ),
      }
    }
    
    return {
      data: null,
      response: NextResponse.json(
        {
          error: 'Invalid path parameters',
          code: 'INVALID_PARAMS',
        },
        { status: 400 }
      ),
    }
  }
}