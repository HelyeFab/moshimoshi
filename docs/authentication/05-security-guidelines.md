# Security Guidelines

## Overview

This document outlines security best practices for the Moshimoshi authentication system. All developers must follow these guidelines to maintain the security integrity of the application.

## Core Security Principles

### 1. Defense in Depth
- Multiple layers of security
- Assume any single layer can fail
- Redundant security controls

### 2. Least Privilege
- Users get minimum required permissions
- Admin access strictly controlled
- Service accounts limited scope

### 3. Zero Trust
- Never trust client input
- Verify everything server-side
- Authenticate and authorize every request

## Authentication Security

### Password Requirements

```typescript
const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommon: true,      // Check against common passwords
  preventUserInfo: true,     // Can't contain email/name
  preventRepeating: true,    // No more than 2 repeating chars
  preventSequential: true    // No sequential patterns (abc, 123)
};

// Validation implementation
function validatePassword(password: string, userEmail: string): ValidationResult {
  const errors: string[] = [];

  // Length check
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  // Complexity checks
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain number');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain special character');
  }

  // Check against common passwords
  if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
    errors.push('Password is too common');
  }

  // Check for user info
  const emailParts = userEmail.split('@')[0].toLowerCase();
  if (password.toLowerCase().includes(emailParts)) {
    errors.push('Password cannot contain your email');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
```

### Session Security

```typescript
// Session configuration
const SESSION_CONFIG = {
  // Token settings
  algorithm: 'HS256',
  secret: process.env.JWT_SECRET, // Min 32 chars
  issuer: 'moshimoshi.app',
  audience: 'moshimoshi-users',
  
  // Duration
  defaultDuration: 1 * 60 * 60 * 1000,      // 1 hour
  rememberMeDuration: 7 * 24 * 60 * 60 * 1000, // 7 days
  refreshThreshold: 15 * 60 * 1000,         // 15 minutes
  
  // Cookie settings
  cookieOptions: {
    httpOnly: true,       // No JavaScript access
    secure: true,         // HTTPS only
    sameSite: 'strict',   // CSRF protection
    path: '/',
    domain: '.moshimoshi.app'
  }
};

// Secure session creation
function setSessionCookie(res: NextApiResponse, token: string, maxAge?: number) {
  const cookieValue = serialize('session', token, {
    ...SESSION_CONFIG.cookieOptions,
    maxAge: maxAge || SESSION_CONFIG.defaultDuration / 1000
  });
  
  res.setHeader('Set-Cookie', cookieValue);
}
```

### Rate Limiting Strategy

```typescript
// Rate limit configurations
const RATE_LIMITS = {
  // Authentication endpoints
  '/api/auth/signin': {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    maxRequests: 5,             // 5 attempts
    skipSuccessfulRequests: true
  },
  
  '/api/auth/signup': {
    windowMs: 60 * 60 * 1000,   // 1 hour
    maxRequests: 5,             // 5 signups per hour
    byIP: true
  },
  
  '/api/auth/password/reset-request': {
    windowMs: 60 * 60 * 1000,   // 1 hour
    maxRequests: 3,             // 3 resets per hour
    byEmail: true
  },
  
  // User endpoints
  '/api/user/*': {
    windowMs: 60 * 1000,        // 1 minute
    maxRequests: 60,            // 60 requests per minute
    byUser: true
  },
  
  // Global limit
  global: {
    windowMs: 60 * 1000,        // 1 minute
    maxRequests: 100,           // 100 requests per minute
    byIP: true
  }
};

// Implementation with Upstash
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  analytics: true
});

async function checkRateLimit(
  req: NextApiRequest, 
  endpoint: string
): Promise<boolean> {
  const identifier = getIdentifier(req, endpoint);
  const { success, limit, reset, remaining } = await ratelimit.limit(identifier);
  
  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', reset);
  
  if (!success) {
    // Log rate limit violation
    await logSecurityEvent('rate_limit_exceeded', {
      endpoint,
      identifier,
      ip: req.headers['x-forwarded-for']
    });
  }
  
  return success;
}
```

## Input Validation & Sanitization

### Request Validation

```typescript
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

// Email validation with normalization
const EmailSchema = z.string()
  .email()
  .toLowerCase()
  .transform(email => email.trim())
  .refine(email => !email.includes('+'), {
    message: 'Plus addressing not allowed'
  });

// Sanitize user input
function sanitizeInput(input: string): string {
  // Remove HTML/script tags
  let sanitized = DOMPurify.sanitize(input, { 
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [] 
  });
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Limit length
  if (sanitized.length > 1000) {
    sanitized = sanitized.substring(0, 1000);
  }
  
  return sanitized;
}

// SQL injection prevention (if using SQL)
function escapeSqlInput(input: string): string {
  return input
    .replace(/'/g, "''")
    .replace(/;/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '');
}
```

### File Upload Security

```typescript
const ALLOWED_FILE_TYPES = {
  avatar: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSize: 5 * 1024 * 1024, // 5MB
    extensions: ['.jpg', '.jpeg', '.png', '.webp']
  }
};

async function validateFileUpload(
  file: File, 
  type: keyof typeof ALLOWED_FILE_TYPES
): Promise<ValidationResult> {
  const config = ALLOWED_FILE_TYPES[type];
  
  // Check file size
  if (file.size > config.maxSize) {
    return { valid: false, error: 'File too large' };
  }
  
  // Check MIME type
  if (!config.mimeTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type' };
  }
  
  // Check file extension
  const ext = path.extname(file.name).toLowerCase();
  if (!config.extensions.includes(ext)) {
    return { valid: false, error: 'Invalid file extension' };
  }
  
  // Scan for malware (integrate with service)
  const isSafe = await scanForMalware(file);
  if (!isSafe) {
    return { valid: false, error: 'File failed security scan' };
  }
  
  return { valid: true };
}
```

## CSRF Protection

### Implementation

```typescript
import { randomBytes } from 'crypto';

// Generate CSRF token
function generateCSRFToken(): string {
  return randomBytes(32).toString('hex');
}

// Middleware to validate CSRF
async function validateCSRF(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<boolean> {
  // Skip for GET requests
  if (req.method === 'GET') return true;
  
  const token = req.headers['x-csrf-token'] as string;
  const sessionToken = req.cookies.csrf;
  
  if (!token || !sessionToken || token !== sessionToken) {
    res.status(403).json({
      error: {
        code: 'CSRF_VALIDATION_FAILED',
        message: 'Invalid CSRF token'
      }
    });
    
    // Log potential CSRF attack
    await logSecurityEvent('csrf_validation_failed', {
      ip: req.headers['x-forwarded-for'],
      endpoint: req.url
    });
    
    return false;
  }
  
  return true;
}

// Double Submit Cookie Pattern
function setCSRFCookie(res: NextApiResponse) {
  const token = generateCSRFToken();
  
  res.setHeader('Set-Cookie', serialize('csrf', token, {
    httpOnly: false, // Needs to be readable by JS
    secure: true,
    sameSite: 'strict',
    path: '/'
  }));
  
  return token;
}
```

## XSS Prevention

### Content Security Policy

```typescript
// middleware.ts
const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", 'https://www.googletagmanager.com'],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'font-src': ["'self'", 'https://fonts.gstatic.com'],
  'img-src': ["'self'", 'data:', 'https:', 'blob:'],
  'connect-src': ["'self'", 'https://api.stripe.com'],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'upgrade-insecure-requests': []
};

function generateCSP(): string {
  return Object.entries(CSP_DIRECTIVES)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');
}

// Apply security headers
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Security headers
  response.headers.set('Content-Security-Policy', generateCSP());
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // HSTS
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }
  
  return response;
}
```

### Output Encoding

```typescript
// Safe rendering of user content
function renderUserContent(content: string): string {
  // HTML encode
  const encoded = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
  
  return encoded;
}

// React component for safe rendering
function SafeUserContent({ content }: { content: string }) {
  // React automatically escapes content
  return <div>{content}</div>;
}
```

## API Security

### API Key Management

```typescript
// Environment variables validation
const requiredEnvVars = [
  'FIREBASE_ADMIN_PROJECT_ID',
  'FIREBASE_ADMIN_CLIENT_EMAIL',
  'FIREBASE_ADMIN_PRIVATE_KEY',
  'JWT_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN'
];

function validateEnvironment() {
  const missing = requiredEnvVars.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
  
  // Validate JWT secret strength
  if (process.env.JWT_SECRET!.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
}
```

### Request Authentication

```typescript
// Middleware for API authentication
async function authenticateRequest(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<User | null> {
  // Get session from cookie
  const sessionCookie = req.cookies.session;
  
  if (!sessionCookie) {
    res.status(401).json({
      error: {
        code: 'NO_SESSION',
        message: 'Authentication required'
      }
    });
    return null;
  }
  
  // Validate session
  const session = await validateSession(sessionCookie);
  
  if (!session.valid) {
    res.status(401).json({
      error: {
        code: 'INVALID_SESSION',
        message: 'Session invalid or expired'
      }
    });
    return null;
  }
  
  // Get user
  const user = await getUserById(session.uid);
  
  if (!user || user.userState !== 'active') {
    res.status(403).json({
      error: {
        code: 'USER_INACTIVE',
        message: 'User account is not active'
      }
    });
    return null;
  }
  
  // Add user to request
  (req as any).user = user;
  
  return user;
}
```

## Data Protection

### Encryption at Rest

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
const IV_LENGTH = 16;

// Encrypt sensitive data
function encrypt(text: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// Decrypt sensitive data
function decrypt(text: string): string {
  const parts = text.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = Buffer.from(parts[1], 'hex');
  
  const decipher = createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString();
}

// Usage for sensitive fields
const encryptedCustomerId = encrypt(stripeCustomerId);
const decryptedCustomerId = decrypt(encryptedCustomerId);
```

### Audit Logging

```typescript
interface AuditLog {
  timestamp: Date;
  event: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

async function logAuditEvent(
  event: string,
  metadata?: Record<string, any>,
  severity: AuditLog['severity'] = 'info'
) {
  const log: AuditLog = {
    timestamp: new Date(),
    event,
    metadata,
    severity
  };
  
  // Add request context if available
  if (globalThis.requestContext) {
    log.userId = globalThis.requestContext.userId;
    log.ip = globalThis.requestContext.ip;
    log.userAgent = globalThis.requestContext.userAgent;
  }
  
  // Store in Firestore
  await db.collection('audit_logs').add(log);
  
  // Alert on critical events
  if (severity === 'critical') {
    await sendSecurityAlert(log);
  }
}

// Events to audit
const AUDIT_EVENTS = [
  'auth.signin',
  'auth.signout',
  'auth.signup',
  'auth.password_reset',
  'auth.failed_attempt',
  'user.tier_change',
  'user.profile_update',
  'user.account_deleted',
  'admin.action',
  'security.suspicious_activity',
  'payment.subscription_created',
  'payment.subscription_canceled'
];
```

## Security Monitoring

### Suspicious Activity Detection

```typescript
async function detectSuspiciousActivity(
  userId: string,
  activity: string
): Promise<boolean> {
  const recentActivities = await getRecentActivities(userId, 24); // Last 24 hours
  
  const suspiciousPatterns = [
    // Rapid location changes
    {
      pattern: 'location_change',
      check: () => hasRapidLocationChanges(recentActivities),
      severity: 'warning'
    },
    
    // Multiple failed login attempts
    {
      pattern: 'failed_logins',
      check: () => countFailedLogins(recentActivities) > 10,
      severity: 'critical'
    },
    
    // Unusual access patterns
    {
      pattern: 'unusual_access',
      check: () => hasUnusualAccessPattern(recentActivities),
      severity: 'warning'
    },
    
    // Concurrent sessions from different IPs
    {
      pattern: 'concurrent_sessions',
      check: () => hasConcurrentSessions(recentActivities),
      severity: 'warning'
    }
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.check()) {
      await logSecurityEvent('suspicious_activity_detected', {
        userId,
        pattern: pattern.pattern,
        severity: pattern.severity
      });
      
      if (pattern.severity === 'critical') {
        // Take immediate action
        await suspendUserAccount(userId, 'Suspicious activity detected');
        await notifyUser(userId, 'security_alert');
        return true;
      }
    }
  }
  
  return false;
}
```

## Security Checklist

### Development
- [ ] All environment variables set and validated
- [ ] HTTPS enforced in production
- [ ] Security headers configured
- [ ] CSRF protection implemented
- [ ] Rate limiting configured
- [ ] Input validation on all endpoints
- [ ] XSS prevention measures in place

### Authentication
- [ ] Passwords meet complexity requirements
- [ ] Session tokens are secure and HTTP-only
- [ ] Rate limiting on auth endpoints
- [ ] Account lockout after failed attempts
- [ ] Email verification required
- [ ] Secure password reset flow

### Data Protection
- [ ] Sensitive data encrypted at rest
- [ ] PII properly classified and protected
- [ ] Audit logging implemented
- [ ] GDPR compliance measures
- [ ] Regular security audits
- [ ] Incident response plan

### Monitoring
- [ ] Security event logging
- [ ] Suspicious activity detection
- [ ] Real-time alerting
- [ ] Regular security reviews
- [ ] Penetration testing scheduled

---

*Next: [Implementation Guide →](./06-implementation-guide.md)*