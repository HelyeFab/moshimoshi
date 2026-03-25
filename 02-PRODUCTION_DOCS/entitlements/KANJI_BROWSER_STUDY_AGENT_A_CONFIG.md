# Agent A Brief: Entitlement Config

Read first:

1. [KANJI_BROWSER_STUDY_AGENT_OVERVIEW.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/entitlements/KANJI_BROWSER_STUDY_AGENT_OVERVIEW.md)
2. [KANJI_BROWSER_STUDY_GATING_PLAN.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/entitlements/KANJI_BROWSER_STUDY_GATING_PLAN.md)
3. [FEATURE_GUIDE.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/entitlements/FEATURE_GUIDE.md)

## Ownership

You own:

- `config/features.v1.json`
- generated entitlement artifacts

You do not own:

- API routes
- Firestore transaction logic
- Kanji Browser UI gating

## Goal

Add a new entitlement feature for Kanji Browser study, separate from plain browsing.

## Required Config

Feature id:

- `kanji_browser_study`

Required properties:

- category: `learning`
- lifecycle: `active`
- permission: `do_practice`
- limitType: `monthly`

Required limits:

- guest: `0`
- free: `10`
- premium_monthly: `-1`
- premium_yearly: `-1`

## Constraints

- do not modify the meaning of existing `kanji_browser`
- do not invent UI behavior
- do not wire any client logic here

## Validation

- run `npm run gen:entitlements`
- run `npm run type-check`

## Final Output

Report:

- changed files
- regenerated files
- exact limit values added
