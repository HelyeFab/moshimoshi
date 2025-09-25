# Todo Feature - Architecture Demonstration

## DELETE THIS ENTIRE FOLDER when removing the todo feature

This todo feature is a complete demonstration of the Moshimoshi architecture, showing proper implementation of all key systems.

## Files to Delete

When removing this feature, delete these files/folders:

```
/src/app/todos/                    # This entire folder
/src/app/api/todos/                # API routes folder
/src/components/todos/              # Components folder
/src/hooks/useTodos.ts             # Hook file
/src/types/todos.ts                # Types file
```

Also remove from:
- `/config/features.v1.json` - Remove the "todos" feature definition and limits
- `/src/types/FeatureId.ts` - Remove 'todos' from type and array
- All i18n files - Remove the `todos: {}` section from all 6 language files

## Architecture Demonstration

### 1. Authentication (useAuth)
- Client-side: Uses `useAuth()` hook for user state
- Server-side: Uses `requireAuth()` for session validation
- Shows proper Firebase Auth + JWT session hybrid approach

### 2. Subscription Checking
- **NEVER trusts `session.tier`** (can be stale/cached)
- Always fetches fresh from Firestore:
```typescript
const userDoc = await adminDb.collection('users').doc(session.uid).get()
const plan = userData?.subscription?.plan || 'free'
```

### 3. Entitlements System
- Uses centralized evaluator from `/config/features.v1.json`
- Proper evaluation context with fresh subscription data
- Returns limit/remaining for UI feedback
- Daily limits: Guest=0, Free=5, Premium=Unlimited

### 4. Firebase Operations
- Uses Firebase Admin SDK (server-side only)
- Atomic batch operations for consistency
- Proper collection structure: `users/{uid}/todos/{todoId}`
- Usage tracking in `users/{uid}/usage/{bucket}`

### 5. API Route Pattern
Every API route follows this pattern:
1. Authenticate with `requireAuth()`
2. Get FRESH user data from Firestore
3. Check entitlements with evaluator
4. Perform atomic operations with batch
5. Return usage information

### 6. Client-Side Hook (useTodos)
- Uses `useFeature()` for entitlement checking
- Pre-checks limits before API calls
- Shows toast notifications with `useToast()`
- Handles loading, error, and success states

### 7. i18n Support
- Full translations in all 6 languages
- Uses `useI18n()` hook consistently
- No hardcoded strings anywhere
- Follows nested key structure

### 8. Theme Support
- Uses theme-aware classes (dark: prefix)
- Soft whites instead of pure white
- Proper dark mode colors (blue-grey, not black)
- Responsive design with Tailwind

## Testing the Feature

1. Visit http://localhost:3004/todos
2. Test as different user types:
   - Guest (not logged in) - No access
   - Free user - 5 todos per day
   - Premium user - Unlimited

3. Verify:
   - Authentication required
   - Entitlement limits enforced
   - Data persists in Firebase
   - Usage tracked properly
   - UI shows remaining count
   - All CRUD operations work

## Key Learnings

1. **Always fetch fresh subscription data** - Never trust cached session.tier
2. **Use batch operations** - Ensures atomic updates
3. **Check entitlements server-side** - Client checks are just UX
4. **Follow the patterns** - Consistency is key
5. **No hardcoded text** - Everything through i18n
6. **Theme-aware styling** - Always use dark: modifiers

## Summary

This feature demonstrates complete understanding of:
- Server-side auth with JWT sessions
- Client-side auth with useAuth hook
- Subscription checking from Firestore
- Centralized entitlements system
- Firebase Admin SDK operations
- Proper API route patterns
- React hooks and components
- i18n internationalization
- Theme-aware styling
- TypeScript throughout

All code is organized in feature-specific folders for easy removal.