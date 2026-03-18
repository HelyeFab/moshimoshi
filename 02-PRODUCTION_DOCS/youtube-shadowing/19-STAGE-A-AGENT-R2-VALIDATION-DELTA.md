# Agent R2 — Stage A Validation Delta

## Read first

1. [17-STAGE-A-ROBUSTNESS-OVERVIEW.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/17-STAGE-A-ROBUSTNESS-OVERVIEW.md)
2. [10-STAGE-A-VALIDATION-CHECKLIST.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/10-STAGE-A-VALIDATION-CHECKLIST.md)
3. [11-STAGE-A-VALIDATION-REPORT.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/11-STAGE-A-VALIDATION-REPORT.md)
4. `Agent R1` output

## Mission

Update Stage A validation after the transcript robustness fix.

This is not a full new validation system. It is a delta pass focused on transcript retrieval robustness.

## Required validation focus

1. Japanese transcript retrieval is now stronger than before.
2. The route still stays rebuild-owned.
3. Runtime claims remain honest.

## Deliverables

1. Update Stage A validation checklist if needed.
2. Update Stage A validation report with:
- what improved
- what is now code-confirmed
- what still requires runtime/manual validation
3. Add or adjust narrow automated checks only if they truly validate the robustness change.

## Constraints

Do not:
- overclaim manual/runtime validation that was not performed
- widen scope into Stage B or segmentation

## Acceptance criteria

1. Validation language is precise.
2. Improvements are clearly attributed to the robustness change.
3. Remaining runtime uncertainty is left marked unverified.

## Report back format

Return with:
- files changed
- what validation changed
- what is newly confirmed vs still manual
