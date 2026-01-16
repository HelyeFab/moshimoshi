# Firebase User Check Script

Quick utility to check user data in Firebase Auth and Firestore.

## Usage

### Check specific email:
```bash
npx tsx scripts/check-firebase-users.ts emmanuelfabiani23@gmail.com
```

### Check default email:
```bash
npx tsx scripts/check-firebase-users.ts
# Defaults to: emmanuelfabiani23@gmail.com
```

### Check any email:
```bash
npx tsx scripts/check-firebase-users.ts user@example.com
```

## What It Checks

1. **Firebase Authentication**
   - User existence
   - Email verification status
   - Display name
   - Authentication providers (Google, Apple, etc.)
   - Custom claims (admin status)
   - Account disabled status
   - Creation and last sign-in timestamps

2. **Firestore Database**
   - User document in `users` collection
   - Profile data (email, displayName, etc.)
   - Admin status
   - Subscription information
   - Created and last login timestamps

3. **Data Consistency**
   - Verifies Auth UID matches Firestore UID
   - Warns if data exists in one but not the other

## Example Output

```
🔍 Firebase User Check Script
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 Searching for: emmanuelfabiani23@gmail.com
🔑 Service Account: /home/beano/.../moshimoshi-service-account.json
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Found user in Auth:
   UID: 8onZzlQg3tQxkw8pinSF9ow4Q6j2
   Email: emmanuelfabiani23@gmail.com
   Email Verified: true
   Display Name: Salvatore Fabiani
   Provider: google.com, apple.com
   Custom Claims: { admin: true }

✅ Found 1 user(s) in Firestore
   Subscription: active

📊 Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Firebase Auth: 1 user(s)
Firestore: 1 user(s)
✅ Data Consistency: Auth and Firestore UIDs match
```

## Requirements

- Service account file at: `/home/beano/DevProjects/NextJs/moshimoshi/moshimoshi-service-account.json`
- Firebase Admin SDK installed (`firebase-admin` package)
- TypeScript execution runtime (`tsx` package)

## Troubleshooting

**Error: Cannot find module 'firebase-admin'**
```bash
npm install firebase-admin
```

**Error: Service account file not found**
- Verify path: `/home/beano/DevProjects/NextJs/moshimoshi/moshimoshi-service-account.json`
- Check file permissions

**Error: Permission denied**
- Make script executable: `chmod +x scripts/check-firebase-users.ts`
- Check service account has Firestore/Auth read permissions

## Security Notes

- ⚠️ This script reads from production Firebase
- ⚠️ Service account file contains sensitive credentials
- ⚠️ Never commit service account file to git
- ✅ File is in `.gitignore`
