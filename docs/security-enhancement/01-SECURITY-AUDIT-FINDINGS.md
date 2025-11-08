# Security Audit Findings
## Comprehensive Security Analysis - January 2025

**Audit Date**: 2025-01-08
**Auditor**: AI Development Team
**Scope**: Full application security review
**Risk Level**: MEDIUM-HIGH

---

## 🔴 CRITICAL VULNERABILITIES

### 1. Development JWT_SECRET in Production Risk

**Severity**: CRITICAL
**CVE Risk**: Potential for authentication bypass
**CVSS Score**: 9.8 (Critical)

**Finding:**
```env
# Current JWT_SECRET from .env.local line 21
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-minimum-32-chars
```

**Issues:**
- Development placeholder still in use
- Literally contains text "change-this-in-production"
- If this value is in production, **IMMEDIATE BREACH RISK**
- May be in git history (searchable)
- Length is acceptable (75 chars) but **not cryptographically random**

**Impact:**
- Anyone with this secret can forge authentication tokens
- Impersonate any user including admins
- Access all protected API routes
- Modify user data, trigger payments, etc.

**Exploitability**: HIGH
```bash
# Attack vector
import jwt from 'jsonwebtoken'
const fakeToken = jwt.sign({
  uid: 'admin-user-id',
  admin: true,
  email: 'attacker@evil.com'
}, 'your-super-secret-jwt-key-change-this-in-production-minimum-32-chars')

# Use token to access admin endpoints
curl -H "Cookie: session=${fakeToken}" https://app.com/admin/users
```

**Remediation**:
1. Generate cryptographically secure secret immediately
2. Rotate in production with grace period
3. Audit git history for exposed secrets
4. Consider GitHub secret scanning alerts

**Priority**: IMMEDIATE - Do not deploy without fixing

---

### 2. Unprotected Admin API Routes

**Severity**: CRITICAL
**Attack Surface**: 11 exposed endpoints
**CVSS Score**: 8.9 (High)

**Vulnerable Endpoints:**

```
1. POST /api/admin/generate-story-from-moodboard
   - Triggers OpenAI API (costs money)
   - No authentication check
   - Anyone can generate unlimited stories

2. POST /api/admin/news/trigger-scraping
   - Initiates external web scraping
   - CPU/memory intensive
   - DoS potential

3. POST /api/admin/init
   - System initialization endpoint
   - Could reset production data
   - NO PROTECTION

4. POST /api/admin/generate-audio
   - TTS/audio generation (expensive API)
   - No rate limiting
   - Resource exhaustion possible

5. POST /api/admin/generate-story
   - OpenAI story generation
   - Costs per request
   - Financial impact

6. POST /api/admin/generate-image
   - Image generation API
   - Expensive operation
   - No protection

7. POST /api/admin/generate-moodboard
   - AI moodboard creation
   - Resource intensive
   - Open to abuse

8. POST /api/admin/generate-kanji-moodboard
   - Specialized AI generation
   - High computational cost
   - Unprotected

9. GET /api/admin/streak-analytics
   - User analytics data
   - Privacy violation risk
   - No authentication

10. GET/POST /api/admin/entitlements/config
    - Permission configuration
    - Could grant admin access
    - CRITICAL VULNERABILITY

11. GET /api/admin/entitlements/types
    - Permission type definitions
    - Business logic exposure
    - Information leakage
```

**Current Code Example** (`/api/admin/generate-story/route.ts`):
```typescript
export async function POST(request: Request) {
  // ❌ NO AUTHENTICATION CHECK
  const body = await request.json()

  // Directly calls OpenAI
  const story = await openai.createCompletion({
    model: 'gpt-4',
    prompt: body.prompt,
    max_tokens: 2000  // Expensive!
  })

  return Response.json(story)
}
```

**Impact:**
- **Financial**: Unlimited OpenAI/TTS API usage ($100s-$1000s possible)
- **Availability**: Resource exhaustion DoS attacks
- **Privacy**: Exposure of user analytics data
- **Security**: Ability to modify entitlements/permissions

**Exploitability**: VERY HIGH
```bash
# Exploit example - drain API credits
for i in {1..1000}; do
  curl -X POST https://app.com/api/admin/generate-story \
    -H "Content-Type: application/json" \
    -d '{"prompt": "Long story request..."}' &
done
# Result: $1000s in OpenAI bills
```

**Remediation**:
```typescript
// Add withAdminAuth wrapper (already exists in codebase)
import { withAdminAuth } from '@/lib/auth/admin-auth'

export const POST = withAdminAuth(async (request: Request) => {
  // Now protected - requires valid Firebase admin token
  // ...
})
```

**Priority**: IMMEDIATE - Block before production

---

### 3. Debug Endpoint Exposing Secrets

**Severity**: CRITICAL
**Endpoint**: `/api/debug/env`
**CVSS Score**: 8.6 (High)

**Finding:**
```typescript
// /api/debug/env/route.ts lines 1-29
export async function GET() {
  const envVars = {
    JWT_SECRET: process.env.JWT_SECRET ? '✅ Set' : '❌ Missing',
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Missing',
    // ... more checks
  }

  // ❌ IN DEV MODE, RETURNS ACTUAL VALUES!
  if (process.env.NODE_ENV === 'development') {
    envVars.JWT_SECRET = process.env.JWT_SECRET  // EXPOSED!
    envVars.FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY  // CRITICAL!
    // ... all secrets exposed
  }

  return Response.json(envVars)
}
```

**Impact:**
- **Development mode**: Full secret exposure
- **Risk**: Dev environment left running on public server
- **Risk**: Staging with NODE_ENV=development
- **Exposure**: JWT_SECRET, Firebase private keys, Stripe keys, Redis URLs

**Exploitability**: MEDIUM (requires dev mode, but common misconfiguration)

```bash
# If dev mode accidentally deployed
curl https://app.com/api/debug/env

{
  "JWT_SECRET": "actual-secret-here",
  "FIREBASE_PRIVATE_KEY": "-----BEGIN PRIVATE KEY-----\n...",
  "STRIPE_SECRET_KEY": "sk_live_...",
  "OPENAI_API_KEY": "sk-..."
}
```

**Remediation**:
1. **Delete this endpoint entirely** (recommended)
2. Or add admin-only authentication
3. Never return actual values, only presence checks

**Priority**: IMMEDIATE - Delete before any deployment

---

## 🟠 HIGH VULNERABILITIES

### 4. Admin Flag in JWT Without Server Validation

**Severity**: HIGH
**Attack**: Token manipulation
**CVSS Score**: 7.5 (High)

**Finding:**
```typescript
// middleware.ts lines 60-64
if (!validation.payload?.admin) {
  return NextResponse.redirect(new URL('/dashboard', request.url))
}
```

**Issues:**
- Middleware trusts JWT payload without signature verification (line 58 comment admits this)
- Edge runtime limitation prevents full Firebase validation
- Admin status checked only against JWT claims
- No re-validation against Firestore on each request

**Attack Scenario:**
```typescript
// Attacker with valid user JWT
const userToken = jwt.decode(legitimateUserToken)
// {uid: 'user123', admin: false, ...}

// Modify admin claim (if they crack JWT_SECRET)
const adminToken = jwt.sign({
  ...userToken,
  admin: true  // ← Modified
}, crackedSecret)

// Now has admin access until token expires (1 hour)
```

**Impact:**
- If JWT_SECRET is weak/exposed, privilege escalation possible
- Admin status changes don't take effect until token expires
- Race condition: User demoted → still admin for up to 1 hour

**Remediation**:
1. Add Firebase Admin SDK verification in all admin API routes
2. Check admin status against Firestore on sensitive operations
3. Implement immediate revocation list in Redis
4. Don't rely solely on middleware for admin checks

**Priority**: HIGH - Implement with Phase 1

---

### 5. No CSRF Protection on State-Changing Operations

**Severity**: HIGH
**Attack**: Cross-Site Request Forgery
**CVSS Score**: 7.1 (High)

**Finding:**
- No CSRF tokens implemented
- Relies on `sameSite: 'lax'` cookies only
- Changed from 'strict' to allow Stripe redirects (session.ts line 21)

**sameSite: 'lax' Implications:**
```typescript
// session.ts line 21
sameSite: 'lax' as const,  // ⚠️ Changed from 'strict' for Stripe
```

- **Lax mode**: Allows cookies on top-level navigation (GET requests)
- **Risk**: CSRF possible on GET requests that change state
- **Risk**: Social engineering with malicious links

**Vulnerable Pattern:**
```typescript
// If any GET endpoint modifies state (anti-pattern but check)
export async function GET(request: Request) {
  const session = await getSession(request)

  // ❌ BAD: Deleting data on GET
  await deleteUserAccount(session.uid)

  return Response.json({success: true})
}
```

**Attack:**
```html
<!-- Attacker's website -->
<img src="https://moshimoshi.app/api/user/delete-account" />
<!-- If victim is logged in, account deleted -->
```

**Impact:**
- Account deletion
- Subscription cancellation
- Settings modification
- Data export/download

**Remediation**:
1. Audit all GET endpoints - ensure NO state changes
2. Implement CSRF tokens for critical operations:
   - Account deletion
   - Subscription changes
   - Admin actions
3. Consider reverting to `sameSite: 'strict'` if Stripe allows

**Priority**: HIGH - Phase 1 or 2

---

### 6. Predictable Redis Session Keys

**Severity**: MEDIUM-HIGH
**Attack**: Session enumeration
**CVSS Score**: 6.8 (Medium)

**Finding:**
```typescript
// session.ts line 99
const sessionCacheKey = `session:${sid}`
await redis.setex(sessionCacheKey, ...)
```

**Issues:**
- Session IDs follow predictable pattern: `session:${hex}`
- If Redis is exposed (misconfiguration), keys enumerable
- `KEYS session:*` would list all sessions
- Session IDs generated with crypto.randomBytes (✅ good) but key structure predictable

**Impact:**
- If Redis exposed: All sessions visible
- Session hijacking potential
- User enumeration

**Remediation**:
```typescript
// Use hashed session IDs for Redis keys
const sessionCacheKey = `session:${crypto.createHash('sha256').update(sid).digest('hex')}`
```

**Priority**: MEDIUM - Phase 2

---

## 🟡 MEDIUM VULNERABILITIES

### 7. No IP Binding in Session Tokens

**Severity**: MEDIUM
**Attack**: Stolen token reuse
**CVSS Score**: 6.5 (Medium)

**Finding:**
```typescript
// jwt.ts SessionPayload interface
export interface SessionPayload {
  uid: string
  email: string
  fingerprint: string  // ✅ Browser fingerprint exists
  // ❌ NO IP address
}
```

**Issues:**
- Stolen JWT works from any IP address
- Only browser fingerprint prevents reuse
- Fingerprint can be spoofed

**Impact:**
- Stolen tokens usable from anywhere
- Longer-lived security risk

**Remediation**:
```typescript
interface SessionPayload {
  uid: string
  email: string
  fingerprint: string
  ipHash: string  // ← Add this (hashed for privacy)
}

// Validation
if (currentIPHash !== payload.ipHash) {
  // Allow with re-authentication
  throw new Error('IP changed, please re-login')
}
```

**Trade-offs:**
- ❌ Users on mobile (IP changes frequently)
- ❌ VPN users
- ✅ Better security for stolen tokens

**Priority**: MEDIUM - Phase 3 (optional)

---

### 8. Missing Security Headers

**Severity**: MEDIUM
**Attack**: Various client-side attacks
**CVSS Score**: 5.9 (Medium)

**Finding:**
```typescript
// middleware.ts lines 166-175 - Good headers present
response.headers.set('X-Content-Type-Options', 'nosniff')     // ✅
response.headers.set('X-Frame-Options', 'DENY')                // ✅
response.headers.set('X-XSS-Protection', '1; mode=block')      // ✅

// ❌ MISSING:
// - Strict-Transport-Security (HSTS)
// - Comprehensive Content-Security-Policy
```

**Impact:**
- No HSTS: Vulnerable to SSL stripping attacks
- Weak CSP: XSS vulnerabilities not fully mitigated

**Remediation**:
```typescript
// Add to middleware.ts
response.headers.set(
  'Strict-Transport-Security',
  'max-age=31536000; includeSubDomains; preload'
)

response.headers.set(
  'Content-Security-Policy',
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com; ..."
)
```

**Priority**: MEDIUM - Phase 2

---

### 9. No Session Data Encryption at Rest (Redis)

**Severity**: MEDIUM
**Attack**: Redis data breach
**CVSS Score**: 5.7 (Medium)

**Finding:**
```typescript
// session.ts line 99
await redis.setex(sessionCacheKey, duration, JSON.stringify(cacheData))
// ❌ Plain JSON, not encrypted
```

**Impact:**
- If Redis compromised: All session data readable
- Includes user IDs, emails, tiers
- Not end-to-end encrypted

**Remediation**:
```typescript
// Encrypt before storing
import { encrypt, decrypt } from '@/lib/crypto'

await redis.setex(
  sessionCacheKey,
  duration,
  await encrypt(JSON.stringify(cacheData))
)
```

**Trade-offs:**
- ⚠️ Performance overhead (encryption/decryption)
- ✅ Defense in depth

**Priority**: LOW-MEDIUM - Phase 4 (optional)

---

## 🟢 LOW VULNERABILITIES / OBSERVATIONS

### 10. No Cookie Domain Restriction

**Severity**: LOW
**Attack**: Subdomain cookie leakage
**CVSS Score**: 4.2 (Low)

**Finding:**
```typescript
// session.ts - No domain specified
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  // ❌ domain: undefined (uses default)
}
```

**Impact:**
- Cookies shared across all subdomains by default
- If attacker controls subdomain: Session hijacking possible

**Remediation**:
```typescript
domain: process.env.COOKIE_DOMAIN || '.moshimoshi.app'  // Explicit
```

**Priority**: LOW - Phase 3

---

### 11. Public API Routes Without Rate Limiting

**Severity**: LOW-MEDIUM
**Attack**: API abuse / DoS
**CVSS Score**: 5.3 (Medium)

**Finding:**
56 public API routes have no rate limiting:
- `/api/kanji/by-radical`
- `/api/kanji/by-skip`
- `/api/furigana/*`
- `/api/news/article/[id]`
- `/api/tatoeba/search`

**Impact:**
- API abuse (scraping)
- Resource exhaustion
- Database overload

**Remediation**:
```typescript
import { rateLimit } from '@/lib/rate-limit'

export async function GET(request: Request) {
  // Already have @upstash/ratelimit installed (package.json line 81)
  await rateLimit(request, {limit: 100, window: '1m'})

  // ... endpoint logic
}
```

**Priority**: HIGH - Phase 1

---

## 📊 Vulnerability Summary

| Severity | Count | Must Fix | Should Fix | Optional |
|----------|-------|----------|------------|----------|
| 🔴 Critical | 3 | ✅ All | - | - |
| 🟠 High | 3 | ✅ All | - | - |
| 🟡 Medium | 3 | 2 | 1 | - |
| 🟢 Low | 2 | - | 1 | 1 |
| **TOTAL** | **11** | **8** | **2** | **1** |

---

## 🛡️ Security Posture Assessment

### Current State
- **Authentication**: Partially secure (JWT + Firebase, but weak secret)
- **Authorization**: Weak (unprotected admin routes)
- **Data Protection**: Moderate (HTTPS, httpOnly cookies)
- **Input Validation**: Unknown (needs separate audit)
- **Rate Limiting**: None
- **Monitoring**: Present (Sentry installed)

### Target State (After Fixes)
- **Authentication**: Strong (secure JWT + Firebase Admin)
- **Authorization**: Strong (all routes protected)
- **Data Protection**: Strong (encryption, security headers)
- **Input Validation**: To be audited
- **Rate Limiting**: Comprehensive
- **Monitoring**: Enhanced

---

## 🚨 Immediate Actions Required

### Do Not Deploy Until Fixed:
1. ❌ JWT_SECRET rotation
2. ❌ Admin route protection
3. ❌ Debug endpoint removal

### Can Deploy With:
4. ⚠️ Rate limiting (monitor closely)
5. ⚠️ CSRF protection (audit GET endpoints first)
6. ⚠️ Security headers (low risk to add)

### Future Enhancements:
7. 📝 IP binding (optional, may break mobile)
8. 📝 Redis encryption (defense in depth)
9. 📝 Cookie domain restriction (if using subdomains)

---

## 📝 Compliance Notes

### GDPR Implications:
- User data exposure via /api/debug/env (Article 32 - Security)
- Session analytics without protection (Article 25 - Privacy by Design)

### PCI DSS (if handling cards):
- Requirement 6.5.10: Broken Authentication (JWT_SECRET)
- Requirement 6.6: Regular security reviews (this audit)

---

## ✅ Recommendations

### Priority 1 (Week 1):
1. Rotate JWT_SECRET with production-grade secret
2. Protect all 11 admin routes with Firebase Admin SDK
3. Delete /api/debug/env endpoint
4. Implement rate limiting on public routes

### Priority 2 (Week 2):
5. Add CSRF tokens to critical operations
6. Implement HSTS and comprehensive CSP
7. Audit all GET endpoints for state changes
8. Add session revocation capability

### Priority 3 (Week 3-4):
9. Consider IP binding (with mobile exceptions)
10. Encrypt Redis session data
11. Set explicit cookie domain
12. Enhanced monitoring and alerts

---

**Document Owner**: Security Team
**Next Audit**: 2025-04-08 (Quarterly)
**Remediation Deadline**: 2025-01-22 (2 weeks for critical issues)
