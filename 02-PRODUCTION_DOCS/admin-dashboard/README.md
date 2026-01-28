# Admin Dashboard

**Status:** ACTIVE
**Last Updated:** 2026-01-28

## Overview

The Admin Dashboard provides secure, cookie-authenticated administrative interfaces for managing Moshimoshi platform features. Built with Next.js 15 App Router and server-side authentication, it follows a consistent pattern for all admin pages.

## Quick Start

1. **Access the admin dashboard**: Navigate to `/[locale]/admin`
2. **Authentication**: Server-side cookie validation via Firebase Admin SDK
3. **Create new admin pages**: Follow patterns in `DEVELOPER_GUIDE.md`
4. **Reference patterns**: Check `QUICK_REFERENCE.md` for common code snippets

## Documentation

| Document | Description |
|----------|-------------|
| [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) | Complete guide to creating and maintaining admin dashboard pages |
| [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) | Quick lookup for common admin patterns and code snippets |
| [AUTH_FIX_SUMMARY.md](./AUTH_FIX_SUMMARY.md) | Documentation of authentication pattern fixes (2026-01-28) |

## Key Topics

- **Cookie-based authentication** - Server-side validation without client-side hooks
- **Consistent page patterns** - Reusable layouts and components
- **API route protection** - `withAdminAuth` middleware for secure endpoints
- **Responsive UI** - Mobile-friendly admin interfaces
- **Security best practices** - ESLint rules to prevent auth violations

## Key Files

- `src/app/[locale]/admin/layout.tsx:34` - Server-side auth wrapper
- `src/app/[locale]/admin/AdminLayoutClient.tsx:45` - Client layout with navigation
- `src/components/admin/AdminSidebar.tsx:23` - Navigation sidebar
- `src/lib/admin/adminAuth.ts:67` - Auth utilities and middleware
- `src/hooks/useAdmin.ts:12` - Client-side admin status check

## Architecture

```
Admin Dashboard
├── Server-side Auth (Cookie validation)
├── Layout System (Responsive sidebar + content)
├── Page Templates (Consistent patterns)
└── API Protection (withAdminAuth middleware)
```

## Essential For

- ✅ New developers creating admin features
- ✅ Anyone working on admin pages
- ✅ Debugging authentication issues in admin routes
- ✅ Understanding admin security patterns

---

*For detailed implementation guides, see [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)*
