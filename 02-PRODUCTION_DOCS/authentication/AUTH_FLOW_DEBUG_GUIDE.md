# Authentication Flow & Apple Sign-In Guide

**Created:** 2026-01-26
**Status:** RESOLVED
**Issue:** Apple Sign-In fails on Safari Mac and Physical iPhone, works on iPhone Simulator
**Resolution Date:** 2026-01-26

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [The Solution](#the-solution)
3. [Root Cause Analysis](#root-cause-analysis)
4. [Architecture Overview](#architecture-overview)
5. [Key Files Reference](#key-files-reference)
6. [Authentication Flows](#authentication-flows)
7. [Configuration Requirements](#configuration-requirements)
8. [What We Tried (For Reference)](#what-we-tried-for-reference)
9. [Related Resources](#related-resources)

---

## Executive Summary

### The Problem (SOLVED)
Apple Sign-In was failing on Safari browsers (Mac and iOS) while working on:
- Desktop browsers with popup flow
- iPhone Simulator

### Root Cause
**Safari 16.1+ blocks third-party storage access**, which breaks Firebase's `signInWithRedirect` flow. Firebase uses a cross-origin iframe to pass credentials back from the auth handler, but Safari's ITP (Intelligent Tracking Prevention) blocks this communication.

The iPhone Simulator has relaxed ITP settings, which is why it worked there but not on real devices.

### The Solution
Use **Apple's native Sign In with Apple JS SDK** directly instead of Firebase's OAuth wrapper:
1. Load Apple's JS SDK on page mount
2. Use `AppleID.auth.signIn()` with popup mode
3. Exchange Apple's ID token for Firebase credential via `signInWithCredential()`

This bypasses Firebase's problematic redirect flow entirely.

---

## The Solution

### Implementation Files

#### `src/lib/auth/apple-auth.ts` (NEW FILE)
Handles Apple Sign-In using Apple's native JS SDK:

```typescript
/**
 * Apple Sign-In using Apple's native JS SDK
 * Bypasses Firebase's signInWithRedirect which has Safari ITP issues
 */

// Preload SDK on page mount (avoids popup blocking)
export function preloadAppleSDK(): void {
  // Loads https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js
  // Initializes with clientId, scope, redirectURI, usePopup: true
}

// Sign in and exchange credential
export async function signInWithAppleNative(): Promise<{
  user: User
  isNewUser: boolean
}> {
  // 1. Trigger AppleID.auth.signIn() - opens Apple popup
  // 2. Get id_token from Apple response
  // 3. Create Firebase OAuthCredential
  // 4. Sign in with signInWithCredential(auth, credential)
  // 5. Return Firebase user
}
```

#### `src/app/[locale]/auth/signin/page.tsx`
Modified `handleAppleSignIn()`:

```typescript
const handleAppleSignIn = async () => {
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

  // For Safari/iOS: Use Apple's native JS SDK
  if (deviceInfo.isIOS || isSafari) {
    const { signInWithAppleNative } = await import('@/lib/auth/apple-auth')
    const { user } = await signInWithAppleNative()

    // Create server session with Firebase token
    const idToken = await user.getIdToken()
    await fetch('/api/auth/apple', {
      method: 'POST',
      body: JSON.stringify({ idToken })
    })
    return
  }

  // For other browsers: Use Firebase popup (still works)
  const result = await signInWithPopup(auth, provider)
  // ...
}
```

Added SDK preload on mount:
```typescript
useEffect(() => {
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
  if (deviceInfo.isIOS || isSafari) {
    import('@/lib/auth/apple-auth').then(({ preloadAppleSDK }) => {
      preloadAppleSDK()
    })
  }
}, [])
```

#### `src/app/[locale]/auth/signup/page.tsx`
Same changes as signin page.

### Why This Works

| Approach | Safari Support | Reason |
|----------|---------------|--------|
| Firebase `signInWithRedirect` | BROKEN | Uses cross-origin iframe blocked by ITP |
| Firebase `signInWithPopup` | BLOCKED | Safari blocks popups aggressively |
| Apple JS SDK (popup mode) | WORKS | Apple's own popup, same-origin communication |

Apple's JS SDK uses a first-party popup from `appleid.apple.com` that communicates back via `postMessage` to the same origin. Since the redirect URL is `https://moshimoshi.app` (same origin), the message passes through.

---

## Root Cause Analysis

### The Technical Issue

1. **Firebase's Redirect Flow Architecture:**
   ```
   Your App (moshimoshi.app)
         ↓ signInWithRedirect
   Apple OAuth (appleid.apple.com)
         ↓ User authenticates
   Firebase Auth Handler (auth.moshimoshi.app/__/auth/handler)
         ↓ Stores credential in cross-origin iframe
   Your App (moshimoshi.app)
         ↓ getRedirectResult() tries to read from iframe
   BLOCKED by Safari ITP!
   ```

2. **Safari's ITP (Intelligent Tracking Prevention):**
   - Blocks third-party storage access
   - Prevents cross-origin iframe communication
   - Affects Safari 16.1+, Chrome 115+, Firefox 109+

3. **Why Simulator Worked:**
   - iPhone Simulator has different/relaxed ITP settings
   - Does not fully replicate Safari's privacy restrictions

### The Fix Architecture

```
Your App (moshimoshi.app)
      ↓ AppleID.auth.signIn() - Apple's SDK
Apple OAuth Popup (appleid.apple.com)
      ↓ User authenticates
      ↓ Apple returns id_token via postMessage to moshimoshi.app
Your App (moshimoshi.app)
      ↓ signInWithCredential(credential from id_token)
Firebase Auth
      ↓ User authenticated!
```

No cross-origin communication needed - everything stays on `moshimoshi.app`.

---

## Architecture Overview

### Authentication Stack
```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT SIDE                               │
├─────────────────────────────────────────────────────────────────┤
│  Next.js App (App Router)                                       │
│  ├── Apple JS SDK (Safari/iOS)                                  │
│  ├── Firebase Auth SDK (other browsers)                         │
│  ├── useAuth Hook (context provider)                            │
│  └── Sign-in/Sign-up Pages                                      │
├─────────────────────────────────────────────────────────────────┤
│                      SERVER SIDE                                 │
├─────────────────────────────────────────────────────────────────┤
│  Next.js API Routes                                             │
│  ├── /api/auth/apple    - Apple token verification              │
│  ├── /api/auth/google   - Google token verification             │
│  ├── /api/auth/session  - Session check                         │
│  └── /api/auth/signup   - Email/password signup                 │
│                                                                  │
│  Session Management                                              │
│  ├── JWT tokens (custom implementation)                         │
│  ├── Redis caching for session validation                       │
│  └── HTTP-only cookies (SameSite=Lax)                          │
└─────────────────────────────────────────────────────────────────┘
```

### OAuth Flow for Apple Sign-In (CURRENT - WORKING)

```
┌──────────┐     ┌──────────────────┐     ┌─────────────────┐
│  User    │────>│  moshimoshi.app  │────>│  Apple OAuth    │
│  clicks  │     │  AppleID.auth    │     │  Popup          │
└──────────┘     │  .signIn()       │     └─────────────────┘
                 └──────────────────┘              │
                                                   │ User authenticates
                                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│  Apple returns id_token via postMessage to moshimoshi.app        │
└──────────────────────────────────────────────────────────────────┘
                                                   │
                                                   ▼
┌──────────┐     ┌──────────────────┐     ┌─────────────────┐
│  User    │<────│  Server creates  │<────│  signInWith     │
│  logged  │     │  session         │     │  Credential()   │
│  in!     │     └──────────────────┘     └─────────────────┘
└──────────┘
```

---

## Key Files Reference

### Apple Native Auth
| File | Purpose |
|------|---------|
| `src/lib/auth/apple-auth.ts` | Apple JS SDK integration, preloading, credential exchange |

### Client-Side Authentication
| File | Purpose |
|------|---------|
| `src/hooks/useAuth.ts` | Main auth hook, session management |
| `src/app/[locale]/auth/signin/page.tsx` | Sign-in page with Apple handler |
| `src/app/[locale]/auth/signup/page.tsx` | Sign-up page with Apple handler |
| `src/lib/utils/device-detection.ts` | iOS/Safari detection |

### Server-Side Authentication
| File | Purpose |
|------|---------|
| `src/app/api/auth/apple/route.ts` | Verifies Apple tokens, creates sessions |
| `src/app/api/auth/google/route.ts` | Verifies Google tokens, creates sessions |
| `src/app/api/auth/session/route.ts` | Session validation |

### Firebase Configuration
| File | Purpose |
|------|---------|
| `src/lib/firebase/config-base.ts` | Firebase config with auth domain |
| `src/lib/firebase/client.ts` | Client-side Firebase initialization |

---

## Authentication Flows

### Flow 1: Apple Sign-In on Safari/iOS (Using Apple JS SDK) - WORKS
```
1. User clicks "Continue with Apple"
2. handleAppleSignIn() detects: isSafari=true OR isIOS=true
3. AppleID.auth.signIn() opens Apple popup
4. User authenticates with Apple (Face ID / password)
5. Apple returns id_token via postMessage
6. signInWithCredential(auth, credential) authenticates with Firebase
7. Client gets idToken from user.getIdToken()
8. Client POSTs to /api/auth/apple with idToken
9. Server verifies, creates session, sets cookie
10. User redirected to dashboard
```

### Flow 2: Apple Sign-In on Desktop Chrome/Firefox (Using Firebase Popup) - WORKS
```
1. User clicks "Continue with Apple"
2. handleAppleSignIn() detects: isSafari=false AND isIOS=false
3. signInWithPopup(auth, provider) opens Apple popup
4. User authenticates with Apple
5. Popup returns credential to signInWithPopup()
6. Client gets idToken from user.getIdToken()
7. Client POSTs to /api/auth/apple with idToken
8. Server verifies, creates session, sets cookie
9. User redirected to dashboard
```

### Flow 3: Google Sign-In (Using Firebase Popup) - WORKS
```
1. User clicks "Continue with Google"
2. signInWithPopup(auth, googleProvider)
3. User authenticates with Google
4. Popup returns credential
5. Client POSTs to /api/auth/google
6. Server creates session
7. User redirected to dashboard
```

---

## Configuration Requirements

### Apple Developer Console

**Services ID:** `com.moshimoshi.web`

**Domains and Subdomains:**
- `auth.moshimoshi.app`
- `moshimoshi.app`

**Return URLs (CRITICAL for popup mode):**
- `https://moshimoshi.app` ← Required for Apple JS SDK popup mode
- `https://auth.moshimoshi.app/__/auth/handler` ← For Firebase redirect (backup)
- `https://moshimoshi-de237.firebaseapp.com/__/auth/handler` ← For Firebase redirect (backup)

### Firebase Console

**Authentication → Sign-in method → Apple:** Enabled

**Authentication → Settings → Authorized domains:**
- `moshimoshi.app`
- `auth.moshimoshi.app`
- `moshimoshi-de237.firebaseapp.com`
- `moshimoshi-de237.web.app`

### Environment Variables
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=auth.moshimoshi.app
NEXT_PUBLIC_FIREBASE_PROJECT_ID=moshimoshi-de237
NEXT_PUBLIC_APPLE_CLIENT_ID=com.moshimoshi.web  # Optional, has default
```

---

## What We Tried (For Reference)

These approaches did NOT work due to Safari's ITP:

| Approach | Result | Why It Failed |
|----------|--------|---------------|
| Increased redirect timeout | No effect | Timeout wasn't the issue |
| Skip popup, use redirect directly | Still failed | ITP blocks credential storage |
| Apple redirect recovery flag | Detected flag, but user=null | ITP prevents credential access |
| Extended Safari detection | Same null credential | Same ITP issue |
| Use default Firebase authDomain | Still failed | Cross-origin still blocked |
| Redeploy Firebase Hosting | No change | Auth handler was fine |
| Proxy auth requests via Next.js rewrites | Broke Google auth, 404s | Complex, fragile approach |

The only solution that worked: **Bypass Firebase's redirect entirely with Apple's native SDK**.

---

## Related Resources

### Official Documentation
- [Firebase: Best practices for signInWithRedirect](https://firebase.google.com/docs/auth/web/redirect-best-practices)
- [Apple: Sign in with Apple JS](https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_js)
- [Apple: Configuring Your Webpage](https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_js/configuring_your_webpage_for_sign_in_with_apple)

### Key Forum/Issue References
- [Firebase GitHub #6716: Safari 16.1+ Login Problem](https://github.com/firebase/firebase-js-sdk/issues/6716)
- [Apple Developer Forums: Popup redirectURI requirements](https://developer.apple.com/forums/thread/130666)
- [Next.js Firebase Auth Safari Fix](https://www.codejam.info/2024/05/nextjs-firebase-auth-safari.html)

### Key Commits (Solution)
| Commit | Description |
|--------|-------------|
| `b390df41` | fix(auth): Use current origin as Apple redirect URL for popup mode |
| `1b000a97` | fix(auth): Preload Apple SDK and use correct redirect URL |
| `3239ccc8` | feat(auth): Use Apple's native JS SDK for Safari/iOS sign-in |

---

## Summary

**Problem:** Firebase's `signInWithRedirect` is broken on Safari 16.1+ due to ITP.

**Solution:** Use Apple's native JS SDK with `signInWithCredential()` to bypass Firebase's redirect flow.

**Key Requirements:**
1. Load Apple's JS SDK on page mount (avoid popup blocking)
2. Use `https://moshimoshi.app` as redirect URL (same origin)
3. Add that URL to Apple Developer Console Return URLs
4. Exchange Apple's id_token for Firebase credential

**Result:** Apple Sign-In now works on all browsers including Safari Mac and iOS Safari.

---

*Last Updated: 2026-01-26 15:45 UTC*
*Status: RESOLVED*
