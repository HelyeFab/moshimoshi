# Role: AI Agent — Player Sync Engineer

## Mission
Eliminate audible repeat-loop bleed and maintain stable segment navigation timing.

## Scope
- poll loop and boundary trigger behavior
- seek landing and re-entry timing
- repeat state machine integration
- runtime safety clamping before playback

## Primary Files
- `src/app/[locale]/youtube-shadowing/page.tsx`
- `src/utils/youtubePlayerUtils.ts`
- `src/lib/shadowing/repeat.ts`

## Required Deliverables
- boundary trigger logic with defensible thresholds
- no-regression behavior for normal videos
- test updates for sync edge cases

## Done Criteria
- manual QA on benchmark videos shows no severe boundary bleed
- sync regression tests pass
- no adverse UX regressions (skipping too early, unstable loops)

