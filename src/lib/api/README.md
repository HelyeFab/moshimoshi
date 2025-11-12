# Request Manager

The Request Manager handles clean cancellation of API requests during sign out to prevent console errors.

## Automatic Cancellation

When users sign out, **all pending requests are automatically cancelled**. No action needed!

## Optional: Use in Your API Calls

If you want to make your API calls cancellable on sign out, you have two options:

### Option 1: Use `managedFetch` (Recommended)

Drop-in replacement for `fetch` that auto-registers with the request manager:

```typescript
import { managedFetch } from '@/lib/api/requestManager'

// Instead of:
// const response = await fetch('/api/user/profile')

// Use:
const response = await managedFetch('/api/user/profile')
```

### Option 2: Manual Registration

Register your own AbortController:

```typescript
import { requestManager } from '@/lib/api/requestManager'

const { signal } = requestManager.createController()

const response = await fetch('/api/user/profile', { signal })
```

## How It Works

1. When sign out is triggered, `requestManager.cancelAllRequests()` is called
2. All registered AbortControllers are aborted
3. Pending fetch requests are cancelled
4. No more 401 errors in the console! ✨

## Benefits

- ✅ Clean sign out experience
- ✅ No console errors
- ✅ Prevents race conditions
- ✅ Lightweight (uses native AbortController)
- ✅ Non-invasive (works with existing code)

## Implementation Details

The request manager is integrated into the `useAuth` hook's `signOut` function:

```typescript
const signOutUser = useCallback(async () => {
  // STEP 1: Cancel all pending API requests
  requestManager.cancelAllRequests('User signed out')

  // STEP 2: Proceed with sign out
  await signOut(auth)
  // ...
})
```

This ensures requests are cancelled **before** the auth session is cleared, preventing 401 errors.
