# Agent A3 Follow-Up — Validation Delta

## Read First

1. [13-STAGE-A-FOLLOWUP-OVERVIEW.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/13-STAGE-A-FOLLOWUP-OVERVIEW.md)
2. [10-STAGE-A-VALIDATION-CHECKLIST.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/10-STAGE-A-VALIDATION-CHECKLIST.md)
3. `Agent A2` follow-up output

## Mission

Update Stage A validation so that Japanese-specific transcript selection is explicitly tested.

## Required additions

Add validation coverage for:
1. Japanese transcript is selected when available.
2. A non-Japanese transcript is not treated as success.
3. The UI shows a clear unavailable state when Japanese captions do not exist.

## Deliverables

1. Update the Stage A validation checklist.
2. Update the Stage A validation report template or validation report if needed.
3. Add or adjust automated coverage only if it is genuinely useful and honest.

## Constraints

Do not:
- overclaim runtime validation that was not actually performed
- expand the scope beyond this transcript-language selection delta

## Acceptance Criteria

1. The checklist now reflects Japanese-specific product behavior.
2. Validation language is precise about what is confirmed vs unverified.
3. No fake confidence is introduced.

## Report Back Format

Return with:
- files changed
- what was added to validation
- what remains manual vs automated
