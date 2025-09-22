# Authentication Architecture Overview

## System Design Principles

### Core Philosophy
Moshimoshi implements a **server-side authentication architecture** where all sensitive operations are performed through Next.js API routes using Firebase Admin SDK. This approach ensures maximum security and prevents client-side vulnerabilities.

### Key Design Decisions

1. **No Client-Side Firebase Auth**
   - Firebase Admin SDK only (server-side)
   - Custom session management
   - API-based authentication flow

2. **Stateless Architecture**
   - JWT-based sessions
   - Redis for temporary caching
   - No server-side session storage

3. **Defense in Depth**
   - Multiple validation layers
   - Rate limiting on all endpoints
   - Audit logging for sensitive operations

## Technology Stack

### Core Technologies

| Component | Technology | Purpose |
|-----------|------------|---------|
| Authentication | Firebase Admin SDK | User management, token verification |
| Session Management | JWT + HTTP-only cookies | Secure session handling |
| Caching | Redis (Upstash) | Session validation cache |
| API Framework | Next.js API Routes | Server-side endpoints |
| Validation | Zod | Input validation and sanitization |
| Rate Limiting | Upstash Ratelimit | DDoS protection |

### Data Flow Architecture

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Client    │─────▶│  Next.js    │─────▶│  Firebase   │
│  (Browser)  │◀─────│  API Route  │◀─────│   Admin     │
└─────────────┘      └─────────────┘      └─────────────┘
                            │                     │
                            ▼                     ▼
                     ┌─────────────┐      ┌─────────────┐
                     │    Redis    │      │  Firestore  │
                     │   (Cache)   │      │  (Database) │
                     └─────────────┘      └─────────────┘
```

## Authentication Methods

### Supported Methods

1. **Email/Password**
   - Traditional authentication
   - Strong password requirements
   - Secure password reset flow

2. **Magic Link**
   - Passwordless authentication
   - Email-based verification
   - Time-limited tokens

3. **OAuth (Google)**
   - Server-side OAuth flow
   - No client-side SDK
   - Secure token exchange

## Session Architecture

### Session Token Structure

```typescript
interface SessionToken {
  // User identification
  uid: string;
  email: string;
  
  // Session metadata
  sid: string;          // Session ID
  iat: number;          // Issued at
  exp: number;          // Expiration
  
  // User tier (cached)
  tier: 'guest' | 'free' | 'premium.monthly' | 'premium.yearly';
  
  // Security
  fingerprint: string;  // Browser fingerprint hash
}
```

### Token Lifecycle

```
Sign In → Generate Token → Set Cookie → Validate on Request → Refresh → Sign Out
   │           │               │              │                   │         │
   │           │               │              │                   │         │
   ▼           ▼               ▼              ▼                   ▼         ▼
Firebase   JWT Sign      HTTP-only      Redis Cache         Auto-renew   Clear
 Admin      (1 hour)    SameSite=Strict  (5 min TTL)      (< 15 min)   Cookie
```

## Security Layers

### 1. Request Validation
```typescript
Request → Rate Limit → CSRF Check → Session Valid → Authorized → Process
```

### 2. Database Security
- Firestore Security Rules (backup)
- Server-side validation (primary)
- Field-level encryption for sensitive data

### 3. Network Security
- HTTPS only
- Secure headers (CSP, HSTS)
- Cookie security flags

## User State Management

### State Diagram

```
    ┌──────┐
    │ Guest│
    └───┬──┘
        │ Sign Up
    ┌───▼────────┐
    │ Unverified │
    └───┬────────┘
        │ Verify Email
    ┌───▼──┐      Subscribe    ┌──────────┐
    │ Free │◀──────────────────▶│ Premium  │
    └──────┘                    └──────────┘
```

### Tier Transitions

| From | To | Trigger | Actions |
|------|-----|---------|---------|
| Guest | Free | Sign up | Create profile, send verification |
| Free | Premium | Subscribe | Create Stripe customer, update tier |
| Premium | Free | Cancel/Expire | Maintain data, restrict features |
| Any | Deleted | User request | Soft delete, retain for 30 days |

## Caching Strategy

### Redis Cache Layers

```typescript
// L1: Session validation (5 min TTL)
`session:${sessionId}` → { uid, tier, valid }

// L2: User tier (5 min TTL)  
`tier:${userId}` → 'free' | 'premium.monthly' | 'premium.yearly'

// L3: User profile (15 min TTL)
`profile:${userId}` → { ...profileData }

// L4: Rate limiting (sliding window)
`ratelimit:${endpoint}:${userId}` → counter
```

### Cache Invalidation

- **On Subscription Change**: Clear all user caches
- **On Profile Update**: Clear profile cache
- **On Sign Out**: Clear session cache
- **Scheduled**: Verify premium users hourly

## Performance Optimizations

### Database Queries

```typescript
// Optimized indexes
- users.uid (primary)
- users.email (unique)
- users.tier (for analytics)
- users.stripeCustomerId (for webhooks)
```

### API Response Times

| Endpoint | Target | Method |
|----------|--------|--------|
| /api/auth/session | < 50ms | Redis cache |
| /api/auth/signin | < 200ms | Firebase Admin |
| /api/auth/signup | < 300ms | Firebase + Firestore |
| /api/user/profile | < 100ms | Cached in Redis |

## Monitoring & Observability

### Key Metrics

1. **Authentication Success Rate**
   - Sign in attempts
   - Success/failure ratio
   - Method breakdown

2. **Session Metrics**
   - Active sessions
   - Session duration
   - Refresh rate

3. **Performance Metrics**
   - API latency
   - Cache hit rate
   - Database query time

### Audit Events

```typescript
enum AuditEvent {
  SIGN_IN = 'auth.signin',
  SIGN_OUT = 'auth.signout',
  SIGN_UP = 'auth.signup',
  PASSWORD_RESET = 'auth.password_reset',
  TIER_CHANGE = 'user.tier_change',
  PROFILE_UPDATE = 'user.profile_update',
  SESSION_REFRESH = 'auth.session_refresh',
  ADMIN_ACTION = 'admin.action'
}
```

## Error Handling

### Error Response Format

```typescript
interface AuthError {
  error: {
    code: string;          // 'AUTH_INVALID_CREDENTIALS'
    message: string;       // User-friendly message
    details?: any;         // Debug info (dev only)
  };
  timestamp: string;
  requestId: string;
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| AUTH_INVALID_CREDENTIALS | Wrong email/password | 401 |
| AUTH_SESSION_EXPIRED | Token expired | 401 |
| AUTH_RATE_LIMITED | Too many attempts | 429 |
| AUTH_EMAIL_NOT_VERIFIED | Email verification required | 403 |
| AUTH_USER_DISABLED | Account suspended | 403 |

## Scalability Considerations

### Horizontal Scaling
- Stateless API routes
- Redis cluster for caching
- Firebase handles user scaling

### Vertical Scaling
- Connection pooling
- Query optimization
- Batch operations

### Future Considerations
- WebAuthn support
- Biometric authentication
- Multi-factor authentication
- SSO integration

---

*Next: [User Profile Structure →](./02-user-profile-structure.md)*