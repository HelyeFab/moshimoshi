  Moshimoshi App - Complete Authentication & Admin Architecture

  🏗️ Architecture Overview

  Tech Stack:
  - Frontend: Next.js 15.5.2 (App Router), React 19, TypeScript
  - Backend: Next.js API Routes, Firebase Admin SDK
  - Auth: Firebase Authentication (client) + Custom JWT Sessions (server)
  - Database: Firestore
  - Cache: Redis (Upstash) for sessions and tier caching
  - Payments: Stripe

  ---
  🔐 Authentication System (3-Layer Architecture)

  Layer 1: Client-Side Auth (useAuth hook)

  Location: /src/hooks/useAuth.ts

  What it does:
  - Manages Firebase client authentication state
  - Provides auth methods: signIn, signUp, signInWithGoogle, signOut
  - Handles guest mode via sessionStorage.getItem('isGuestUser')
  - Automatically syncs with server sessions
  - Caches session data (5-second TTL) to prevent duplicate API calls
  - Migrates user-specific stores on login

  Key Features:
  const { user, loading, isAuthenticated, isGuest } = useAuth()
  // user: AuthUser with uid, email, displayName, isAdmin, etc.
  // isGuest: true if in guest mode (sessionStorage flag)

  Session Deduplication:
  - Global sessionCache object prevents race conditions
  - Caches promises to deduplicate concurrent requests
  - 5-second cache TTL balances freshness vs performance

  ---
  Layer 2: Server-Side Sessions (/lib/auth/session.ts)

  What it does:
  - Creates JWT tokens with secure session IDs
  - Stores sessions in Redis with TTLs
  - Sets HTTP-only cookies (session cookie)
  - Validates sessions with JWT + Redis checks

  Session Flow:
  1. Login: Firebase ID token → Server validates → Creates JWT + Redis session → Sets cookie
  2. Request: Cookie sent → JWT decoded → Redis cache checked → Session validated
  3. Logout: JWT blacklisted in Redis + Cookie cleared

  Session Structure:
  interface SessionPayload {
    uid: string           // User ID
    email: string
    sid: string          // Session ID (unique per session)
    tier?: string        // Optional (Phase 5 migration to TierCache)
    admin?: boolean      // Admin flag
    fingerprint: string  // Browser fingerprint for security
    iat: number         // Issued at
    exp: number         // Expiration
  }

  Key Functions:
  - getSession(): Returns SessionUser with uid, email, tier, admin
  - createSession(): Creates JWT + Redis cache + cookie
  - isAdmin(): Checks if current session has admin flag
  - requireAdmin(): Throws if not admin (for API routes)

  ---
  Layer 3: Firebase Admin SDK

  Location: /src/lib/firebase/admin.ts

  What it does:
  - Server-side only Firebase operations
  - Verifies Firebase ID tokens
  - Reads/writes Firestore user documents
  - Manages admin custom claims

  Admin Detection:
  // Primary method - checks Firestore user document
  async function isAdminUser(uid: string): Promise<boolean> {
    const userDoc = await adminFirestore.collection('users').doc(uid).get()
    return userDoc.data()?.isAdmin === true
  }

  // Cached version (1-minute TTL) for performance
  async function isAdminUserCached(uid: string): Promise<boolean>

  Admin Claims:
  // Set Firebase custom claims (for security rules)
  await setAdminClaims(uid, true)

  // Updates both:
  // 1. Firebase Auth custom claims: { admin: true }
  // 2. Firestore users/{uid}: { isAdmin: true }

  ---
  👥 Dashboard System

  User Dashboard (/src/app/dashboard/page.tsx)

  Features:
  - Personalized greeting in Japanese (おはよう/こんにちは/こんばんは)
  - Dynamic stats: XP, streak, achievements, drill accuracy
  - LearningVillage: Interactive navigation to all learning features
  - Pokedex card: Collection tracking
  - Guest mode banner: Prompts to sign up
  - Mobile-responsive: Collapsible welcome section

  Data Sources:
  - useAuth(): User info, guest status
  - useXP(): Total XP, level, level info
  - useReviewStats(): Current streak, review stats
  - useAchievementStore(): Unlocked achievements, completion %
  - useSubscription(): Premium status
  - DrillProgressManager: Drill stats

  Session Handling:
  // Dashboard checks auth state
  const { user, loading, isGuest } = useAuth()

  // Redirects if not authenticated and not guest
  useEffect(() => {
    if (!authLoading && !user && !isGuest) {
      router.push('/auth/signin')
    }
  }, [authLoading, user, isGuest, router])

  ---
  Admin Dashboard (/src/app/admin/page.tsx)

  Features:
  - Real-time stats: Users, subscriptions, revenue, lessons
  - Recent users list: Last 5 signups with time ago
  - System status: Database, API response time, cache hit rate
  - News scraping: Manual triggers for NHK Easy, Watanoc, Mainichi
  - Quick actions: Links to all admin tools

  Stats Calculated:
  {
    totalUsers: 150,
    activeUsers: 45,        // Active today
    newUsersToday: 5,
    totalLessons: 150,
    completedLessons: 230,  // Today
    totalCompletedLessons: 15000,
    activeSubscriptions: 12, // Premium users count
    monthlyRevenue: 89.88,   // MRR in GBP
    recentUsers: [...],
    systemStatus: {
      database: 'operational',
      apiResponseTime: 120,  // ms
      cacheHitRate: 94,      // %
      errorRate: 0.02,       // %
      uptime: 99.98          // %
    }
  }

  Admin Access Check:
  - Uses useAdmin() hook from /src/hooks/useAdmin.ts
  - Calls /api/admin/check endpoint
  - Checks both Firebase isAdmin field and JWT admin flag
  - Shows loading state, then access denied if not admin

  ---
  🛡️ Admin Detection System

  Multi-Layer Admin Checks

  1. Client Hook (useAdmin)
  // /src/hooks/useAdmin.ts
  const { isAdmin, isLoading, error, user } = useAdmin()

  // Fetches /api/admin/check
  // Returns: {
  //   isAdmin: boolean,
  //   firebaseIsAdmin: boolean,
  //   jwtAdmin: boolean
  // }

  2. Middleware (src/middleware.ts)
  // Runs on every /admin/* route
  // - Checks session cookie exists
  // - Decodes JWT (basic validation, no signature check)
  // - Checks payload.admin flag
  // - Redirects to /auth/signin if no session
  // - Redirects to /dashboard if not admin

  3. Admin Layout (/src/app/admin/layout.tsx)
  // Wraps all admin pages
  const { isAdmin, isLoading } = useAdmin()

  // Shows:
  // - Loading spinner while checking
  // - Access denied page if not admin
  // - Admin sidebar + content if admin

  4. API Route Protection
  // Example: /src/app/api/admin/stats/route.ts
  const session = await validateSession(request)
  if (!session.valid) return 401

  const userDoc = await adminFirestore.collection('users').doc(session.payload.uid).get()
  if (!userDoc.data()?.isAdmin) return 403

  // Admin-only logic here

  ---
  🔒 Security Model

  Session Security

  1. JWT tokens with HS256 algorithm
  2. Browser fingerprinting (User-Agent + IP hash)
  3. Redis session cache (fast validation without JWT decode every time)
  4. Session blacklisting on logout (stored in Redis with TTL)
  5. HTTP-only cookies (no JavaScript access)
  6. Secure flag in production
  7. SameSite: lax (allows Stripe redirects)

  Admin Security

  1. Firestore field: users/{uid} has isAdmin: true
  2. JWT claim: Session token includes admin: true flag
  3. Middleware check: Basic JWT decode on /admin/* routes
  4. API validation: Full Firebase check + JWT verification
  5. Custom claims: Firebase Auth custom claims for security rules

  Admin Grant Flow:
  // 1. Set in Firestore
  await adminFirestore.collection('users').doc(uid).update({
    isAdmin: true
  })

  // 2. Set custom claims
  await adminAuth.setCustomUserClaims(uid, { admin: true })

  // 3. User must refresh session to get new JWT
  // Can call /api/auth/refresh-session

  ---
  🔄 Session API Routes

  | Route                     | Purpose                                             |
  |---------------------------|-----------------------------------------------------|
  | /api/auth/login           | Create session from Firebase ID token               |
  | /api/auth/google          | Google OAuth session creation                       |
  | /api/auth/session         | Get current session (returns user + tier + isAdmin) |
  | /api/auth/logout          | Clear session + blacklist JWT                       |
  | /api/auth/refresh-session | Refresh session if near expiration                  |
  | /api/admin/check          | Verify admin status (client-side)                   |

  Session Check Response:
  {
    authenticated: true,
    user: {
      uid: "abc123",
      email: "user@example.com",
      tier: "premium_monthly",  // From TierCache
      displayName: "John",
      photoURL: "...",
      isAdmin: true,  // From Firestore
      admin: true     // From JWT (backward compat)
    },
    expiresIn: 3600000  // ms
  }

  ---
  📊 Key Patterns

  1. Hybrid Tier System (Phase 5 Migration)

  // Old: Tier embedded in JWT
  session.tier // May be undefined

  // New: Tier from Redis cache with 60s TTL
  const tier = await getTierForSession(session)
  // Falls back to session.tier if cache fails

  // Invalidate on subscription change
  await invalidateTierCache(userId)

  2. Admin Check Pattern (Most Common)

  // In API routes
  import { getSession, isAdmin } from '@/lib/auth/session'

  const session = await getSession()
  if (!session) return 401

  const isAdminUser = await isAdmin()
  if (!isAdminUser) return 403

  3. Session Caching (Client)

  // Global cache prevents duplicate /api/auth/session calls
  sessionCache = {
    promise: null,      // Ongoing request
    data: null,         // Cached response
    timestamp: 0        // Cache time
  }

  // 5-second TTL
  if (Date.now() - sessionCache.timestamp < 5000) {
    return sessionCache.data
  }

  ---
  🎯 Critical Files Reference

  | File                               | Purpose                      | Line References                                             |
  |------------------------------------|------------------------------|-------------------------------------------------------------|
  | /src/hooks/useAuth.ts              | Client auth state management | 136: createServerSession, 194: checkSession                 |
  | /src/lib/auth/session.ts           | Server session management    | 129: getSession(), 362: isAdmin(), 427: getTierForSession() |
  | /src/lib/auth/jwt.ts               | JWT token operations         | 94: createSessionToken(), 116: verifySessionToken()         |
  | /src/lib/firebase/admin.ts         | Firebase Admin SDK           | 394: isAdminUser(), 355: setAdminClaims()                   |
  | /src/app/api/auth/session/route.ts | Session validation endpoint  | 100: User profile fetch with isAdmin                        |
  | /src/app/api/admin/check/route.ts  | Admin verification endpoint  | 28: Firebase isAdmin check                                  |
  | /src/middleware.ts                 | Route protection             | 29: Admin route middleware                                  |
  | /src/app/dashboard/page.tsx        | User dashboard               | 42: useAuth(), 94: Auth redirect logic                      |
  | /src/app/admin/page.tsx            | Admin dashboard              | 50: Stats fetching                                          |
  | /src/app/admin/layout.tsx          | Admin layout wrapper         | 19: useAdmin() hook                                         |

  ---
  This is a production-grade authentication system with:
  - ✅ Secure JWT sessions with Redis caching
  - ✅ Multi-layer admin verification
  - ✅ Guest mode support
  - ✅ Session deduplication and caching
  - ✅ Stripe integration ready
  - ✅ Mobile-optimized dashboards
  - ✅ Comprehensive error handling

  The system follows defense in depth with checks at middleware, API route, and Firebase levels!
