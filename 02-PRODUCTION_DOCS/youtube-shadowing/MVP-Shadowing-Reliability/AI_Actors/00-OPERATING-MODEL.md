# Operating Model

## Purpose
Coordinate multiple AI actors to ship YouTube Shadowing quality safely and fast.

## Workflow
1. Technical Lead defines sprint objective and acceptance gates.
2. Pipeline + Sync agents implement scoped code changes.
3. QA/Eval agent runs benchmark/tests and reports evidence.
4. Technical Lead decides promote/rollback.

## Evidence Required Per Change
- files changed
- reason for change
- test results
- benchmark before/after
- known risks

## Non-negotiables
- no destructive shortcuts for release quality
- no benchmark-only optimization that degrades UI behavior
- no “done” claim without benchmark + manual playback QA

