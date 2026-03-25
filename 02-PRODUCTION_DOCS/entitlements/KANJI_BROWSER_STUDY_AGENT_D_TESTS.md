# Agent D Brief: Tests

Read first:

1. [KANJI_BROWSER_STUDY_AGENT_OVERVIEW.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/entitlements/KANJI_BROWSER_STUDY_AGENT_OVERVIEW.md)
2. [KANJI_BROWSER_STUDY_GATING_PLAN.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/entitlements/KANJI_BROWSER_STUDY_GATING_PLAN.md)
3. [API_REFERENCE.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/entitlements/API_REFERENCE.md)

## Ownership

You own:

- tests only

You do not own:

- production config
- production UI logic
- production API logic except for minimal testability changes if absolutely necessary

## Goal

Add test coverage for the Kanji Browser study unlock model.

## Required Coverage

1. guest denied
2. already unlocked kanji allowed without consuming quota
3. new kanji under cap unlocks and increments
4. new kanji over cap is denied
5. premium user is always allowed
6. response shape distinguishes already-unlocked vs newly-unlocked if implemented that way

If lightweight UI coverage is easy:

- add one small regression that the study-start flow handles denial cleanly

Otherwise:

- prioritize server/API tests

## Constraints

- do not broaden scope into implementation redesign
- keep tests aligned with the agreed product model, not a session-cap model

## Validation

- run relevant tests if possible
- run `npm run type-check`

## Final Output

Report:

- changed files
- scenarios covered
- any remaining untested risk
