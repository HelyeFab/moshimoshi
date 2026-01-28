# Admin Authentication Pattern Fix - Summary

**Date**: 2026-01-28
**Issue**: Broken authentication in announcements and email-campaigns pages
**Status**: ✅ Fixed

---

## 🎯 Problem Identified

Both `announcements/page.tsx` and `email-campaigns/page.tsx` were using incorrect **client-side Firebase authentication** instead of the **server-side cookie-based pattern** used throughout the rest of the admin dashboard.

### Specific Errors

1. **announcements/page.tsx:128** - Undefined `auth.currentUser`
2. **email-campaigns/page.tsx** - Undefined `token` variable (5 locations)

---

## 🔧 Fixes Applied

### 1. announcements/page.tsx

**Fixed**: `handleStatusChange` function (line 126-140)

**Before**:
```typescript
const token = await auth.currentUser?.getIdToken() // ❌ auth not defined
if (!token) {
  throw new Error('Not authenticated')
}

const response = await fetch(`/api/admin/announcements/${id}`, {
  method: 'PUT',
  headers: {
    Authorization: `Bearer ${token}`, // ❌ Wrong pattern
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ status }),
})
```

**After**:
```typescript
const response = await fetch(`/api/admin/announcements/${id}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include', // ✅ Correct pattern
  body: JSON.stringify({ status }),
})
```

### 2. email-campaigns/page.tsx

Fixed **5 functions** with the same issue:

1. `handleSendCampaign` (line 146)
2. `handleSendTestEmail` (line 179)
3. `handlePreviewCampaign` (line 206)
4. `handleEmailPreview` (line 229)
5. `handleDeleteCampaign` (line 260)

All changed from:
```typescript
headers: { Authorization: `Bearer ${token}` } // ❌
```

To:
```typescript
credentials: 'include' // ✅
```

---

## 📋 ESLint Rule Added

To prevent this issue from recurring, added a new ESLint rule in `.eslintrc.json`:

```json
{
  "files": ["src/app/**/admin/**/*"],
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "patterns": [
          {
            "group": ["firebase/auth", "@/lib/firebase/client", "*/firebase/client*"],
            "message": "Admin routes must use server-side authentication (cookies via 'credentials: include'). Do not import Firebase client auth."
          }
        ]
      }
    ]
  }
}
```

This rule will now **prevent** importing Firebase client auth in any admin route.

---

## ✅ Results

- ✅ TypeScript compilation passes (no more undefined `auth` or `token`)
- ✅ Build completes successfully
- ✅ Consistent authentication pattern across all admin pages
- ✅ ESLint prevents future violations

---

## 🏗️ Correct Admin Auth Pattern

### ✅ ALWAYS Use This Pattern

```typescript
const response = await fetch('/api/admin/endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include', // ✅ THIS IS CRITICAL
  body: JSON.stringify(data),
})
```

### ❌ NEVER Use These Patterns

```typescript
// ❌ WRONG: Client-side Firebase auth
import { auth } from 'firebase/auth'
const token = await auth.currentUser?.getIdToken()

// ❌ WRONG: Bearer token authorization
headers: {
  Authorization: `Bearer ${token}`
}

// ❌ WRONG: Importing Firebase client auth
import { getAuth } from 'firebase/auth'
```

---

## 🔒 Why Cookie-Based Auth is Better

1. **Security**: HttpOnly cookies prevent XSS attacks
2. **Simplicity**: No manual token management needed
3. **Consistency**: Same pattern across all admin pages
4. **Server-side validation**: Every request automatically verified by middleware
5. **CSRF protection**: Built-in with SameSite cookie policy
6. **No client-side token storage**: Tokens never exposed to JavaScript

---

## 🛠️ Server-Side Implementation

All admin API routes are protected by `withAdminAuth` middleware:

```typescript
// src/app/api/admin/my-endpoint/route.ts
import { withAdminAuth } from '@/lib/admin/adminAuth'

export const GET = withAdminAuth(async (request, context) => {
  // context.user contains: { uid, email, isAdmin }
  // Request is automatically authenticated via cookie

  return NextResponse.json({ data: 'your data' })
})
```

The middleware:
1. Reads the session cookie from the request
2. Validates the session with Firebase Admin SDK
3. Checks if user has `isAdmin: true` in Firestore
4. Provides user context to the handler
5. Returns 401/403 if authentication fails

---

## 📚 Related Documentation

- [Developer Guide](./DEVELOPER_GUIDE.md) - Complete admin dashboard development guide
- [Quick Reference](./QUICK_REFERENCE.md) - Quick lookup for common patterns
- [Root Docs](../README.md) - Production documentation index

---

## 🔍 How to Check for Similar Issues

### Search for Problematic Patterns

```bash
# Check for Firebase client auth imports in admin routes
grep -r "firebase/auth" src/app/\[locale\]/admin/

# Check for Bearer token authorization
grep -r "Authorization.*Bearer" src/app/\[locale\]/admin/

# Check for .getIdToken() calls
grep -r "getIdToken" src/app/\[locale\]/admin/
```

Should return **no results** (or only in this summary file).

### Run ESLint

```bash
npx eslint src/app/\[locale\]/admin/ --ext .ts,.tsx
```

Should pass without errors related to Firebase imports.

---

## 🚀 Testing the Fix

### Manual Testing Steps

1. **Login as admin**: Navigate to `/admin`
2. **Test announcements**: Go to `/admin/announcements`
   - Try changing announcement status
   - Should work without console errors
3. **Test email campaigns**: Go to `/admin/email-campaigns`
   - Try sending test email
   - Try previewing campaign
   - Try deleting campaign
   - All should work without authentication errors
4. **Check DevTools**: Open Network tab
   - Verify all API calls include cookies
   - Verify no Bearer token headers
   - Verify all return 200 (not 401/403)

### Automated Testing

```bash
# Build should pass
npm run build

# TypeScript should pass
npm run type-check

# ESLint should pass
npm run lint
```

---

## 📝 Lessons Learned

1. **Never mix authentication patterns** - Stick to one approach (cookie-based for admin)
2. **Read before you write** - Check existing patterns before implementing new features
3. **Use TypeScript** - Undefined variables are caught at compile time
4. **Add lint rules** - Prevent architectural violations proactively
5. **Document patterns** - Clear documentation prevents mistakes

---

## 👥 Team Guidelines

When adding new admin pages:

1. ✅ Copy from existing working pages (`announcements/page.tsx`)
2. ✅ Always use `credentials: 'include'`
3. ✅ Never import Firebase client auth
4. ✅ Use `withAdminAuth` for API routes
5. ✅ Test authentication before committing
6. ✅ Check ESLint passes

---

**Questions?** Refer to the [Developer Guide](./DEVELOPER_GUIDE.md) or ask the team.
