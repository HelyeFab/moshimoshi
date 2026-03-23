# Stage C Refinement Dispatch

Current status:
- Stage C route contract: implemented
- Stage C page migration: implemented
- Stage C validation: completed
- Stage C sign-off: rejected

Reason:
- current deterministic reconstruction heuristic is too permissive
- it preserves obviously broken fragments instead of repairing them

Dispatch order:

1. `R1` — reconstruction refinement
2. `R2` — validation delta after `R1` lands

Sequence:
- `R1 -> R2`

Do not dispatch broader playback/alignment work yet.

This refinement pass is intentionally narrow:
- improve reconstruction heuristics
- revalidate the exact known failures
- decide whether Stage C can now move forward
