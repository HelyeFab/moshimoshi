# Apple Sign-In Verification Checklist

This document records the Apple Sign-In setup for Moshimoshi and provides a
production verification checklist.

## What We Set Up
- Apple App ID created and enabled for Sign in with Apple.
- Apple Services ID created for web auth.
- Web Authentication configured with domains and return URL.
- Apple Key created for Sign in with Apple and connected in Firebase.
- Firebase Apple provider enabled and configured.
- Firebase Authorized Domains updated (preview domain added for testing).

## Credentials/Identifiers Used (Non-Secret)
- Apple Team ID: `VY6264RA34`
- Apple Services ID (web): `com.moshimoshi.web`
- Apple Key ID: `QFSX8YX4PX`
- Firebase Auth Domain (custom): `auth.moshimoshi.app`
- Apple Return URL: `https://auth.moshimoshi.app/__/auth/handler`
- Domains/Subdomains added in Apple Services ID:
  - `auth.moshimoshi.app`
  - `moshimoshi.app`
  - `moshimoshi-git-collaborator-access-helyefabs-projects.vercel.app`

Note: The Apple private key (.p8) is secret and should be stored securely.

## Firebase Console Checklist
- Auth → Sign-in method → Apple: Enabled
- Service ID: `com.moshimoshi.web`
- Team ID: `VY6264RA34`
- Key ID: `QFSX8YX4PX`
- Private Key: stored in Firebase (do not commit anywhere)
- Auth → Settings → Authorized domains includes:
  - `moshimoshi.app`
  - `auth.moshimoshi.app`
  - `moshimoshi-git-collaborator-access-helyefabs-projects.vercel.app`

## Apple Developer Checklist
1) Identifiers → Services IDs → `com.moshimoshi.web`
   - Sign in with Apple: Enabled
   - Web Authentication Configuration:
     - Domains/Subdomains: see list above
     - Return URL: `https://auth.moshimoshi.app/__/auth/handler`
2) Keys → `QFSX8YX4PX`
   - Sign in with Apple enabled
   - Tied to Services ID: `com.moshimoshi.web`

## Production Verification Steps
1) Visit `https://moshimoshi.app/en/auth/signin`.
2) Click "Continue with Apple."
3) Complete Apple prompt and return to app.
4) Confirm session cookie is set and user is authenticated.
5) Confirm Firestore user document exists with `authProvider: 'apple'`.

## Troubleshooting (Common Causes)
- 403 from Apple: domain or return URL mismatch.
- Works in preview but not prod: Firebase Authorized Domains missing prod domain.
- Apple name/email missing on subsequent sign-ins: expected behavior; Apple sends
  name/email only on first authorization.
