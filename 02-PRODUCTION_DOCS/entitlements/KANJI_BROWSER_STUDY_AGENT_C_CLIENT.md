# Agent C Brief: Kanji Browser Client Gating

Read first:

1. [KANJI_BROWSER_STUDY_AGENT_OVERVIEW.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/entitlements/KANJI_BROWSER_STUDY_AGENT_OVERVIEW.md)
2. [KANJI_BROWSER_STUDY_GATING_PLAN.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/entitlements/KANJI_BROWSER_STUDY_GATING_PLAN.md)
3. [KANJI_BROWSER_STUDY_MARKETING.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/entitlements/KANJI_BROWSER_STUDY_MARKETING.md)
4. [FEATURE_GUIDE.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/entitlements/FEATURE_GUIDE.md)

## Ownership

You own:

- Kanji Browser client-side study-start gating
- directly related copy shown in Kanji Browser UI

You do not own:

- entitlement config
- server unlock transaction logic
- unrelated study internals

## Goal

Gate the Kanji Browser study-start action using the server access API.

## Required UX

- browsing remains free
- guests can browse but cannot start study
- signed-in free users can study already unlocked kanji even after reaching the cap
- signed-in free users cannot unlock new kanji over cap
- premium users are unlimited

## Copy Rules

Use:

- unlock
- unlocked kanji
- kanji study slots
- unlimited kanji study

Do not use:

- session limit
- study credits
- daily attempts

## Multi-Kanji Rule

Do not silently partially start a session if the chosen set exceeds the free unlock allowance, unless the server contract explicitly supports it and the product intentionally wants it.

Initial expectation:

- block start cleanly
- explain why

## Constraints

- do not wrap the whole page in `EntitlementGate`
- gate only the start-study action
- preserve current local study session behavior after access is granted

## Validation

- run `npm run type-check`

## Final Output

Report:

- changed files
- guest / free under cap / free at cap / premium behavior
- exact copy or message strategy used
