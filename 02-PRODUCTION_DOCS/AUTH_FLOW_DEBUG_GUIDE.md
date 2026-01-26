# Authentication Flow & Apple Sign-In Debug Guide

**Created:** 2026-01-26
**Status:** Active Investigation
**Issue:** Apple Sign-In fails on Safari Mac and Physical iPhone, works on iPhone Simulator

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Key Files Reference](#key-files-reference)
4. [Authentication Flows](#authentication-flows)
5. [The Apple Sign-In Issue](#the-apple-sign-in-issue)
6. [What We've Tried](#what-weve-tried)
7. [Current Debug Logging](#current-debug-logging)
8. [Configuration Details](#configuration-details)
9. [Next Steps](#next-steps)

---

## Executive Summary

### The Problem
Apple Sign-In works on:
- Desktop browsers (popup flow) ✓
- iPhone Simulator ✓

Apple Sign-In FAILS on:
- Safari Mac (redirect flow) ✗
- Physical iPhone Safari ✗
- Physical iPhone Chrome ✗

### Root Cause (Suspected)
Firebase's `getRedirectResult()` returns `null` after Apple Sign-In redirect on real Safari browsers. The `onAuthStateChanged` listener also fires with `null` user. This means Firebase Auth SDK is not receiving/storing the Apple credential after the OAuth redirect.

### Key Insight
The iPhone Simulator works, but real Safari browsers don't. This suggests either:
1. Safari's ITP (Intelligent Tracking Prevention) is blocking something
2. Firebase Hosting auth handler was out of sync (just redeployed)
3. Storage/cookie differences between simulator and real browsers

---

## Architecture Overview

### Authentication Stack
```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT SIDE                               │
├─────────────────────────────────────────────────────────────────┤
│  Next.js App (App Router)                                       │
│  ├── Firebase Auth SDK (v12.7.0)                                │
│  ├── useAuth Hook (context provider)                            │
│  └── Sign-in/Sign-up Pages                                      │
├─────────────────────────────────────────────────────────────────┤
│                     FIREBASE SERVICES                            │
├─────────────────────────────────────────────────────────────────┤
│  Firebase Auth                                                   │
│  ├── Custom Auth Domain: auth.moshimoshi.app                    │
│  ├── Auth Handler: /__/auth/handler                             │
│  └── Supports: Email, Google, Apple, Magic Link                 │
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

### OAuth Flow for Apple Sign-In
```
┌──────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌──────────┐
│  User    │────>│  moshimoshi.app  │────>│  Apple OAuth    │────>│  User    │
│  clicks  │     │  signInWithRedirect│    │  (Face ID)     │     │  auth    │
└──────────┘     └──────────────────┘     └─────────────────┘     └──────────┘
                                                   │
                                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  Apple POSTs credentials to: https://auth.moshimoshi.app/__/auth/handler    │
└──────────────────────────────────────────────────────────────────────────────┘
                                                   │
                                                   ▼
┌──────────┐     ┌──────────────────┐     ┌─────────────────┐
│  App     │<────│  Firebase stores │<────│  Auth handler   │
│  loads   │     │  auth state      │     │  processes      │
└──────────┘     └──────────────────┘     └─────────────────┘
                         │
                         ▼
              getRedirectResult() or
              onAuthStateChanged()
              should return user
                         │
                         ▼
              ┌─────────────────────┐
              │  ISSUE: Returns     │
              │  NULL on Safari!    │
              └─────────────────────┘
```

---

## Key Files Reference

### Client-Side Authentication

#### `src/hooks/useAuth.ts`
**Purpose:** Main authentication hook providing auth context to the app.

**Key Functions:**
- `initAuth()` (line ~805) - Initializes auth on app mount, checks redirect results
- `createServerSession()` (line ~174) - Creates server session after OAuth
- `signInWithApple()` (line ~575) - Apple Sign-In via useAuth hook
- `signInWithGoogle()` (line ~651) - Google Sign-In via useAuth hook
- `checkSession()` - Validates session with server

**Critical Code - Redirect Result Handling (line ~805):**
```typescript
// Check for apple-redirect-pending flag (iOS/Safari workaround)
const appleRedirectPending = sessionStorage.getItem('apple-redirect-pending') === 'true'

if (appleRedirectPending) {
  console.log('[Auth Init] Apple redirect recovery: waiting for auth state...')
  sessionStorage.removeItem('apple-redirect-pending')

  // Wait for onAuthStateChanged to fire with user
  const appleUser = await new Promise<User | null>((resolve) => {
    const unsubscribeApple = onAuthStateChanged(auth, (user) => {
      console.log('[Auth Init] Apple redirect recovery: auth state changed, user:', user?.email || 'null')
      if (user) {
        unsubscribeApple()
        resolve(user)
      }
    })

    setTimeout(() => {
      unsubscribeApple()
      console.log('[Auth Init] Apple redirect recovery: timeout, no user found')
      resolve(null)
    }, 10000)
  })

  if (appleUser) {
    await createServerSession(appleUser)
  }
}

// Standard redirect result check
const result = await Promise.race([
  getRedirectResult(auth),
  timeoutPromise
])
```

#### `src/app/[locale]/auth/signin/page.tsx`
**Purpose:** Sign-in page with Google, Apple, Email, and Magic Link options.

**Key Function - `handleAppleSignIn()` (line ~155):**
```typescript
const handleAppleSignIn = async () => {
  // Detect Safari browser
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

  // Use redirect flow for iOS OR Safari (both block popups)
  if (deviceInfo.isIOS || isSafari) {
    sessionStorage.setItem('apple-redirect-pending', 'true')
    await signInWithRedirect(auth, provider)
    return
  }

  // Non-iOS/Safari: try popup first
  try {
    const result = await signInWithPopup(auth, provider)
    // ... handle success
  } catch (popupError) {
    if (popupError.code === 'auth/popup-blocked') {
      sessionStorage.setItem('apple-redirect-pending', 'true')
      await signInWithRedirect(auth, provider)
    }
  }
}
```

#### `src/app/[locale]/auth/signup/page.tsx`
**Purpose:** Sign-up page with same auth options as signin.

**Same pattern as signin** - `handleAppleSignIn()` at line ~227.

### Device Detection

#### `src/lib/utils/device-detection.ts`
**Purpose:** Detect iOS devices and PWA mode for auth flow decisions.

**Key Functions:**
```typescript
export function isIOSDevice(): boolean {
  if (typeof window === 'undefined') return false
  const userAgent = window.navigator.userAgent.toLowerCase()
  return /iphone|ipad|ipod/.test(userAgent)
}

export function getAuthRedirectTimeout(): number {
  return isIOSDevice() ? 15000 : 5000  // 15s for iOS, 5s for others
}

export function getDeviceInfo(): DeviceInfo {
  return {
    isIOS: isIOSDevice(),
    isAndroid: isAndroidDevice(),
    isMobile: isIOS || isAndroid,
    isPWA: isStandaloneMode(),
    isIOSPWA: isIOSPWAStandalone(),
    platform: 'ios' | 'android' | 'desktop'
  }
}
```

### Server-Side Authentication

#### `src/app/api/auth/apple/route.ts`
**Purpose:** Verifies Apple ID tokens and creates server sessions.

**Flow:**
1. Receive `idToken` from client
2. Verify with Firebase Admin SDK
3. Create/update user in Firestore
4. Generate JWT session token
5. Store session in Redis
6. Set HTTP-only session cookie

#### `src/app/api/auth/google/route.ts`
**Purpose:** Same as Apple route but for Google tokens.

#### `src/app/api/auth/session/route.ts`
**Purpose:** Validates existing sessions, returns user data.

### Firebase Configuration

#### `src/lib/firebase/config-base.ts`
```typescript
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,  // auth.moshimoshi.app
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,    // moshimoshi-de237
  // ...
}
```

#### `src/lib/firebase/client.ts`
**Purpose:** Client-side Firebase initialization.
- Exports `auth` (Firebase Auth instance)
- Exports `firestore`, `storage`, etc.

---

## Authentication Flows

### Flow 1: Apple Sign-In on Desktop (Popup) - WORKS
```
1. User clicks "Continue with Apple"
2. handleAppleSignIn() detects: isIOS=false, isSafari=false
3. signInWithPopup(auth, provider) opens Apple popup
4. User authenticates with Apple
5. Popup returns credential to signInWithPopup()
6. Client gets idToken from user.getIdToken()
7. Client POSTs to /api/auth/apple with idToken
8. Server verifies, creates session, sets cookie
9. User redirected to dashboard
```

### Flow 2: Apple Sign-In on iOS/Safari (Redirect) - BROKEN
```
1. User clicks "Continue with Apple"
2. handleAppleSignIn() detects: isIOS=true OR isSafari=true
3. sessionStorage.setItem('apple-redirect-pending', 'true')
4. signInWithRedirect(auth, provider) - user leaves app
5. User authenticates with Apple (Face ID)
6. Apple POSTs to auth.moshimoshi.app/__/auth/handler
7. Firebase auth handler processes credential
8. User redirected back to app

--- ON RETURN TO APP ---

9. App loads, useAuth's initAuth() runs
10. Detects 'apple-redirect-pending' flag
11. Sets up onAuthStateChanged listener
12. ISSUE: onAuthStateChanged fires with user=null
13. getRedirectResult() also returns null
14. No user credential available
15. User stays on signin page (not authenticated)
```

### Flow 3: Google Sign-In (Redirect) - WORKS
```
Same as Flow 2, but:
- getRedirectResult() returns user successfully
- onAuthStateChanged fires with valid user
- Session is created
```

---

## The Apple Sign-In Issue

### Symptoms
1. After Apple authentication (Face ID succeeds), user is redirected back
2. `getRedirectResult(auth)` returns `null`
3. `onAuthStateChanged` fires with `null` user
4. `/api/auth/apple` is NEVER called (checked Vercel logs)
5. User remains on signin page, not authenticated

### Console Logs on Safari Mac (After Redirect)
```
[Auth Init] Apple redirect recovery: waiting for auth state...
[Auth Init] Apple redirect recovery: auth state changed, user: "null"
[Auth Init] Apple redirect recovery: timeout, no user found
[Auth Init] Checking redirect result with 5000 ms timeout
[Auth Init] Redirect result: "null/timeout"
[Auth Init] No redirect result or timeout occurred
```

### Why iPhone Simulator Works
Unknown. Possible reasons:
- Different storage/cookie handling
- Less strict ITP (Intelligent Tracking Prevention)
- Different WebKit build
- Simulator doesn't fully replicate Safari's security restrictions

### Ruling Out Configuration Issues
- ✓ Firebase Console: Apple Sign-In enabled
- ✓ Apple Developer Console: Domains configured (moshimoshi.app, auth.moshimoshi.app)
- ✓ Apple Developer Console: Return URL configured (https://auth.moshimoshi.app/__/auth/handler)
- ✓ Firebase Hosting: Auth handler accessible (returns 200)
- ✓ Custom auth domain: auth.moshimoshi.app resolves correctly

---

## What We've Tried

### 1. Increased Redirect Timeout for iOS
**File:** `src/lib/utils/device-detection.ts`
**Change:** Extended timeout from 5s to 15s for all iOS devices
**Result:** No effect - timeout wasn't the issue

### 2. Skip Popup on iOS, Go Straight to Redirect
**Files:** `signin/page.tsx`, `signup/page.tsx`, `useAuth.ts`
**Change:** For iOS devices, skip `signInWithPopup` and use `signInWithRedirect` directly
**Result:** Redirect works, but credential still not received on return

### 3. Apple Redirect Recovery Flag
**Files:** `signin/page.tsx`, `signup/page.tsx`, `useAuth.ts`
**Change:**
- Set `sessionStorage.setItem('apple-redirect-pending', 'true')` before redirect
- On return, detect flag and wait for `onAuthStateChanged`
**Result:** Flag is detected, but `onAuthStateChanged` fires with null user

### 4. Extended Safari Detection
**Files:** `signin/page.tsx`, `signup/page.tsx`
**Change:** Detect Safari browser and use redirect flow (not just iOS)
```typescript
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
if (deviceInfo.isIOS || isSafari) {
  // Use redirect flow
}
```
**Result:** Redirect happens correctly, but same null credential issue

### 5. Added Default Firebase Auth Domain to Apple
**Where:** Apple Developer Console → Services ID → Return URLs
**Change:** Added `https://moshimoshi-de237.firebaseapp.com/__/auth/handler`
**Result:** No change (was already using custom domain successfully)

### 6. Redeployed Firebase Hosting
**Command:** `firebase deploy --only hosting`
**Date:** 2026-01-26 12:07 UTC
**Reason:** Auth handler at `/__/auth/handler` might have been out of sync with Firebase SDK version
**Result:** Pending testing

---

## Current Debug Logging

### Active Console Logs

**In `useAuth.ts` (initAuth):**
```typescript
console.log('[Auth Init] Apple redirect recovery: waiting for auth state...')
console.log('[Auth Init] Apple redirect recovery: auth state changed, user:', user?.email || 'null')
console.log('[Auth Init] Apple redirect recovery: timeout, no user found')
console.log('[Auth Init] Checking redirect result with', redirectTimeout, 'ms timeout')
console.log('[Auth Init] Redirect result:', result ? 'user found' : 'null/timeout')
console.log('[Auth Init] Redirect result timed out after', redirectTimeout, 'ms')
```

**In `signin/page.tsx` (handleAppleSignIn):**
```typescript
console.log('[Apple SignIn] Button clicked')
console.log('[Apple SignIn] Firebase imported, auth:', auth ? 'exists' : 'null')
console.log('[Apple SignIn] Device info:', deviceInfo)
console.log('[Apple SignIn] Is Safari:', isSafari)
console.log('[Apple SignIn] iOS or Safari detected, using redirect flow directly')
console.log('[Apple SignIn] Popup error:', popupError.code, popupError.message)
console.log('[Apple SignIn] Popup blocked, falling back to redirect')
```

**In `signup/page.tsx` (handleAppleSignIn):**
```typescript
console.log('[Apple SignUp] Device info:', deviceInfo, 'isSafari:', isSafari)
console.log('[Apple SignUp] iOS or Safari detected, using redirect flow directly')
```

---

## Configuration Details

### Environment Variables (Production)
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=auth.moshimoshi.app
NEXT_PUBLIC_FIREBASE_PROJECT_ID=moshimoshi-de237
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=moshimoshi-de237.firebasestorage.app
```

### Apple Developer Console Configuration
**Services ID:** moshimoshi Japanese Learning Platform
**Domains:**
- auth.moshimoshi.app
- moshimoshi.app
- moshimoshi-git-collaborator-access-helyefabs-pr... (preview)

**Return URLs:**
- https://auth.moshimoshi.app/__/auth/handler
- (Should also add) https://moshimoshi-de237.firebaseapp.com/__/auth/handler

### Firebase Console Settings
**Authentication → Sign-in method → Apple:** Enabled
**Authentication → Settings → Authorized domains:**
- moshimoshi.app
- auth.moshimoshi.app
- moshimoshi-de237.firebaseapp.com
- moshimoshi-de237.web.app

---

## Next Steps

### Immediate Actions
1. **Test after Firebase Hosting redeploy** - Auth handler now synced with SDK
2. **If still failing:** Check Safari's ITP settings in detail
3. **If still failing:** Try using default Firebase auth domain instead of custom

### Potential Solutions to Investigate
1. **Use default authDomain** - Change env var to `moshimoshi-de237.firebaseapp.com`
2. **Apple Sign-In JS SDK** - Use Apple's native JS SDK instead of Firebase's wrapper
3. **Custom OAuth flow** - Handle Apple OAuth manually, use `signInWithCredential()`

### How to Test
1. Open Safari on Mac
2. Navigate to https://moshimoshi.app/en/auth/signin
3. Open Web Inspector (Cmd + Option + I) → Console tab
4. Enable "Preserve Log" to keep logs across redirects
5. Click "Continue with Apple"
6. Complete authentication
7. Check console logs on return

### Expected Success Logs
```
[Auth Init] Apple redirect recovery: waiting for auth state...
[Auth Init] Apple redirect recovery: auth state changed, user: "user@email.com"
[Auth Init] Apple redirect recovery: creating session for user@email.com
```

### Current Failure Logs
```
[Auth Init] Apple redirect recovery: waiting for auth state...
[Auth Init] Apple redirect recovery: auth state changed, user: "null"
[Auth Init] Apple redirect recovery: timeout, no user found
```

---

## Related Commits

| Commit | Date | Description |
|--------|------|-------------|
| `c1c22fd9` | 2026-01-26 | Use redirect flow for Safari browser (not just iOS) |
| `5aad630c` | 2026-01-26 | Add console.log to Apple SignIn button handler |
| `ad173de5` | 2026-01-26 | Apple Sign-In iOS redirect recovery via sessionStorage flag |
| `85116e30` | 2026-01-26 | Add console.log for Apple Sign-In redirect debugging |
| `24f56b71` | 2026-01-26 | Wait for onAuthStateChanged after Apple redirect error |
| `b4e1116c` | 2026-01-26 | Workaround for Firebase Apple Sign-In error on iOS Safari |
| `24902408` | 2026-01-26 | Apple Sign-In on iPhone - use redirect flow for all iOS |
| `be2d8d44` | 2026-01-25 | Fix: reCAPTCHA stale closure bug in production |

---

## Contact & Resources

### Firebase Documentation
- [Custom Auth Domain Setup](https://firebase.google.com/docs/auth/web/custom-domain)
- [Apple Sign-In with Firebase](https://firebase.google.com/docs/auth/web/apple)
- [Troubleshooting Auth](https://firebase.google.com/docs/auth/web/troubleshooting)

### Apple Documentation
- [Sign in with Apple JS](https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_js)
- [Configuring Your Webpage for Sign in with Apple](https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_js/configuring_your_webpage_for_sign_in_with_apple)

---

*Last Updated: 2026-01-26 12:15 UTC*
