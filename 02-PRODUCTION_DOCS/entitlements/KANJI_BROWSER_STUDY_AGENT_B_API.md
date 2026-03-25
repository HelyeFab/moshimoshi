# Agent B Brief: Server API and Firestore Logic

Read first:

1. [KANJI_BROWSER_STUDY_AGENT_OVERVIEW.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/entitlements/KANJI_BROWSER_STUDY_AGENT_OVERVIEW.md)
2. [KANJI_BROWSER_STUDY_GATING_PLAN.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/entitlements/KANJI_BROWSER_STUDY_GATING_PLAN.md)
3. [API_REFERENCE.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/entitlements/API_REFERENCE.md)
4. [FEATURE_GUIDE.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/entitlements/FEATURE_GUIDE.md)

## Ownership

You own:

- the server route for Kanji Browser study access
- Firestore transaction logic
- any narrow helper needed for this route

You do not own:

- entitlement config
- Kanji Browser UI
- marketing copy

## Goal

Implement atomic unlock-or-reuse access for Kanji Browser study.

## Required Behavior

Given a kanji:

- guest: deny
- premium: allow and mark unlocked if needed
- already unlocked free user: allow without increment
- new free user unlock under cap: increment entitlement and add kanji to unlocked set atomically
- new free user unlock over cap: deny

## Required Route Direction

Preferred route:

- `POST /api/kanji-browser/study/access`

Required request:

```json
{
  "kanji": "見"
}
```

The response must clearly differentiate:

- already unlocked
- newly unlocked
- denied

## Data Model Direction

Recommended progress doc:

- `users/{uid}/progress/kanji_browser_study`

Recommended fields:

```ts
{
  unlockedKanji: string[]
  unlockedCount: number
  lastUnlockedAt: string
  updatedAt: string
}
```

## Constraints

- server must own the decision
- do not rely on client-side quota math
- do not do non-transactional unlock + increment writes
- keep the response shape practical for UI integration

## Validation

- run `npm run type-check`

## Final Output

Report:

- changed files
- route path
- request/response shape
- Firestore document shape
- transaction strategy
