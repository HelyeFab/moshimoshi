# Authentication Deep Dive (Moshimoshi)

This document summarizes the current authentication system as implemented, including key flows, security controls, and known edge cases. It is intended to give a new developer a fast, accurate mental model of how auth works end‑to‑end.

Last updated: 2026-01-26

---

## High‑Level Architecture

Moshimoshi uses a **hybrid model**:

1. **Firebase Auth (client)** for identity verification in some flows (Google/Apple popup/redirect, magic link verification).
2. **Next.js API routes** for server‑side session creation, policy enforcement, and access control.
3. **JWT session cookie** (`session`) stored as HTTP‑only cookie and validated on the server.
4. **Redis** for session cache (required for `getSession()`), tier cache, and security rate‑limit state.

Important: **Server session creation is authoritative** for app access. Firebase client auth alone is not enough to access app data or protected routes.

---

## Core Concepts

### 1) Session Cookie

- Name: `session`
- Type: JWT (HS256, server‑signed)
- Stored in Redis under `session:{sid}` and **must exist there** for `getSession()` to accept the session.
- Cookies are set with `httpOnly`, `secure` in production, `sameSite: 'lax'`.

Primary code:
- `src/lib/auth/jwt.ts`
- `src/lib/auth/session.ts`

### 2) Session Validation

`getSession()` performs:
1. Reads cookie.
2. Decodes JWT to get `sid`.
3. Looks up `session:{sid}` in Redis.
4. Validates JWT signature & expiry.

If Redis is down or the cache write fails, the cookie **alone is not accepted**.

Primary code:
- `src/lib/auth/session.ts`

### 3) Tier / Entitlements

Tier is **not permanently embedded** in new JWTs (migration in progress).
Tier resolution priority:
1. `TierCache` (Redis, short TTL)
2. Fallback to JWT tier (legacy)
3. Fallback to `free`

Primary code:
- `src/lib/auth/tier-cache.ts`
- `src/lib/auth/session.ts#getTierForSession`

---

## Auth Flow Diagrams (ASCII)

### 1) Email/Password Sign‑In (Authoritative)

```
Browser UI
  └─ POST /api/auth/signin (email, password, recaptcha)
        ├─ rate limit + lockout
        ├─ reCAPTCHA (if enabled)
        ├─ Firebase REST verify password
        ├─ userState checks (suspended/deleted)
        ├─ createSession() → JWT + Redis + cookie
        └─ response { success, requiresVerification }

Browser
  └─ useAuth.checkSession() → GET /api/auth/session
        └─ returns user + tier (from cache)
```

### 2) Google OAuth

```
Browser UI
  └─ Firebase popup/redirect → ID token
        └─ POST /api/auth/google (idToken)
              ├─ verify token (Admin SDK)
              ├─ ensure user profile
              ├─ create JWT + Redis + cookie
              └─ response { success }

Browser
  └─ useAuth.checkSession() → GET /api/auth/session
```

### 3) Magic Link

```
Browser
  └─ POST /api/auth/magic-link (email)
        └─ sends email link

User clicks link
  └─ /auth/verify-magic-link
        ├─ Firebase signInWithEmailLink()
        └─ POST /api/auth/google (idToken)
```

---

## Auth Flows (End‑to‑End)

### A) Email/Password Signup

Endpoint:
- `POST /api/auth/signup`

Behavior:
- Validates input (zod)
- reCAPTCHA (if enabled)
- Creates Firebase user via Admin SDK
- Creates Firestore user profile
- Sends verification email
- Creates server session (JWT cookie)
- Returns `requiresVerification: true`

Important:
- Email is **not required** to be verified to log in (policy choice).
- Unverified users can access app but should see banner.

Primary code:
- `src/app/api/auth/signup/route.ts`
- `src/components/EmailVerificationBanner.tsx`

### B) Email/Password Sign‑In

Endpoint:
- `POST /api/auth/signin` (authoritative)

Behavior:
- Validates input (zod)
- reCAPTCHA (if enabled)
- Rate limiting and lockouts (per email & IP)
- Checks user state (suspended/deleted)
- Creates session cookie (JWT + Redis)
- Returns `requiresVerification` if email not verified

Client entrypoint:
- `src/hooks/useAuth.ts` → `signIn(...)`
- `src/app/[locale]/auth/signin/page.tsx`

Note:
- **Unverified users are allowed to sign in**, unless a hard enforcement flag is turned on (see environment flags below).

Primary code:
- `src/app/api/auth/signin/route.ts`
- `src/hooks/useAuth.ts`

### C) Google OAuth

Flow:
1. Client Firebase popup/redirect → gets ID token
2. POST `/api/auth/google` with ID token
3. Server verifies token, creates/updates user
4. Creates session cookie and Redis cache entry

Primary code:
- `src/app/api/auth/google/route.ts`
- `src/app/[locale]/auth/signin/page.tsx` (Google flow)

### D) Apple OAuth

Flow:
1. Client Apple JS SDK or Firebase OAuth → gets ID token
2. POST `/api/auth/apple` with ID token
3. Server verifies token, creates/updates user
4. Creates session cookie and Redis cache entry

Primary code:
- `src/app/api/auth/apple/route.ts`
- `src/lib/auth/apple-auth.ts`

### E) Magic Link

Flow:
1. POST `/api/auth/magic-link` to generate link
2. User clicks link → `/auth/verify-magic-link`
3. Client verifies via Firebase `signInWithEmailLink`
4. Client sends ID token to `/api/auth/google` to create session

Primary code:
- `src/app/api/auth/magic-link/route.ts`
- `src/app/[locale]/auth/verify-magic-link/page.tsx`

### F) Guest Session

Endpoint:
- `POST /api/auth/guest-session`

Behavior:
- Creates short‑lived JWT with `tier: guest`
- Stores session cookie
- Sets client sessionStorage flags to avoid normal auth

Primary code:
- `src/app/api/auth/guest-session/route.ts`
- `src/hooks/useAuth.ts` (guest handling)

---

## Access Control

### Route‑level (middleware)

- Next.js middleware checks:
  - protected routes (must have valid session)
  - admin routes (must be admin)
  - pre‑launch lock

Protected route list: `PROTECTED_ROUTES` in `src/middleware.ts`.

Behavior:
1. If no session cookie → redirect to `/auth/signin`
2. If cookie exists → calls `/api/auth/session`
3. If `authenticated: true` → allow
4. If admin route and not admin → redirect to `/dashboard`

Primary code:
- `src/middleware.ts`

### API‑level

- Server routes should use `getSession()` or `requireAuth()` from `src/lib/auth/session.ts`.
- Admin APIs should use `requireAdmin()` or explicit admin checks.

Primary code:
- `src/lib/auth/session.ts`
- `src/lib/auth.ts` (legacy compatibility layer)

---

## Auth Data Model (User Profile)

User documents live in Firestore under `users/{uid}` and typically include:
- `displayName`
- `emailVerified`
- `authProvider` (email, google, apple, magic-link)
- `subscription` object (plan, status, etc.)
- `userState` (active | suspended | deleted)

Important: `getUserTier()` reads from `userData.subscription` and falls back to legacy `userData.tier`.

Primary code:
- `src/lib/auth/tier-utils.ts`
- `docs/authentication/02-user-profile-structure.md`

---

## Storage Touchpoints (Client)

Local/session storage used during auth:
- `sessionStorage.isGuestUser` — guest override
- `sessionStorage.auth-flow-in-progress` — OAuth flow retry logic
- `localStorage.auth-user` — minimal uid/email cache for theme/locale
- `localStorage.auth-user-cache` — offline fallback cache

Primary code:
- `src/hooks/useAuth.ts`

---

## Middleware & Pre‑Launch Lock

`src/middleware.ts` handles:
- Locale routing (`next-intl`)
- Pre‑launch lock: redirects non‑allowed routes unless session cookie exists
- Protected route checks: redirects to `/auth/signin` if unauthenticated
- Admin route checks: redirects to `/dashboard` if not admin

Note: Protected routes are defined in `PROTECTED_ROUTES`.

---

## Key Server Endpoints (Auth)

- `POST /api/auth/signup` — create user + verification email + session
- `POST /api/auth/signin` — email/password login + policy enforcement
- `POST /api/auth/google` — Google OAuth token verification + session
- `POST /api/auth/apple` — Apple OAuth token verification + session
- `POST /api/auth/magic-link` — send magic link
- `GET /api/auth/session` — validate cookie, return session + user profile
- `POST /api/auth/signout` — clear session + audit logs
- `POST /api/auth/logout` — legacy logout (no audit)
- `POST /api/auth/refresh` — refresh session if near expiry / forced refresh
- `GET /api/auth/session-check` — detect tier mismatch

---

## Email Verification Policy

Current policy (intended):
- **Signup** sends verification email.
- **Signin** allows access even if unverified.
- UI displays verification banner to prompt user.

Enforcement toggle:
- `ENFORCE_EMAIL_VERIFICATION === 'true'` can be used to hard‑block unverified logins.
- If enabled, `POST /api/auth/signin` can be adjusted to deny unverified users.

Primary code:
- `src/app/api/auth/signin/route.ts`
- `src/components/EmailVerificationBanner.tsx`

---

## Rate Limiting & Security Controls

Applied at `/api/auth/signin`, `/api/auth/signup`, `/api/auth/magic-link`:
- Rate limiting per email + IP
- Lockout on repeated failures
- reCAPTCHA (if configured)
- Audit logging

Primary code:
- `src/lib/auth/rateLimit.ts`
- `src/lib/auth/audit.ts`
- `src/lib/auth/recaptcha.ts`
- `src/lib/auth/validation.ts`

---

## Known Edge Cases / Operational Risks

1. **Redis required for sessions**  
   OAuth login sets JWT even if Redis write fails, but `getSession()` rejects sessions without Redis. This can cause “login succeeded then immediately logged out” if Redis is down.

2. **Multiple logout endpoints**  
   `/api/auth/logout` vs `/api/auth/signout` are both used. Only `/signout` logs audits and returns security headers.

3. **Firebase Admin initialization**  
   API routes depending on Admin SDK will fail if environment variables are missing.

4. **Client Firebase auth dependency**  
   Some admin pages use `auth.currentUser?.getIdToken()` and will only work if the Firebase client auth session exists.

---

## Where to Look First (Quick Jumpstart)

- Auth client hook: `src/hooks/useAuth.ts`
- Session utilities: `src/lib/auth/session.ts`
- JWT handling: `src/lib/auth/jwt.ts`
- Middleware protection: `src/middleware.ts`
- Auth endpoints: `src/app/api/auth/*`
- Email verification UI: `src/components/EmailVerificationBanner.tsx`

---

## Environment Flags / Config

- `JWT_SECRET` — required for session signing
- `ENFORCE_EMAIL_VERIFICATION` — if true, can block unverified login
- `NEXT_PUBLIC_FIREBASE_API_KEY` — required for server‑side password verification
- Firebase Admin credentials:
  - `FIREBASE_ADMIN_PROJECT_ID`
  - `FIREBASE_ADMIN_CLIENT_EMAIL`
  - `FIREBASE_ADMIN_PRIVATE_KEY`

---

## Troubleshooting Checklist

### Login failed immediately after success
1. Check Redis health — session lookup requires Redis.
2. Verify `session` cookie is set in browser.
3. Check `/api/auth/session` response in network tab.

### Email/password sign‑in blocked unexpectedly
1. Confirm `ENFORCE_EMAIL_VERIFICATION` value.
2. Inspect `/api/auth/signin` response for `AUTH_ACCOUNT_SUSPENDED` or `AUTH_ACCOUNT_DELETED`.

### OAuth login loops back to signin
1. Check for `session` cookie set after `/api/auth/google` or `/api/auth/apple`.
2. Verify Redis write (server logs).
3. Confirm middleware is not redirecting due to missing session.

### Admin access denied
1. Ensure user has `isAdmin` true in Firestore.
2. Ensure session includes `admin` or `/api/auth/session` returns `isAdmin: true`.

---

## Minimal Test Matrix (Manual)

- Signup with reCAPTCHA enabled
- Signin (email/password) with verified + unverified email
- OAuth sign‑in (Google + Apple)
- Magic link request + verification
- Guest session creation + route access
- Admin route access (admin vs non‑admin)
- Session refresh near expiry
- Rate‑limit / lockout (too many failed logins)

---

## Suggested Future Cleanup (Optional)

- Consolidate `/api/auth/logout` and `/api/auth/signout`.
- Ensure admin checks are consistent for email/password logins.
- Decide if Firebase client auth is required everywhere or can be removed.
- Make Redis failure behavior explicit (fail login vs accept JWT fallback).
