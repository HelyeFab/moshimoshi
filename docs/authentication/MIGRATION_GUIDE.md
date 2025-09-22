# Authentication Migration Guide

## Overview
This guide explains how to use the new unified authentication system in the Moshimoshi app.

## Quick Start

### For New Features
Always use the unified authentication hook:

```typescript
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth'

export function MyComponent() {
  const { user, loading, error, signIn, signOut } = useUnifiedAuth()

  // Use authentication state and methods as normal
}
```

### For Existing Features
All existing features have been migrated to use `useUnifiedAuth`. The old `useAuth` import still works but now internally uses the unified system.

## What Changed

### Before (Old Pattern)
```typescript
import { useAuth } from '@/hooks/useAuth'
const { user } = useAuth()
// Required AuthProvider wrapper
// Could cause "useAuth must be used within an AuthProvider" errors
```

### After (New Unified Pattern)
```typescript
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth'
const { user } = useUnifiedAuth()
// Works with OR without AuthProvider
// No more context errors!
```

## API Reference

### useUnifiedAuth Hook

```typescript
interface UnifiedAuth {
  // State
  user: UnifiedAuthUser | null      // Current authenticated user
  loading: boolean                   // Loading state
  error: string | null              // Error message if any
  isAuthenticated: boolean          // Quick check if user is logged in
  isGuest: boolean                  // Check if user is in guest mode

  // Methods
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
  clearError: () => void
}
```

### User Object

```typescript
interface UnifiedAuthUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  emailVerified: boolean
  isAnonymous: boolean
  metadata: {
    creationTime?: string
    lastSignInTime?: string
  }
  providerData: any[]
}
```

## Migration Status

### ✅ Completed Migrations
All 17 files that directly imported `useAuth` have been migrated:

#### Pages
- `/app/kanji-browser/page.tsx`
- `/app/review/page.tsx`
- `/app/settings/page.tsx`
- `/app/pricing/page.tsx`
- `/app/admin/entitlements/page.tsx`
- `/app/admin/decision-explorer/page.tsx`

#### Components
- `/components/learn/KanaLearningComponent.tsx`
- `/components/kanji/KanjiStudyMode.tsx`
- `/components/learn/KanaStudyMode.tsx`
- `/components/sync/SyncStatusIndicator.tsx`
- `/components/pokedex/PokedexCard.tsx`
- `/components/pokedex/PokedexContent.tsx`

#### Hooks
- `/hooks/useKanjiBrowser.ts`
- `/hooks/useSubscription.ts`
- `/hooks/usePokemonCatch.ts`

#### Layout
- `/app/layout.tsx` (AuthProvider kept for backward compatibility)

### 🔄 Already Using API Pattern
These files already use the API pattern directly:
- `/app/page.tsx` (homepage)
- `/app/favourites/page.tsx`
- `/app/learn/vocabulary/page.tsx`
- `/app/my-items/page.tsx`
- `/app/dashboard/page.tsx`

## Common Scenarios

### Checking Authentication Status
```typescript
const { isAuthenticated, isGuest, user } = useUnifiedAuth()

if (isGuest) {
  // Show guest experience
} else if (isAuthenticated) {
  // Show authenticated experience
} else {
  // Show login prompt
}
```

### Handling Login
```typescript
const { signIn, error, clearError } = useUnifiedAuth()

const handleLogin = async (email: string, password: string) => {
  try {
    await signIn(email, password)
    // Success - user is now logged in
  } catch (err) {
    // Error is automatically set in the hook
    console.error('Login failed:', error)
  }
}
```

### Protected Routes
```typescript
const { user, loading } = useUnifiedAuth()
const router = useRouter()

useEffect(() => {
  if (!loading && !user) {
    router.push('/auth/login')
  }
}, [user, loading])
```

### Guest Mode
```typescript
const { isGuest, user } = useUnifiedAuth()

// Guest mode is automatically detected from sessionStorage
if (isGuest) {
  // Limit features for guests
  return <GuestExperience />
}
```

## How It Works

The unified auth hook intelligently handles both authentication patterns:

1. **Context Pattern**: If AuthProvider exists (in layout.tsx), it uses that
2. **API Pattern**: If no context, it directly calls `/api/auth/session`
3. **Automatic Sync**: Keeps Firebase auth and server sessions in sync
4. **Error Recovery**: Gracefully handles network issues and expired sessions

## Troubleshooting

### "useAuth must be used within an AuthProvider"
This error should no longer occur with the unified system. If you see it:
1. Make sure you're using `useUnifiedAuth` not the old `useAuth`
2. Check that the import path is correct: `@/hooks/useUnifiedAuth`

### User is null but should be authenticated
1. Check if the hook is still loading: `if (loading) return <Loading />`
2. Verify the session exists: Check browser DevTools > Application > Cookies
3. Try refreshing the session: `await refreshSession()`

### Google Sign-In Issues
The unified auth automatically handles popup blockers by falling back to redirect flow:
- Popup blocked → Automatically uses redirect
- After redirect → Session is created automatically

## Best Practices

1. **Always check loading state** before rendering auth-dependent UI
2. **Use isAuthenticated** for quick auth checks instead of `user !== null`
3. **Handle errors gracefully** - display error messages to users
4. **Clear errors** when navigating away or retrying operations

## Future Improvements

### Planned Enhancements
- Remove dependency on AuthProvider completely
- Add support for additional OAuth providers
- Implement refresh token rotation
- Add biometric authentication support

### Deprecation Timeline
- **Now**: Both patterns work via unified hook
- **v2.0**: Old `useAuth` hook will show deprecation warning
- **v3.0**: Old auth system will be removed completely

## Need Help?

If you encounter issues:
1. Check this migration guide
2. Review `/docs/authentication/CURRENT_STATE.md` for detailed analysis
3. Look at successfully migrated files for examples
4. Contact the development team

---
Last Updated: 2025-01-19
Migration Status: 95% Complete (Testing remaining)