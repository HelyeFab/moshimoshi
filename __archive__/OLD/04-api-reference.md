# API Reference

## Authentication Endpoints

### Base URL
All authentication endpoints are prefixed with `/api/auth`

### Common Headers

```http
Content-Type: application/json
X-CSRF-Token: {csrf-token}  # Required for state-changing operations
```

### Common Response Codes

| Status | Description |
|--------|------------|
| 200 | Success |
| 201 | Created (new resource) |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (invalid credentials) |
| 403 | Forbidden (insufficient permissions) |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |

---

## 1. Sign Up

Create a new user account with email and password.

### Endpoint
```http
POST /api/auth/signup
```

### Request Body
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "displayName": "John Doe",
  "referralCode": "FRIEND2024"
}
```

### Request Validation
```typescript
{
  email: z.string().email().toLowerCase(),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain uppercase letter")
    .regex(/[0-9]/, "Password must contain number")
    .regex(/[^A-Za-z0-9]/, "Password must contain special character"),
  displayName: z.string().min(2).max(50).optional(),
  referralCode: z.string().optional()
}
```

### Success Response (201)
```json
{
  "success": true,
  "user": {
    "uid": "usr_abc123",
    "email": "user@example.com",
    "tier": "free",
    "emailVerified": false
  },
  "requiresVerification": true
}
```

### Error Responses

#### Email Already Exists (409)
```json
{
  "error": {
    "code": "AUTH_EMAIL_EXISTS",
    "message": "This email is already registered"
  }
}
```

#### Weak Password (400)
```json
{
  "error": {
    "code": "AUTH_WEAK_PASSWORD",
    "message": "Password does not meet security requirements"
  }
}
```

### Rate Limiting
- 5 requests per IP per hour
- 10 requests per email per day

---

## 2. Sign In

Authenticate with email and password.

### Endpoint
```http
POST /api/auth/signin
```

### Request Body
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "rememberMe": true
}
```

### Success Response (200)
```json
{
  "success": true,
  "user": {
    "uid": "usr_abc123",
    "email": "user@example.com",
    "tier": "premium.monthly",
    "emailVerified": true,
    "displayName": "John Doe"
  },
  "redirectTo": "/dashboard"
}
```

### Error Responses

#### Invalid Credentials (401)
```json
{
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

#### Account Locked (429)
```json
{
  "error": {
    "code": "AUTH_TOO_MANY_ATTEMPTS",
    "message": "Account locked due to too many failed attempts. Try again in 15 minutes."
  }
}
```

#### Email Not Verified (403)
```json
{
  "error": {
    "code": "AUTH_EMAIL_NOT_VERIFIED",
    "message": "Please verify your email before signing in"
  }
}
```

### Rate Limiting
- 5 failed attempts per account per 15 minutes
- 20 requests per IP per hour

### Cookies Set
```http
Set-Cookie: session={jwt}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600
```

---

## 3. Magic Link Request

Request a passwordless sign-in link.

### Endpoint
```http
POST /api/auth/magic-link/request
```

### Request Body
```json
{
  "email": "user@example.com"
}
```

### Success Response (200)
```json
{
  "success": true,
  "message": "If an account exists with this email, a sign-in link has been sent"
}
```

### Rate Limiting
- 3 requests per email per hour
- 10 requests per IP per hour

---

## 4. Magic Link Verification

Verify magic link token (usually accessed via email link).

### Endpoint
```http
GET /api/auth/magic-link/verify?token={token}
```

### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| token | string | Yes | Magic link token from email |

### Success Response
- Redirects to `/dashboard`
- Sets session cookie

### Error Response
- Redirects to `/auth/error?code=INVALID_LINK` or `/auth/error?code=LINK_EXPIRED`

---

## 5. Google OAuth

### Initiate OAuth
```http
GET /api/auth/google
```
- Redirects to Google OAuth consent page

### OAuth Callback
```http
GET /api/auth/google/callback?code={code}&state={state}
```
- Handles OAuth callback
- Creates/updates user
- Sets session cookie
- Redirects to `/dashboard`

---

## 6. Session Management

### Get Current Session

```http
GET /api/auth/session
```

#### Success Response (200)
```json
{
  "authenticated": true,
  "user": {
    "uid": "usr_abc123",
    "email": "user@example.com",
    "tier": "premium.monthly",
    "displayName": "John Doe",
    "photoURL": "https://..."
  },
  "expiresIn": 2845000
}
```

#### Unauthenticated Response (200)
```json
{
  "authenticated": false
}
```

### Refresh Session

```http
POST /api/auth/refresh
```

#### Success Response (200)
```json
{
  "success": true,
  "expiresIn": 3600000
}
```

#### Error Response (401)
```json
{
  "error": {
    "code": "SESSION_EXPIRED",
    "message": "Session has expired. Please sign in again."
  }
}
```

---

## 7. Sign Out

### Endpoint
```http
POST /api/auth/signout
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Signed out successfully"
}
```

### Side Effects
- Blacklists current session token
- Clears session cookie

---

## 8. Password Management

### Request Password Reset

```http
POST /api/auth/password/reset-request
```

#### Request Body
```json
{
  "email": "user@example.com"
}
```

#### Success Response (200)
```json
{
  "success": true,
  "message": "If an account exists with this email, reset instructions have been sent"
}
```

### Confirm Password Reset

```http
POST /api/auth/password/reset-confirm
```

#### Request Body
```json
{
  "token": "reset_token_from_email",
  "newPassword": "NewSecurePassword123!"
}
```

#### Success Response (200)
```json
{
  "success": true,
  "message": "Password has been reset successfully"
}
```

#### Error Response (400)
```json
{
  "error": {
    "code": "INVALID_RESET_TOKEN",
    "message": "Reset link is invalid or expired"
  }
}
```

### Change Password (Authenticated)

```http
POST /api/auth/password/change
```

#### Request Body
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewSecurePassword123!"
}
```

#### Success Response (200)
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

## 9. Email Verification

### Resend Verification Email

```http
POST /api/auth/email/resend-verification
```

#### Success Response (200)
```json
{
  "success": true,
  "message": "Verification email sent"
}
```

#### Rate Limiting
- 3 requests per hour per user

### Verify Email

```http
GET /api/auth/email/verify?token={token}
```

#### Success Response
- Redirects to `/dashboard?verified=true`

#### Error Response
- Redirects to `/auth/error?code=INVALID_VERIFICATION`

---

## User Profile Endpoints

### Base URL
All user endpoints are prefixed with `/api/user`

## 1. Get Profile

### Endpoint
```http
GET /api/user/profile
```

### Success Response (200)
```json
{
  "profile": {
    "uid": "usr_abc123",
    "email": "user@example.com",
    "displayName": "John Doe",
    "photoURL": "https://...",
    "tier": "premium.monthly",
    "totalXp": 1250,
    "currentStreak": 15,
    "currentLevel": "intermediate",
    "lessonsCompleted": 127,
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

---

## 2. Update Profile

### Endpoint
```http
PATCH /api/user/profile
```

### Request Body
```json
{
  "displayName": "Jane Doe",
  "bio": "Learning Japanese for fun!",
  "dailyGoalMinutes": 20,
  "reminderTime": "19:00",
  "theme": "dark",
  "showFurigana": true
}
```

### Allowed Fields
- displayName
- bio
- photoURL
- dailyGoalMinutes
- reminderTime
- reminderTimezone
- theme
- fontSize
- autoPlayAudio
- showFurigana
- studyMode

### Success Response (200)
```json
{
  "success": true,
  "profile": {
    ...updated profile data
  }
}
```

---

## 3. Delete Account

### Endpoint
```http
DELETE /api/user/account
```

### Request Body
```json
{
  "password": "CurrentPassword123!",
  "reason": "No longer using the service",
  "feedback": "Optional feedback message"
}
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Account scheduled for deletion. You have 30 days to reactivate."
}
```

---

## 4. Export Data (GDPR)

### Endpoint
```http
POST /api/user/export-data
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Data export initiated. You will receive an email with the download link within 24 hours."
}
```

---

## Rate Limiting

### Global Rate Limits

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Authentication | 20 req | 1 hour |
| Password Reset | 5 req | 1 hour |
| Profile Updates | 30 req | 1 hour |
| Data Export | 1 req | 24 hours |

### Rate Limit Headers

```http
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 15
X-RateLimit-Reset: 1704123600
```

### Rate Limit Response (429)

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please try again later.",
    "retryAfter": 3600
  }
}
```

---

## Webhook Endpoints

### Stripe Webhooks

```http
POST /api/webhooks/stripe
```

Required Headers:
```http
Stripe-Signature: {signature}
```

Handled Events:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

---

## Error Codes Reference

| Code | Description | Action Required |
|------|-------------|-----------------|
| AUTH_INVALID_CREDENTIALS | Wrong email/password | Check credentials |
| AUTH_SESSION_EXPIRED | Session token expired | Sign in again |
| AUTH_EMAIL_NOT_VERIFIED | Email needs verification | Check email |
| AUTH_RATE_LIMITED | Too many requests | Wait and retry |
| AUTH_USER_SUSPENDED | Account suspended | Contact support |
| AUTH_WEAK_PASSWORD | Password too weak | Use stronger password |
| AUTH_EMAIL_EXISTS | Email already registered | Use different email or sign in |
| INVALID_INPUT | Request validation failed | Check request format |
| INSUFFICIENT_PERMISSIONS | Not authorized | Upgrade tier or contact support |

---

## SDK Usage Examples

### JavaScript/TypeScript

```typescript
// Sign In
const response = await fetch('/api/auth/signin', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include', // Important for cookies
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

const data = await response.json();
if (data.success) {
  // Redirect to dashboard
  window.location.href = data.redirectTo || '/dashboard';
}
```

### cURL

```bash
# Sign In
curl -X POST https://moshimoshi.app/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}' \
  -c cookies.txt

# Get Profile (with session)
curl -X GET https://moshimoshi.app/api/user/profile \
  -b cookies.txt
```

---

*Next: [Security Guidelines →](./05-security-guidelines.md)*