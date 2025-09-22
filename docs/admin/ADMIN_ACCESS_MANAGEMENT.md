# Admin Access Management

## Overview

The Moshimoshi application uses a Firebase-based admin access system that checks the `isAdmin` field in the user's Firestore document to determine administrative privileges.

## Implementation Details

### 1. Firebase User Document Structure

Each user document in Firestore contains an `isAdmin` field:

```javascript
{
  uid: "user-id",
  email: "user@example.com",
  displayName: "User Name",
  isAdmin: true, // or false for non-admin users
  // ... other fields
}
```

### 2. Admin Check Flow

1. **User Profile API** (`/api/user/profile`):
   - Fetches user data from Firestore including the `isAdmin` field
   - Returns this field as part of the user profile response

2. **Session API** (`/api/auth/session`):
   - Also includes the `isAdmin` field in the user object
   - Used by components like Navbar to determine admin status

3. **AuthContext** (`/src/lib/auth/AuthContext.tsx`):
   - Provides global access to user data including admin status
   - Exposes `isAdmin` boolean for easy access in components

4. **useAdmin Hook** (`/src/hooks/useAdmin.ts`):
   - Specialized hook for admin-specific pages
   - Fetches user profile and validates admin status

### 3. Admin UI Components

#### Navbar Admin Menu
- Location: `/src/components/layout/Navbar.tsx`
- Shows "Admin Dashboard" link when `user?.isAdmin === true`
- No longer depends on environment variables

#### Admin Routes Protection
- Middleware checks for session existence on `/admin/*` routes
- Individual admin pages use `useAdmin` hook to verify admin status
- Non-admin users are redirected appropriately

### 4. Setting Admin Access

To grant admin access to a user:

1. **Via Firebase Console**:
   ```
   1. Go to Firebase Console > Firestore Database
   2. Navigate to the `users` collection
   3. Find the user document by UID
   4. Add or set the field: isAdmin = true
   ```

2. **Via Admin SDK** (programmatically):
   ```typescript
   await adminFirestore.collection('users').doc(userId).update({
     isAdmin: true
   });
   ```

3. **Via Admin Dashboard**:
   - Admins can use the subscription management interface
   - Located at `/admin/subscriptions`
   - Can upgrade/downgrade users and set admin status

### 5. Security Considerations

- The `isAdmin` field is only writable server-side
- Client-side code cannot modify this field directly
- Firestore security rules should prevent client-side modifications
- Always validate admin status server-side for sensitive operations

### 6. Migration from Environment Variables

Previously, the system used `NEXT_PUBLIC_ADMIN_UID` environment variable. The new system:

- ✅ More flexible - multiple admins possible
- ✅ More secure - no hardcoded UIDs in code
- ✅ Easier management - change via Firebase console
- ✅ No deployment needed to add/remove admins

### 7. API Endpoints Using Admin Check

- `/api/admin/*` - All admin API routes
- `/api/user/profile` - Returns isAdmin field
- `/api/auth/session` - Returns isAdmin field

### 8. Deployment Checklist

When deploying to production:

1. ✅ Ensure target admin user has `isAdmin: true` in Firestore
2. ✅ Remove `NEXT_PUBLIC_ADMIN_UID` from environment variables
3. ✅ Verify Firebase security rules protect the `isAdmin` field
4. ✅ Test admin menu visibility after deployment

### 9. Troubleshooting

**Admin menu not showing:**
- Check Firestore for `isAdmin: true` on user document
- Clear browser cache and cookies
- Check browser console for API errors
- Verify `/api/user/profile` returns `isAdmin: true`

**Cannot access admin pages:**
- Ensure session cookie is valid
- Check `useAdmin` hook response in browser console
- Verify middleware is not blocking the route

**isAdmin field missing:**
- Manually add field to user document in Firestore
- Set type as boolean, value as true

## Code References

- User Profile API: `src/app/api/user/profile/route.ts:106`
- Session API: `src/app/api/auth/session/route.ts:89`
- AuthContext: `src/lib/auth/AuthContext.tsx:54`
- useAdmin Hook: `src/hooks/useAdmin.ts:38`
- Navbar Admin Check: `src/components/layout/Navbar.tsx:231`
- Admin Check Function: `src/lib/firebase/admin.ts:374`

## Future Improvements

1. Role-based access control (RBAC) with multiple permission levels
2. Admin activity audit logs
3. Admin invitation system
4. Time-limited admin access
5. Two-factor authentication for admin actions