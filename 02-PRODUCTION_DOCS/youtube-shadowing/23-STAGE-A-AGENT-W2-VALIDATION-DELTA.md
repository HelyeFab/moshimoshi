# Agent W2 — Retrieval Waterfall Validation Delta

Read these first, in order:
1. [21-STAGE-A-RETRIEVAL-WATERFALL-OVERVIEW.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/21-STAGE-A-RETRIEVAL-WATERFALL-OVERVIEW.md)
2. [10-STAGE-A-VALIDATION-CHECKLIST.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/10-STAGE-A-VALIDATION-CHECKLIST.md)
3. [11-STAGE-A-VALIDATION-REPORT.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/11-STAGE-A-VALIDATION-REPORT.md)
4. [20-STAGE-A-RETRIEVAL-WATERFALL-DISPATCH.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/20-STAGE-A-RETRIEVAL-WATERFALL-DISPATCH.md)

## Your assignment

Validate the new retrieval-waterfall pass after W1 lands.

This is a validation delta, not a product redesign.

## Focus of this pass

Confirm that the rebuild Stage A route:
- became more robust at transcript retrieval
- still stays within Stage A scope
- did not re-import old contaminated processing layers

## What to validate

1. Route-level validation
- the rebuild route has a provider waterfall
- Japanese selection is explicit
- provider failure falls through to next provider cleanly
- response shape stays raw

2. Scope validation
- no segmentation logic was introduced
- no AI formatting was introduced
- no transcript shaping imports were added
- no playback coupling was introduced

3. Checklist/report updates
- update Stage A checklist with any new route-validation items if needed
- update the validation report with code-level findings
- mark runtime/manual items honestly as verified or unverified

## Deliverables

1. Updated checklist:
- [`10-STAGE-A-VALIDATION-CHECKLIST.md`](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/10-STAGE-A-VALIDATION-CHECKLIST.md)

2. Updated report:
- [`11-STAGE-A-VALIDATION-REPORT.md`](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/11-STAGE-A-VALIDATION-REPORT.md)

3. If needed, test updates in:
- [`__tests__/stage-a/no-playback-control-coupling.test.ts`](/home/helye/DevProjects/nextjs/moshimoshi/__tests__/stage-a/no-playback-control-coupling.test.ts)

## Acceptance criteria

I will accept this validation pass only if:

1. it clearly distinguishes code-confirmed vs runtime-unverified behavior
2. it explicitly checks that no old transcript processing layer leaked in
3. it does not overclaim live provider success unless actually tested
4. it records any remaining environment-dependent risks honestly

## Important note

The most important failure to guard against here is false confidence.

If the code structure is better but live provider success is still unverified, say so plainly.
