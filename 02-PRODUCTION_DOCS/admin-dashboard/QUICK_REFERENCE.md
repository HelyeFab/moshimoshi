# Admin Dashboard Quick Reference

**Quick lookup for common admin dashboard tasks**

---

## 🚀 Quick Start

### Create New Admin Page

```bash
# 1. Create constants file (all UI copy)
touch src/app/[locale]/admin/my-feature/constants.ts

# 2. Create page file
touch src/app/[locale]/admin/my-feature/page.tsx

# 3. Create API route
touch src/app/api/admin/my-feature/route.ts

# 4. Add to sidebar (src/app/[locale]/admin/AdminLayoutClient.tsx)
# 5. Test at /admin/my-feature
```

### UI Copy Constants Pattern

Do not hardcode strings in page components. Extract all UI text to a constants file:

```typescript
// src/app/[locale]/admin/my-feature/constants.ts
export const MY_FEATURE_COPY = {
  page: {
    title: 'My Feature',
    subtitle: 'Manage my feature',
  },
  table: { ... },
  actions: { ... },
  modals: { ... },
  status: { ... },
  errors: { ... },
  success: { ... },
} as const;

// In page.tsx
import { MY_FEATURE_COPY as COPY } from './constants'
<h1>{COPY.page.title}</h1>
```

Reference implementation: `src/app/[locale]/admin/youtube-transcripts/constants.ts`

---

## 🔐 Authentication

### Frontend (Always use this)
```typescript
const response = await fetch('/api/admin/endpoint', {
  credentials: 'include', // ← Required for auth
})
```

### Backend API Route
```typescript
import { withAdminAuth } from '@/lib/admin/adminAuth'

export const GET = withAdminAuth(async (request, context) => {
  // context.user = { uid, email, isAdmin }
  return NextResponse.json({ data: 'your data' })
})
```

---

## 📝 Common Patterns

### Fetch Data
```typescript
const [data, setData] = useState([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)

const fetchData = async () => {
  try {
    setLoading(true)
    const response = await fetch('/api/admin/endpoint', {
      credentials: 'include'
    })
    if (!response.ok) throw new Error('Failed')
    const result = await response.json()
    setData(result.data)
  } catch (err) {
    setError(err.message)
  } finally {
    setLoading(false)
  }
}
```

### POST/PUT/DELETE
```typescript
const response = await fetch('/api/admin/endpoint', {
  method: 'POST', // or 'PUT', 'DELETE'
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ data: 'value' })
})
```

### Loading State
```typescript
if (loading) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
    </div>
  )
}
```

### Error State
```typescript
if (error) {
  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <p className="text-red-600 dark:text-red-400">{error}</p>
    </div>
  )
}
```

---

## 🎨 UI Components

### Modal
```typescript
import Modal from '@/components/ui/Modal'

<Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Title">
  <p>Content</p>
</Modal>
```

### Button (Primary)
```typescript
<button className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600">
  Click Me
</button>
```

### Button (Secondary)
```typescript
<button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg">
  Cancel
</button>
```

### Card
```typescript
<div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-6">
  Content
</div>
```

### Input
```typescript
<input
  type="text"
  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100"
/>
```

---

## 📊 API Response Format

### Success
```typescript
return NextResponse.json({
  success: true,
  data: myData
})
```

### Error
```typescript
return NextResponse.json(
  { error: { message: 'Error message' } },
  { status: 400 }
)
```

---

## 🛡️ Security Checklist

- [ ] Use `withAdminAuth` on all API routes
- [ ] Use `credentials: 'include'` on all fetch calls
- [ ] Validate all input on server-side
- [ ] Don't import Firebase client auth in admin pages
- [ ] Log important admin actions

---

## 🐛 Common Errors

| Error | Fix |
|-------|-----|
| "Cannot find name 'auth'" | Remove Firebase client auth, use `credentials: 'include'` |
| "401 Unauthorized" | Add `credentials: 'include'` to fetch |
| "Module not found" | Check import paths, rebuild |
| Dark mode not working | Use `dark:` classes: `bg-white dark:bg-dark-800` |

---

## 📁 File Locations

```
src/app/[locale]/admin/          # Admin pages
src/app/api/admin/               # Admin API routes
src/components/admin/            # Admin-specific components
src/lib/admin/                   # Admin utilities
src/hooks/useAdmin.ts            # Admin auth hook
```

---

## 🔗 Related Docs

- [Full Developer Guide](./DEVELOPER_GUIDE.md) - Complete documentation
- [Auth Fix Summary](./AUTH_FIX_SUMMARY.md) - Recent auth pattern fixes
- [Root README](../README.md) - Production docs index

---

**Need more details?** Check the [full developer guide](./DEVELOPER_GUIDE.md).
