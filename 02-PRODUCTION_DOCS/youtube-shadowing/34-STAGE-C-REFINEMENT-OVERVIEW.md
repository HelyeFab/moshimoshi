# Stage C Refinement Overview

## What Has Already Happened

Moshi Player was rebuilt from scratch on `rebuild/moshiplayer-v2-from-scratch`.

Stage A established:
- rebuild-owned player page at `/en/moshi-player`
- rebuild-owned transcript route
- rebuild-owned provider waterfall

Stage C introduced:
- `rawTranscript`
- `reconstructedSegments`
- `playerSegments`

The page now consumes computed `playerSegments`.

So the architecture is in place.

## Why We Are Doing A Refinement Pass

Stage C validation is complete and the result is:
- **do not sign off**

The route contract and page contract are acceptable.
The failure is in the **heuristic quality** of the reconstruction layer.

In plain terms:
- the system is now correctly consuming computed segments
- but some of those computed segments are still not good enough for learners

## Confirmed Failure

`45fMrqfNIXA` intro still preserves obvious broken fragments instead of repairing them.

Observed raw/provider rows:
- `こんにちは、こんばんは、おはようござい`
- `ます。黒猫ママです。日本語の勉強頑張っ`

Observed computed output:
- preserved 1:1

Expected:
- these should be repaired into cleaner learner-facing sentence units

Validation conclusion:
- the current heuristic treats some broken rows as “good lineation”
- so preservation is too permissive

## Additional Concern

`9LW9DpmhrPE` still showed contamination like:
- `-do君の中にある赤と青き線`

That means:
- preservation/reconstruction also needs stronger junk contamination handling

## What This Refinement Pass Must Solve

It must improve the deterministic reconstruction logic without breaking the architecture.

That means:
- do not change the high-level route/page contract
- do not add AI
- do not add forced alignment
- do not reintroduce old youtube-shadowing logic

Only improve:
- preserve vs rebuild decision
- fragment detection
- continuation detection
- contamination filtering where necessary

## Files Most Likely In Scope

- `src/lib/moshi-player/reconstruction-heuristics.ts`
- `src/lib/moshi-player/reconstruct-segments.ts`
- possibly narrow type/test updates if needed

## What Counts As Success

At minimum:
- `45fMrqfNIXA` intro is no longer preserved as broken fragments
- `9LW9DpmhrPE` leading junk contamination is no longer allowed through
- already-good lineation is still preserved when truly good

## What Must Not Happen

- no route contract churn
- no page contract churn
- no new playback features
- no silent fallback to raw rows

This is a heuristic refinement pass only.
