# Authentication System

**Status:** ACTIVE
**Last Updated:** 2026-01-28

## Overview

Moshimoshi's authentication system provides secure user authentication via multiple providers (Google, Apple) with Firebase Auth integration. The system uses server-side session management with JWT tokens stored in Redis, and includes special handling for Safari's ITP (Intelligent Tracking Prevention).

## Quick Start

1. **Review auth flows**: See `AUTH_FLOW_DEBUG_GUIDE.md` for detailed authentication flows
2. **Apple Sign-In**: Uses Apple's native JS SDK to bypass Safari ITP issues
3. **Google Sign-In**: Standard Firebase OAuth flow with popup mode
4. **Session management**: Server-side JWT validation with 24hr expiry

## Documentation

| Document | Description |
|----------|-------------|
| [AUTH_FLOW_DEBUG_GUIDE.md](./AUTH_FLOW_DEBUG_GUIDE.md) | Complete guide to authentication flows including Apple Sign-In Safari fix |
| [AUTHENTICATION_DEEPDIVE.md](./AUTHENTICATION_DEEPDIVE.md) | Deep dive into authentication architecture and implementation |

## Key Topics

- **Multi-provider auth** - Google and Apple Sign-In
- **Safari ITP workaround** - Apple native JS SDK implementation
- **Server-side sessions** - JWT tokens in Redis with 24hr expiry
- **Firebase integration** - Firebase Auth + Admin SDK
- **Security** - Cookie-based sessions, CSRF protection

## Key Files

- `src/lib/auth/apple-auth.ts:45` - Apple Sign-In with native SDK
- `src/lib/auth/firebase-auth.ts:89` - Firebase auth utilities
- `src/app/api/auth/[...nextauth]/route.ts:123` - Auth API routes
- `src/middleware.ts:67` - Session validation middleware

## Architecture

```
Authentication Flow
├── Client
│   ├── Apple JS SDK (Safari compatible)
│   ├── Google OAuth (Firebase)
│   └── Sign-in UI components
├── Firebase Auth
│   ├── User management
│   ├── Token generation
│   └── Provider integration
└── Server
    ├── Session validation (JWT)
    ├── Redis storage (24hr expiry)
    └── Admin SDK verification
```

## Authentication Flows

### Google Sign-In
1. User clicks Google sign-in button
2. Firebase OAuth popup opens
3. User authenticates with Google
4. Firebase creates/updates user
5. Server creates session (JWT in Redis)
6. User redirected to dashboard

### Apple Sign-In (Safari Compatible)
1. Load Apple JS SDK on page mount
2. User clicks Apple sign-in button
3. Apple native popup opens (bypasses Safari ITP)
4. Receive Apple ID token
5. Exchange for Firebase credential via `signInWithCredential()`
6. Server creates session (JWT in Redis)
7. User redirected to dashboard

## Common Issues

### Apple Sign-In fails on Safari
**Solution**: We use Apple's native JS SDK directly instead of Firebase redirect flow. See `AUTH_FLOW_DEBUG_GUIDE.md` for complete details.

### Session expires too quickly
**Solution**: Sessions are 24hr by default. Check Redis configuration if sessions expire early.

---

*For detailed troubleshooting and implementation, see [AUTH_FLOW_DEBUG_GUIDE.md](./AUTH_FLOW_DEBUG_GUIDE.md)*
