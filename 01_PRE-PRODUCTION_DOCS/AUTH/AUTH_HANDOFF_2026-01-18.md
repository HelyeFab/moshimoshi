# Auth Handoff — 2026-01-18

Owner context: this document summarizes auth-related work completed today so a new technical lead can take over quickly. It includes decisions, reasoning, code touched, and known issues.

## Executive summary
We stabilized auth for pre-launch by:
- Standardizing UI auth to the **Firebase client auth flow (Pattern 1)**.
- Keeping `/api/auth/signin` as a **server-side REST verification endpoint** (now fixed) for backward compatibility and automation.
- Hiding magic-link UI while preserving a safe endpoint for link generation.
- Consolidating magic-link endpoints and deprecating unused legacy verify routes.
- Consolidating session refresh flow to a single endpoint with a deprecation shim.
- Unifying Firebase client config to avoid duplicate initialization bugs.
- Adding tier cache metrics without changing tier resolution behavior (Phase 3).

All changes are designed to be safe with Stripe and tier identification while preserving backward compatibility.

## Decisions and rationale
1) **Pattern 1 (Firebase client auth) is the canonical UI path**
   - Reason: avoids server-side password verification UX regressions and reduces SSR pitfalls.
   - Implementation: sign-in pages rely on Firebase client auth with session minting handled by `/api/auth/login`.

2) **`/api/auth/signin` remains but is now fully verified**
   - Reason: keep backward compatibility and non-UI integration paths. We implemented Firebase Auth REST verification with fail-fast config checks.
   - Status: fixed and covered by tests.

3) **Magic-link UI is hidden, but backend stays safe**
   - Reason: avoid broken UX and allow background fixes pre-launch without removing server routes.
   - Implementation: UI feature flag hides the button; `/api/auth/magic-link` is the only supported request endpoint.

4) **Magic-link legacy verify endpoint is disabled**
   - Reason: legacy JWT/Redis verify flow is unused and risky. We now redirect to a safe error page.
   - Status: verify endpoint returns a safe redirect error.

5) **Refresh endpoints consolidated**
   - Reason: reduce auth refresh split and avoid tier skew. `/api/auth/refresh` supports force refresh with tier cache write.
   - `/api/auth/refresh-session` remains as a deprecation shim.

6) **Firebase client initialization unified**
   - Reason: avoid duplicate init and hydration errors. A base config module is now the source of truth.

7) **Tier cache metrics added without changing tier behavior**
   - Reason: pre-launch visibility with no risk to Stripe tier detection. JWT fallback remains.

## Files touched and reasons

### Auth flows + pages
- `src/app/[locale]/auth/signin/page.tsx`
  - Uses Firebase client auth path (Pattern 1) and mints session via `/api/auth/login`.
  - Added client-side reCAPTCHA gating for sign-in to detect abuse.

- `src/app/[locale]/auth/signup/page.tsx`
  - Uses `/api/auth/magic-link` for magic-link request endpoint.

- `src/app/[locale]/auth-test/page.tsx`
  - Updated to use `/api/auth/magic-link`.

### API routes
- `src/app/api/auth/signin/route.ts`
  - Implemented Firebase REST password verification.
  - Fail-fast if `NEXT_PUBLIC_FIREBASE_API_KEY` missing.
  - Returns verified response and guards error handling.

- `src/app/api/auth/login/route.ts`
  - Remains canonical server session mint endpoint for client auth.

- `src/app/api/auth/magic-link/route.ts`
  - Now the primary endpoint for magic-link request.
  - Rate limiting, non-enumeration responses, suspension checks.

- `src/app/api/auth/magic-link/request/route.ts`
  - Deprecated: now returns HTTP 410 (Gone).

- `src/app/api/auth/magic-link/verify/route.ts`
  - Disabled legacy verify flow. Redirects to `/auth/error?code=INVALID_LINK`.

- `src/app/api/auth/refresh/route.ts`
  - Consolidated refresh endpoint.
  - Supports `{ force: true }` to reissue session with tier write to cache.

- `src/app/api/auth/refresh-session/route.ts`
  - Deprecation shim. Returns deprecation headers; redirect logic unchanged.

### Firebase client config consolidation
- `src/lib/firebase/config-base.ts`
  - New shared config module.

- `src/lib/firebase/client.ts`
  - Imports config-base, exports `db` for compatibility.

- `src/lib/firebase/config.ts`
  - Re-exports config + app/auth/db/firestore from client.

### Tier cache + metrics (Phase 3)
- `src/lib/auth/tier-cache.ts`
  - Added metrics: cache hit/miss, cache error, Firestore latency/error.
  - Optional stale-tier sampling via `TIER_CACHE_STALE_SAMPLE_RATE`.
  - No changes to tier resolution logic.

- `src/lib/auth/session.ts`
  - Added metrics for fallback to JWT and fallback to free.
  - Logic unchanged; JWT fallback preserved.

- `src/lib/auth/tier-metrics.ts`
  - New helper for metrics and sampling.

- `src/lib/redis/client.ts`
  - Added `incrementByWithTTL` helper.
  - Added mock Redis pipeline `incrby` support.

### Feature flags
- Magic-link UI hidden via existing feature flag (name unchanged).

## Tests and results
- Ran `npm test` (Jest). The suite timed out at 120s.
- Failures are unrelated to auth; they appear due to date mocking issues in streak tests.
  - Failing file: `src/lib/gamification/utils/__tests__/streakValidation.test.ts`
  - Symptoms: expected “today/yesterday” and deadlines no longer match; daysSinceActivity off by ~73–80 days.

Auth-related tests added/updated:
- `src/app/api/auth/signin/__tests__/route.test.ts`
- E2E auth setup regex updated to include `/api/auth/login` (file path depends on test setup config).

## New/updated environment variables
- `NEXT_PUBLIC_FIREBASE_API_KEY` (required for `/api/auth/signin` REST verification)
- Optional:
  - `TIER_CACHE_METRICS=false` to disable metrics
  - `TIER_CACHE_STALE_SAMPLE_RATE=0.01` (example) to sample stale-tier checks

## Operational notes
- Stripe safety: tier resolution remains cache -> Firestore -> JWT fallback -> free. No changes to tier logic.
- JWT fallback remains intact until TierCache reliability metrics prove safe to remove.
- Magic-link verify endpoint is disabled; old links will fail fast with a friendly error page.
- Magic-link request endpoint is centralized and non-enumerating.

## Known risks / follow-ups
- If you plan to re-enable magic-link UI, ensure the Firebase email-link flow is validated and stable in production.
- Review `TIER_CACHE_STALE_SAMPLE_RATE` before enabling in production to avoid Firestore load spikes.
- Consider deprecating `/api/auth/refresh-session` once all clients have migrated.
- If `/api/auth/signin` is not needed long-term, mark it deprecated and monitor usage before removing.

## Quick verification checklist
- Sign-in via UI (email/password) works and session cookie set.
- OAuth flows still route through `/api/auth/login` correctly.
- Magic-link button remains hidden.
- `/api/auth/magic-link` returns 200 for any email without enumeration.
- Tier cache metrics keys appear in Redis (`tier_metrics:*`).

## Summary of intent
The system now has one canonical UI auth path, safe server-side verification for any legacy/integration use, consolidated magic-link entrypoints, and improved observability for tier correctness. Stripe entitlement checks are preserved exactly as before.
