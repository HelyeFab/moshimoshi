# TTS Env Diff Report

Compared local .env.local vs Vercel Production (/tmp/.env.vercel.production)

## Summary

- Date: 2026-01-19 09:55 UTC
- Scope: TTS-related keys

## Differences (key presence/value mismatch)

| Key | Local Present | Production Present | Match | ShouldMatch |
| --- | --- | --- | --- | --- |
| NEXT_PUBLIC_APP_URL | yes | yes | no | no |
| NEXT_PUBLIC_API_URL | yes | yes | no | no |
| FIREBASE_ADMIN_PROJECT_ID | yes | yes | yes | yes |
| FIREBASE_ADMIN_CLIENT_EMAIL | yes | yes | yes | yes |
| FIREBASE_ADMIN_PRIVATE_KEY | yes | yes | no | yes |
| NEXT_PUBLIC_FIREBASE_PROJECT_ID | yes | yes | yes | yes |
| NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET | yes | yes | yes | yes |

## Notes

- Values are not shown for security.
- 'Match' indicates exact value equality when present in both (quotes normalized).
- 'na' means one side missing.
- 'ShouldMatch' set to 'yes' for Firebase project identifiers and service account, based on a single-project deployment model.
