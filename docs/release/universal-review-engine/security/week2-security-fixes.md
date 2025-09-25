# Week 2 Security Implementation Plan

## Agent 5: Security & Documentation Specialist
## Timeline: Week 2 (Days 6-10)

---

## Priority Security Fixes

### Day 6: Critical Security Patches

#### 1. API Input Validation Implementation
**Time Estimate**: 4 hours
**Files to Modify**:
- `/src/app/api/review/_middleware/validation.ts`
- All route handlers in `/src/app/api/review/**/*.ts`

**Implementation**:
```typescript
// src/app/api/review/_middleware/validation.ts
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'

// Validation schemas
export const schemas = {
  pinContent: z.object({
    contentType: z.enum(['kana', 'kanji', 'vocabulary', 'sentence', 'custom']),
    contentId: z.string().min(1).max(100).regex(/^[a-zA-Z0-9-_]+$/),
    tags: z.array(z.string().max(50)).max(10).optional(),
    priority: z.enum(['low', 'normal', 'high']).optional().default('normal')
  }),
  
  bulkPin: z.object({
    items: z.array(z.object({
      contentType: z.string(),
      contentId: z.string()
    })).min(1).max(1000),
    tags: z.array(z.string()).max(10).optional(),
    priority: z.enum(['low', 'normal', 'high']).optional(),
    releaseSchedule: z.enum(['immediate', 'gradual']).optional(),
    dailyLimit: z.number().min(1).max(100).optional()
  }),
  
  submitAnswer: z.object({
    itemId: z.string().uuid(),
    answer: z.string().min(1).max(500),
    responseTime: z.number().min(0).max(300000), // Max 5 minutes
    confidence: z.number().min(1).max(5).optional(),
    hintsUsed: z.number().min(0).max(10).optional()
  })
}

export async function validateRequest<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<T | NextResponse> {
  try {
    const body = await request.json()
    const validated = schema.parse(body)
    return validated
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
}

// SQL injection prevention
export function sanitizeForDatabase(input: string): string {
  // Remove SQL keywords and special characters
  const dangerous = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC|SCRIPT|JAVASCRIPT|ALERT|CONFIRM|PROMPT)\b|[;<>'"\\])/gi
  return input.replace(dangerous, '')
}

// XSS prevention
export function sanitizeForDisplay(input: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  }
  return input.replace(/[&<>"'/]/g, (char) => map[char])
}
```

#### 2. Rate Limiting Implementation
**Time Estimate**: 3 hours
**Files to Create/Modify**:
- `/src/app/api/review/_middleware/rateLimit.ts`
- `/src/lib/redis/rate-limiter.ts`

**Implementation**:
```typescript
// src/lib/redis/rate-limiter.ts
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'
import { NextRequest, NextResponse } from 'next/server'

// Configure rate limiters for different endpoints
export const rateLimiters = {
  // Standard API rate limit: 30 requests per minute
  standard: new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(30, '1 m'),
    analytics: true,
    prefix: 'ratelimit:standard'
  }),
  
  // Bulk operations: 5 requests per minute
  bulk: new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, '1 m'),
    analytics: true,
    prefix: 'ratelimit:bulk'
  }),
  
  // Session creation: 10 per hour
  session: new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    analytics: true,
    prefix: 'ratelimit:session'
  }),
  
  // Auth attempts: 5 per 15 minutes
  auth: new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, '15 m'),
    analytics: true,
    prefix: 'ratelimit:auth'
  })
}

export async function applyRateLimit(
  request: NextRequest,
  limiterType: keyof typeof rateLimiters = 'standard'
): Promise<NextResponse | null> {
  const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? 'anonymous'
  const limiter = rateLimiters[limiterType]
  
  const { success, limit, reset, remaining } = await limiter.limit(ip)
  
  if (!success) {
    return new NextResponse('Rate limit exceeded', {
      status: 429,
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': new Date(reset).toISOString(),
        'Retry-After': Math.floor((reset - Date.now()) / 1000).toString()
      }
    })
  }
  
  // Add rate limit headers to successful responses
  return null
}

// Middleware wrapper
export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  limiterType: keyof typeof rateLimiters = 'standard'
) {
  return async (req: NextRequest) => {
    const rateLimitResponse = await applyRateLimit(req, limiterType)
    if (rateLimitResponse) return rateLimitResponse
    
    const response = await handler(req)
    
    // Add security headers
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-XSS-Protection', '1; mode=block')
    
    return response
  }
}
```

---

### Day 7: Authentication & Authorization Fixes

#### 3. Authentication Middleware Enhancement
**Time Estimate**: 4 hours
**Files to Modify**:
- `/src/app/api/review/_middleware/auth.ts`
- `/src/lib/auth/session.ts`

**Implementation**:
```typescript
// src/app/api/review/_middleware/auth.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import jwt from 'jsonwebtoken'

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string
    email: string
    role: string
    subscription: string
  }
}

export async function authenticate(
  request: NextRequest
): Promise<{ user: any } | NextResponse> {
  try {
    // Check session cookie first
    const session = await getServerSession(authOptions)
    if (session?.user) {
      return { user: session.user }
    }
    
    // Check Bearer token
    const authorization = request.headers.get('authorization')
    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.slice(7)
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
      
      // Validate token expiry
      if (decoded.exp && decoded.exp < Date.now() / 1000) {
        return NextResponse.json(
          { error: 'Token expired' },
          { status: 401 }
        )
      }
      
      // Validate user exists and is active
      const user = await validateUser(decoded.userId)
      if (!user) {
        return NextResponse.json(
          { error: 'Invalid token' },
          { status: 401 }
        )
      }
      
      return { user }
    }
    
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  } catch (error) {
    console.error('Authentication error:', error)
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 }
    )
  }
}

export async function authorize(
  user: any,
  resource: string,
  action: string
): Promise<boolean> {
  // Implement RBAC
  const permissions = {
    user: {
      review: ['read', 'write'],
      pin: ['read', 'write'],
      stats: ['read']
    },
    premium: {
      review: ['read', 'write'],
      pin: ['read', 'write', 'bulk'],
      stats: ['read', 'export'],
      sets: ['read', 'write', 'share']
    },
    admin: {
      '*': ['*']
    }
  }
  
  const userPermissions = permissions[user.role] || permissions.user
  const resourcePermissions = userPermissions[resource] || userPermissions['*']
  
  if (!resourcePermissions) return false
  
  return resourcePermissions.includes(action) || resourcePermissions.includes('*')
}

// Middleware wrapper with auth
export function withAuth(
  handler: (req: NextRequest, user: any) => Promise<NextResponse>,
  options?: {
    requiredRole?: string
    requiredSubscription?: string
    resource?: string
    action?: string
  }
) {
  return async (req: NextRequest) => {
    const authResult = await authenticate(req)
    
    if ('error' in authResult) {
      return authResult
    }
    
    const { user } = authResult
    
    // Check role requirement
    if (options?.requiredRole && user.role !== options.requiredRole) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }
    
    // Check subscription requirement
    if (options?.requiredSubscription && user.subscription !== options.requiredSubscription) {
      return NextResponse.json(
        { error: 'Premium subscription required' },
        { status: 403 }
      )
    }
    
    // Check specific authorization
    if (options?.resource && options?.action) {
      const authorized = await authorize(user, options.resource, options.action)
      if (!authorized) {
        return NextResponse.json(
          { error: 'Unauthorized for this action' },
          { status: 403 }
        )
      }
    }
    
    return handler(req, user)
  }
}
```

---

### Day 8: Security Headers & CORS

#### 4. Security Headers Implementation
**Time Estimate**: 3 hours
**Files to Create/Modify**:
- `/src/middleware.ts`
- `/src/app/api/review/_middleware/cors.ts`

**Implementation**:
```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'

const allowedOrigins = [
  process.env.NEXT_PUBLIC_APP_URL!,
  'https://moshimoshi.app',
  'https://app.moshimoshi.app',
  'http://localhost:3000' // Development only
].filter(Boolean)

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const origin = request.headers.get('origin')
  
  // CORS headers
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.set('Access-Control-Max-Age', '86400')
  }
  
  // Security headers
  response.headers.set('X-DNS-Prefetch-Control', 'on')
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  
  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://api.moshimoshi.app wss://api.moshimoshi.app",
    "media-src 'self' blob:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join('; ')
  
  response.headers.set('Content-Security-Policy', csp)
  
  // Strict Transport Security (only in production)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }
  
  return response
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)'
  ]
}
```

---

### Day 9: Data Protection & Encryption

#### 5. Client-Side Encryption for IndexedDB
**Time Estimate**: 4 hours
**Files to Create/Modify**:
- `/src/lib/crypto/client-encryption.ts`
- `/src/lib/review-engine/offline/indexed-db.ts`

**Implementation**:
```typescript
// src/lib/crypto/client-encryption.ts
export class ClientEncryption {
  private key: CryptoKey | null = null
  
  async initialize(userId: string): Promise<void> {
    // Derive key from user ID and stored salt
    const salt = await this.getSalt(userId)
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(userId),
      'PBKDF2',
      false,
      ['deriveKey']
    )
    
    this.key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
  }
  
  async encrypt(data: any): Promise<string> {
    if (!this.key) throw new Error('Encryption not initialized')
    
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encoded = new TextEncoder().encode(JSON.stringify(data))
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.key,
      encoded
    )
    
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength)
    combined.set(iv)
    combined.set(new Uint8Array(encrypted), iv.length)
    
    return btoa(String.fromCharCode(...combined))
  }
  
  async decrypt(encryptedData: string): Promise<any> {
    if (!this.key) throw new Error('Encryption not initialized')
    
    const combined = new Uint8Array(
      atob(encryptedData).split('').map(c => c.charCodeAt(0))
    )
    
    const iv = combined.slice(0, 12)
    const encrypted = combined.slice(12)
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this.key,
      encrypted
    )
    
    return JSON.parse(new TextDecoder().decode(decrypted))
  }
  
  private async getSalt(userId: string): Promise<Uint8Array> {
    // Get or create salt for user
    const storedSalt = localStorage.getItem(`salt_${userId}`)
    if (storedSalt) {
      return new Uint8Array(atob(storedSalt).split('').map(c => c.charCodeAt(0)))
    }
    
    const salt = crypto.getRandomValues(new Uint8Array(16))
    localStorage.setItem(`salt_${userId}`, btoa(String.fromCharCode(...salt)))
    return salt
  }
}
```

#### 6. Audit Logging Implementation
**Time Estimate**: 3 hours
**Files to Create**:
- `/src/lib/audit/audit-logger.ts`
- `/src/app/api/review/_middleware/audit.ts`

**Implementation**:
```typescript
// src/lib/audit/audit-logger.ts
import { db } from '@/lib/firebase/admin'

interface AuditLog {
  id: string
  timestamp: Date
  userId: string
  action: string
  resource: string
  resourceId?: string
  metadata?: Record<string, any>
  ip?: string
  userAgent?: string
  result: 'success' | 'failure'
  errorMessage?: string
}

export class AuditLogger {
  private static instance: AuditLogger
  
  static getInstance(): AuditLogger {
    if (!this.instance) {
      this.instance = new AuditLogger()
    }
    return this.instance
  }
  
  async log(entry: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    try {
      const log: AuditLog = {
        ...entry,
        id: crypto.randomUUID(),
        timestamp: new Date()
      }
      
      // Store in Firestore
      await db.collection('audit_logs').add(log)
      
      // Also send to monitoring service
      if (process.env.NODE_ENV === 'production') {
        await this.sendToMonitoring(log)
      }
      
      // Alert on suspicious activity
      if (this.isSuspicious(log)) {
        await this.alertSecurity(log)
      }
    } catch (error) {
      console.error('Audit logging failed:', error)
      // Never throw - logging should not break the app
    }
  }
  
  private isSuspicious(log: AuditLog): boolean {
    // Detect suspicious patterns
    const suspiciousActions = [
      'bulk_delete',
      'export_all_data',
      'permission_escalation',
      'multiple_failed_auth'
    ]
    
    return suspiciousActions.includes(log.action) || 
           log.result === 'failure' && log.action.includes('auth')
  }
  
  private async sendToMonitoring(log: AuditLog): Promise<void> {
    // Send to Datadog/Sentry
    // Implementation depends on monitoring service
  }
  
  private async alertSecurity(log: AuditLog): Promise<void> {
    // Send security alert
    // Could be email, Slack, PagerDuty, etc.
  }
}

// Middleware for automatic audit logging
export function withAudit(
  action: string,
  resource: string
) {
  return (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) => {
    const originalMethod = descriptor.value
    
    descriptor.value = async function(...args: any[]) {
      const logger = AuditLogger.getInstance()
      const request = args[0] as NextRequest
      const user = args[1]
      
      try {
        const result = await originalMethod.apply(this, args)
        
        await logger.log({
          userId: user?.id || 'anonymous',
          action,
          resource,
          ip: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
          result: 'success',
          metadata: { method: propertyKey }
        })
        
        return result
      } catch (error) {
        await logger.log({
          userId: user?.id || 'anonymous',
          action,
          resource,
          ip: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
          result: 'failure',
          errorMessage: error.message,
          metadata: { method: propertyKey }
        })
        
        throw error
      }
    }
    
    return descriptor
  }
}
```

---

### Day 10: Testing & Documentation

#### 7. Security Testing Suite
**Time Estimate**: 4 hours
**Files to Create**:
- `/src/__tests__/security/api-security.test.ts`
- `/src/__tests__/security/auth.test.ts`
- `/src/__tests__/security/xss.test.ts`

**Implementation**:
```typescript
// src/__tests__/security/api-security.test.ts
import { describe, it, expect } from '@jest/globals'
import request from 'supertest'

describe('API Security Tests', () => {
  describe('Input Validation', () => {
    it('should reject SQL injection attempts', async () => {
      const maliciousInput = "'; DROP TABLE users; --"
      const response = await request(app)
        .post('/api/review/pin')
        .send({ contentId: maliciousInput })
      
      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Validation failed')
    })
    
    it('should reject XSS attempts', async () => {
      const xssPayload = '<script>alert("XSS")</script>'
      const response = await request(app)
        .post('/api/review/session/start')
        .send({ name: xssPayload })
      
      expect(response.status).toBe(400)
    })
    
    it('should enforce request size limits', async () => {
      const largePayload = { items: new Array(1001).fill({ id: 'test' }) }
      const response = await request(app)
        .post('/api/review/pin/bulk')
        .send(largePayload)
      
      expect(response.status).toBe(413)
    })
  })
  
  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const requests = Array(31).fill(null).map(() => 
        request(app).get('/api/review/queue')
      )
      
      const responses = await Promise.all(requests)
      const rateLimited = responses.filter(r => r.status === 429)
      
      expect(rateLimited.length).toBeGreaterThan(0)
    })
    
    it('should include rate limit headers', async () => {
      const response = await request(app).get('/api/review/stats')
      
      expect(response.headers['x-ratelimit-limit']).toBeDefined()
      expect(response.headers['x-ratelimit-remaining']).toBeDefined()
    })
  })
  
  describe('Authentication', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/review/queue')
        .set('Authorization', '')
      
      expect(response.status).toBe(401)
    })
    
    it('should reject expired tokens', async () => {
      const expiredToken = 'eyJ...' // Expired JWT
      const response = await request(app)
        .get('/api/review/queue')
        .set('Authorization', `Bearer ${expiredToken}`)
      
      expect(response.status).toBe(401)
      expect(response.body.error).toContain('expired')
    })
  })
  
  describe('Security Headers', () => {
    it('should include all required security headers', async () => {
      const response = await request(app).get('/api/review/health')
      
      expect(response.headers['x-content-type-options']).toBe('nosniff')
      expect(response.headers['x-frame-options']).toBe('DENY')
      expect(response.headers['x-xss-protection']).toBe('1; mode=block')
      expect(response.headers['content-security-policy']).toBeDefined()
      expect(response.headers['strict-transport-security']).toBeDefined()
    })
  })
})
```

---

## Deliverables Summary

### Week 1 Completed:
✅ Security audit document
✅ OpenAPI specification
✅ Production runbooks
✅ Accessibility audit framework
✅ Security fix documentation

### Week 2 Implementation Plan:
| Day | Focus Area | Deliverables |
|-----|------------|--------------|
| 6 | Input Validation & Rate Limiting | Validation middleware, Rate limiter |
| 7 | Authentication & Authorization | Auth middleware, RBAC implementation |
| 8 | Security Headers & CORS | CSP, CORS, Security headers |
| 9 | Data Protection | Client encryption, Audit logging |
| 10 | Testing & Documentation | Security tests, Updated docs |

### Success Metrics:
- 0 critical security vulnerabilities
- 100% API endpoints validated
- Rate limiting on all endpoints
- Authentication required on all protected routes
- All security headers implemented
- Audit logging operational
- Security test coverage > 90%

---

## Post-Implementation Checklist

- [ ] All critical vulnerabilities fixed
- [ ] All high priority issues addressed
- [ ] Security tests passing
- [ ] Penetration test scheduled
- [ ] Security documentation updated
- [ ] Team trained on security practices
- [ ] Monitoring alerts configured
- [ ] Incident response plan tested
- [ ] Compliance requirements met
- [ ] Security review completed

---

*Document prepared by Agent 5 - Security & Documentation Specialist*
*Ready for Week 2 implementation*