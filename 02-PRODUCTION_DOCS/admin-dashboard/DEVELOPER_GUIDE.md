# Admin Dashboard Developer Guide

**Last Updated**: 2026-01-28
**Maintained By**: Moshimoshi Development Team

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Authentication Pattern](#authentication-pattern)
3. [Creating New Admin Pages](#creating-new-admin-pages)
4. [Established Patterns](#established-patterns)
5. [API Route Integration](#api-route-integration)
6. [Common Components](#common-components)
7. [Security Best Practices](#security-best-practices)
8. [Testing Guidelines](#testing-guidelines)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS, Framer Motion
- **Auth**: Cookie-based sessions via Firebase Admin SDK
- **State**: React hooks (no global state manager)
- **UI Library**: Headless UI, Heroicons

### Directory Structure
```
src/app/[locale]/admin/
├── layout.tsx                 # Admin layout with auth check
├── AdminLayoutClient.tsx      # Client-side layout logic
├── error.tsx                  # Error boundary (catches React errors)
├── loading.tsx                # Loading state (shown during navigation)
├── page.tsx                   # Dashboard home page
├── announcements/
│   └── page.tsx              # Example: announcements management
├── email-campaigns/
│   └── page.tsx              # Example: email campaigns
└── [feature-name]/
    └── page.tsx              # Your new feature page
```

### Key Files
- **Layout**: `src/app/[locale]/admin/layout.tsx` - Server-side auth wrapper
- **Client Layout**: `src/app/[locale]/admin/AdminLayoutClient.tsx` - Navigation, sidebar, responsive layout
- **Error Boundary**: `src/app/[locale]/admin/error.tsx` - Catches and handles React errors
- **Loading State**: `src/app/[locale]/admin/loading.tsx` - Shown during page navigation
- **Sidebar**: `src/components/admin/AdminSidebar.tsx` - Navigation links
- **Auth Middleware**: `src/lib/admin/adminAuth.ts` - Server-side auth utilities (protected with 'server-only')
- **Auth Hook**: `src/hooks/useAdmin.ts` - Client-side admin status check
- **Firebase Admin**: `src/lib/firebase/admin.ts` - Admin SDK (protected with 'server-only')

---

## Authentication Pattern

### ✅ CORRECT PATTERN (Cookie-Based)

All admin pages use **server-side cookie authentication**. The session cookie is automatically sent with every request when you use `credentials: 'include'`.

```typescript
'use client'

import { useAuth } from '@/hooks/useAuth'

export default function MyAdminPage() {
  const { user } = useAuth() // For display only

  const handleAction = async () => {
    try {
      const response = await fetch('/api/admin/my-endpoint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // ✅ THIS IS CRITICAL
        body: JSON.stringify({ data: 'value' }),
      })

      if (!response.ok) {
        throw new Error('Failed to perform action')
      }

      const data = await response.json()
      // Handle success
    } catch (error) {
      console.error('Error:', error)
      // Handle error
    }
  }

  return <div>{/* Your UI */}</div>
}
```

### ❌ INCORRECT PATTERNS

**DO NOT** use these patterns in admin pages:

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

### Why Cookie-Based Auth?

1. **Security**: HttpOnly cookies prevent XSS attacks
2. **Simplicity**: No manual token management
3. **Consistency**: Same pattern across all admin pages
4. **Server-side validation**: Every request verified by middleware
5. **CSRF protection**: Built-in with SameSite cookies

---

## Creating New Admin Pages

### Step 1: Create the Page File

Create a new file in `src/app/[locale]/admin/[feature-name]/page.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { motion } from 'framer-motion'
import Modal from '@/components/ui/Modal'

export default function MyFeaturePage() {
  const { user } = useAuth()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/admin/my-feature', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch data')
      }

      const result = await response.json()
      setData(result.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('[MyFeature] Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          My Feature
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Feature description goes here
        </p>
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-6">
        {/* Your content here */}
      </div>
    </div>
  )
}
```

### Step 2: Add to Sidebar Navigation

Edit `src/app/[locale]/admin/AdminLayoutClient.tsx`:

```typescript
const navItems = [
  { href: '/admin', label: 'Dashboard', icon: '📊' },
  // ... existing items ...
  { href: '/admin/my-feature', label: 'My Feature', icon: '🎯' }, // Add this line
]
```

### Step 3: Create API Route

Create `src/app/api/admin/my-feature/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminFirestore } from '@/lib/firebase/admin'

export const GET = withAdminAuth(async (
  request: NextRequest,
  context: AdminContext
) => {
  try {
    // Your logic here
    const data = await adminFirestore!
      .collection('my_collection')
      .get()

    const items = data.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    return NextResponse.json({
      success: true,
      data: items
    })
  } catch (error) {
    console.error('[Admin API] Error:', error)
    return NextResponse.json(
      { error: { message: 'Failed to fetch data' } },
      { status: 500 }
    )
  }
})

export const POST = withAdminAuth(async (
  request: NextRequest,
  context: AdminContext
) => {
  try {
    const body = await request.json()

    // Validate input
    if (!body.required_field) {
      return NextResponse.json(
        { error: { message: 'Missing required field' } },
        { status: 400 }
      )
    }

    // Your logic here
    const result = await adminFirestore!
      .collection('my_collection')
      .add({
        ...body,
        createdAt: new Date(),
        createdBy: context.user.uid
      })

    return NextResponse.json({
      success: true,
      id: result.id
    })
  } catch (error) {
    console.error('[Admin API] Error:', error)
    return NextResponse.json(
      { error: { message: 'Failed to create item' } },
      { status: 500 }
    )
  }
})
```

### Step 4: Test Your Page

1. **Navigate**: Go to `/admin/my-feature`
2. **Check Auth**: Verify you're redirected if not admin
3. **Test API**: Open DevTools Network tab and check API calls
4. **Test Errors**: Verify error handling works
5. **Test Loading**: Check loading states display correctly

---

## Established Patterns

### 1. Loading States

```typescript
if (loading) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      <span className="ml-3 text-gray-600 dark:text-gray-400">Loading...</span>
    </div>
  )
}
```

### 2. Error Handling

```typescript
if (error) {
  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <p className="text-red-600 dark:text-red-400 flex items-center gap-2">
        <span className="text-xl">⚠️</span>
        {error}
      </p>
      <button
        onClick={() => fetchData()}
        className="mt-2 text-sm text-red-700 dark:text-red-300 underline"
      >
        Try again
      </button>
    </div>
  )
}
```

### 3. Modals

```typescript
import Modal from '@/components/ui/Modal'

const [showModal, setShowModal] = useState(false)

<Modal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  title="Confirm Action"
  size="sm"
>
  <div className="space-y-4">
    <p className="text-gray-700 dark:text-gray-300">
      Are you sure you want to perform this action?
    </p>
    <div className="flex justify-end gap-3">
      <button
        onClick={() => setShowModal(false)}
        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg"
      >
        Cancel
      </button>
      <button
        onClick={handleConfirm}
        className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
      >
        Confirm
      </button>
    </div>
  </div>
</Modal>
```

### 4. Cards with Animation

```typescript
import { motion } from 'framer-motion'

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-6"
>
  {/* Card content */}
</motion.div>
```

### 5. Forms

```typescript
const [formData, setFormData] = useState({
  name: '',
  description: '',
})

const [validationError, setValidationError] = useState<string | null>(null)

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setValidationError(null)

  if (!formData.name.trim()) {
    setValidationError('Name is required')
    return
  }

  try {
    const response = await fetch('/api/admin/my-feature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(formData),
    })

    if (!response.ok) {
      throw new Error('Failed to submit')
    }

    // Handle success
    setFormData({ name: '', description: '' })
  } catch (err) {
    setValidationError(err instanceof Error ? err.message : 'An error occurred')
  }
}

<form onSubmit={handleSubmit} className="space-y-4">
  {validationError && (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
      <p className="text-sm text-red-600 dark:text-red-400">{validationError}</p>
    </div>
  )}

  <div>
    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
      Name
    </label>
    <input
      type="text"
      value={formData.name}
      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100"
    />
  </div>

  <button
    type="submit"
    className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
  >
    Submit
  </button>
</form>
```

### 6. Data Tables

```typescript
<div className="overflow-x-auto">
  <table className="w-full">
    <thead className="bg-gray-50 dark:bg-dark-700">
      <tr>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
          Name
        </th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
          Status
        </th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
          Actions
        </th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
      {items.map((item) => (
        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-dark-700">
          <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
            {item.name}
          </td>
          <td className="px-4 py-3 text-sm">
            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full text-xs">
              {item.status}
            </span>
          </td>
          <td className="px-4 py-3 text-sm text-right">
            <button className="text-primary-600 hover:text-primary-700">
              Edit
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

---

## API Route Integration

### Using `withAdminAuth` Middleware

All admin API routes must use the `withAdminAuth` wrapper:

```typescript
import { withAdminAuth } from '@/lib/admin/adminAuth'

export const GET = withAdminAuth(async (request, context) => {
  // context.user contains: { uid, email, isAdmin }
  const userId = context.user.uid

  // Your logic here
})
```

### Error Response Format

```typescript
// Success
return NextResponse.json({
  success: true,
  data: myData,
  message: 'Optional success message'
})

// Error
return NextResponse.json(
  {
    error: {
      message: 'User-friendly error message',
      code: 'ERROR_CODE', // Optional
      details: {} // Optional, for debugging
    }
  },
  { status: 400 } // Use appropriate HTTP status
)
```

### Pagination Pattern

```typescript
export const GET = withAdminAuth(async (request, context) => {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = (page - 1) * limit

  const query = adminFirestore!
    .collection('items')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .offset(offset)

  const snapshot = await query.get()
  const total = await adminFirestore!.collection('items').count().get()

  return NextResponse.json({
    success: true,
    data: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    pagination: {
      page,
      limit,
      total: total.data().count,
      totalPages: Math.ceil(total.data().count / limit)
    }
  })
})
```

---

## Common Components

### Available UI Components

- **Modal**: `@/components/ui/Modal`
- **Button**: Standard Tailwind classes (see patterns above)
- **Loading Spinner**: `@/components/ui/DoshiMascot` with `mood="loading"`
- **Theme Toggle**: `@/components/ui/ThemeToggle`

### Using DoshiMascot

```typescript
import { DoshiMascot } from '@/components/ui/DoshiMascot'

// Loading state
<DoshiMascot size="medium" mood="loading" variant="animated" />

// Success state
<DoshiMascot size="large" mood="happy" variant="animated" />

// Error state
<DoshiMascot size="medium" mood="confused" />
```

---

## Security Best Practices

### 1. Always Use `withAdminAuth`

```typescript
// ✅ CORRECT
export const POST = withAdminAuth(async (request, context) => {
  // Your logic
})

// ❌ WRONG - No auth check
export async function POST(request: NextRequest) {
  // This is not protected!
}
```

### 2. Validate All Input

```typescript
const body = await request.json()

// Validate required fields
if (!body.name || typeof body.name !== 'string') {
  return NextResponse.json(
    { error: { message: 'Invalid name' } },
    { status: 400 }
  )
}

// Sanitize strings
const sanitizedName = body.name.trim()
```

### 3. Use Firestore Security Rules

Even with admin auth, Firestore security rules provide defense-in-depth:

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /admin_data/{document=**} {
      // Only allow if isAdmin field is true
      allow read, write: if request.auth != null &&
        request.auth.token.admin == true;
    }
  }
}
```

### 4. Log Admin Actions

```typescript
import { auditLog } from '@/lib/admin/auditLogger'

await auditLog({
  action: 'delete_user',
  adminId: context.user.uid,
  targetId: userId,
  details: { reason: 'policy violation' }
})
```

### 5. Rate Limiting

```typescript
import { checkRateLimit } from '@/lib/api/admin-analytics-rate-limiter'

export const POST = withAdminAuth(async (request, context) => {
  const rateLimitOk = await checkRateLimit(context.user.uid, 'expensive-operation')

  if (!rateLimitOk) {
    return NextResponse.json(
      { error: { message: 'Rate limit exceeded' } },
      { status: 429 }
    )
  }

  // Your logic
})
```

### 6. Use 'server-only' Guards

**IMPORTANT**: All server-side admin code is protected with `'server-only'` guards.

**What It Does**:
- Prevents accidental import of server code in client components
- Build fails if you try to import admin SDK in client code
- No runtime overhead (build-time check only)

**Protected Files**:
- `src/lib/firebase/admin.ts` - Firebase Admin SDK
- `src/lib/admin/adminAuth.ts` - Admin authentication
- `src/lib/firebase/auth-admin.ts` - Admin auth helper
- `src/lib/admin/auditLogger.ts` - Audit logging

**Example**:
```typescript
// ✅ WORKS - Server-side API route
// src/app/api/admin/my-endpoint/route.ts
import { adminFirestore } from '@/lib/firebase/admin'

export const GET = async () => {
  const data = await adminFirestore!.collection('items').get()
  return Response.json({ data })
}

// ❌ BUILD ERROR - Client component
// src/components/MyComponent.tsx
'use client'
import { adminFirestore } from '@/lib/firebase/admin' // ERROR!
```

**If You See This Error**:
```
Error: Attempted to import server-only code in client component
```

**Solution**: Use API routes instead:
```typescript
// ✅ CORRECT - Client calls API
'use client'
const response = await fetch('/api/admin/my-endpoint', {
  credentials: 'include'
})
```

### 7. Error Boundaries

The admin dashboard has a built-in error boundary that catches React errors gracefully.

**Location**: `src/app/[locale]/admin/error.tsx`

**Features**:
- Catches unhandled React errors
- Shows user-friendly error message
- "Try Again" button to recover
- "Back to Dashboard" fallback
- Error logging to console
- Stack trace in development mode

**What This Means For You**:
- Don't worry about try-catch for every render error
- Errors won't show blank white screen
- Users can recover without refresh
- Errors are logged for debugging

**When Error Boundary Activates**:
```typescript
// This error will be caught by error boundary
export default function MyPage() {
  const data = somethingThatThrows() // Error!
  return <div>{data}</div>
}

// User sees:
// ⚠️ Something went wrong
// [Try Again] [Back to Dashboard]
```

**Best Practice**: Still handle expected errors explicitly:
```typescript
// ✅ GOOD - Handle expected errors
try {
  const response = await fetch('/api/admin/endpoint')
  if (!response.ok) throw new Error('Failed')
} catch (error) {
  setError(error.message) // Show in your UI
}

// ❌ DON'T - Rely on error boundary for expected errors
const data = await fetch('/api/admin/endpoint') // Might fail
```

---

## Testing Guidelines

### Manual Testing Checklist

Before deploying new admin pages:

- [ ] **Auth Check**: Try accessing without being logged in as admin
- [ ] **Loading States**: Verify spinners display correctly
- [ ] **Error Handling**: Test with invalid data, network errors
- [ ] **Responsive Design**: Test on mobile, tablet, desktop
- [ ] **Dark Mode**: Check both light and dark themes
- [ ] **Form Validation**: Test all validation rules
- [ ] **API Errors**: Verify error messages are user-friendly
- [ ] **Success States**: Confirm success messages/modals appear
- [ ] **Navigation**: Test sidebar navigation works
- [ ] **Keyboard Navigation**: Tab through forms

### Browser Testing

Test in:
- Chrome/Edge (Chromium)
- Firefox
- Safari (if possible)

### Performance Testing

```bash
# Check bundle size impact
npm run build
# Look for your page in the build output
```

---

## Troubleshooting

### "Cannot find name 'auth'" Error

**Problem**: Trying to use Firebase client auth in admin page

**Solution**: Remove Firebase auth imports, use `credentials: 'include'` pattern

```typescript
// ❌ WRONG
import { auth } from 'firebase/auth'
const token = await auth.currentUser?.getIdToken()

// ✅ CORRECT
const response = await fetch('/api/admin/endpoint', {
  credentials: 'include'
})
```

### "401 Unauthorized" on API Calls

**Problem**: Missing `credentials: 'include'` in fetch

**Solution**: Add credentials option:

```typescript
const response = await fetch('/api/admin/endpoint', {
  credentials: 'include' // ← Add this
})
```

### Page Not Protected by Auth

**Problem**: Users can access admin page without being admin

**Solution**: Ensure page is under `/admin/` route and layout.tsx has auth check

### Dark Mode Colors Not Working

**Problem**: Colors don't change in dark mode

**Solution**: Use Tailwind dark mode classes:

```typescript
// ❌ WRONG
className="bg-white text-black"

// ✅ CORRECT
className="bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
```

### TypeScript Errors About Types

**Problem**: TypeScript complaining about types

**Solution**: Import and use proper types:

```typescript
import type { MyType } from '@/types/my-type'

const [data, setData] = useState<MyType[]>([])
```

---

## Additional Resources

- **Firebase Admin SDK Docs**: https://firebase.google.com/docs/admin/setup
- **Next.js App Router**: https://nextjs.org/docs/app
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Framer Motion**: https://www.framer.com/motion/
- **Headless UI**: https://headlessui.com/

---

## Getting Help

1. **Check existing pages**: Look at `announcements/page.tsx` or `email-campaigns/page.tsx` as examples
2. **Read error messages**: TypeScript/ESLint errors often tell you exactly what's wrong
3. **Use browser DevTools**: Network tab shows API calls, Console shows errors
4. **Ask team**: Don't hesitate to ask for clarification

---

**Happy coding! 🚀**
