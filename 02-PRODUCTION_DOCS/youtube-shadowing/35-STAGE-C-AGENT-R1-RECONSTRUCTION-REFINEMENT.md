# Agent R1: Reconstruction Refinement

Read these first, in order:

1. [34-STAGE-C-REFINEMENT-OVERVIEW.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/34-STAGE-C-REFINEMENT-OVERVIEW.md)
2. [24-STAGE-C-10-10-ARCHITECTURE.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/24-STAGE-C-10-10-ARCHITECTURE.md)
3. [25-STAGE-C-IMPLEMENTATION-ROADMAP.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/25-STAGE-C-IMPLEMENTATION-ROADMAP.md)
4. [32-STAGE-C-VALIDATION-REPORT.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/32-STAGE-C-VALIDATION-REPORT.md)
5. [31-STAGE-C-VALIDATION-CHECKLIST.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/31-STAGE-C-VALIDATION-CHECKLIST.md)

Then inspect these files:

- [reconstruction-heuristics.ts](/home/helye/DevProjects/nextjs/moshimoshi/src/lib/moshi-player/reconstruction-heuristics.ts)
- [reconstruct-segments.ts](/home/helye/DevProjects/nextjs/moshimoshi/src/lib/moshi-player/reconstruct-segments.ts)
- [transcript-types.ts](/home/helye/DevProjects/nextjs/moshimoshi/src/lib/moshi-player/transcript-types.ts)
- [route.ts](/home/helye/DevProjects/nextjs/moshimoshi/src/app/api/moshi-player/transcript/%5BvideoId%5D/route.ts)
- [page.tsx](/home/helye/DevProjects/nextjs/moshimoshi/src/app/%5Blocale%5D/moshi-player/page.tsx)

## Your Assignment

Refine the deterministic reconstruction heuristic so obviously broken rows are not preserved as good lineation.

This is a narrow follow-up pass.

You are responsible for:
- improving preserve vs rebuild decision logic
- improving fragment/continuation detection
- improving contamination rejection where necessary
- adding or updating focused tests

You are not responsible for:
- changing the route contract shape
- changing the page contract shape
- adding alignment
- adding AI
- changing playback behavior

## Known Failures You Must Address

### Failure 1: 45fMrqfNIXA intro

Observed raw/provider rows:
- `こんにちは、こんばんは、おはようござい`
- `ます。黒猫ママです。日本語の勉強頑張っ`

Observed computed result:
- preserved 1:1

Expected:
- these should be repaired into cleaner learner-facing segments

### Failure 2: 9LW9DpmhrPE contamination

Observed learner-facing output still included:
- `-do君の中にある赤と青き線`

Expected:
- leading junk contamination like `do` must not survive into learner-facing text

## Constraints

- keep the architecture intact
- no old youtube-shadowing imports
- no route/page churn beyond what is strictly required
- no broader feature work

## Acceptance Criteria

I will reject if:

1. `45fMrqfNIXA`-style obviously broken fragments can still pass through preservation unchanged.
2. `9LW9DpmhrPE`-style leading junk contamination is still allowed through.
3. The fix solves the benchmark by hardcoding video-specific behavior.
4. The route/page contract changes unnecessarily.
5. The refinement broadens into playback or alignment work.

I will accept if:
- the heuristic is materially improved
- tests cover the known failures
- the contract remains stable for route and page

## Deliverables

1. Code changes
2. Short delivery summary
3. Explicit list of files changed
4. Acceptance checklist against the criteria above
