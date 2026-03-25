# Agent 4: Progress Tracking And Sync Integration

## Overview

Vocabulary-first study adds new exposure data and card-level interactions. We need to track that without breaking existing kanji progress behavior or premium sync.

You own progress tracking, local persistence, and sync integration for the new study signals.

You are not alone in the codebase. Other agents may be working at the same time. Do not revert their changes.

## Ownership

Primary ownership:

- `/home/helye/DevProjects/nextjs/moshimoshi/src/utils/kanjiProgressManager.ts`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/lib/review-engine/progress/UniversalProgressManager.ts`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/app/api/progress/track/route.ts`

Allowed supporting files:

- `/home/helye/DevProjects/nextjs/moshimoshi/src/lib/review-engine/core/progress.types.ts`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/types/kanji-study.ts`

## Read First

- `/home/helye/DevProjects/nextjs/moshimoshi/docs/vocabulary-first-kanji-agents/00-feature-overview.md`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/utils/kanjiProgressManager.ts`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/lib/review-engine/progress/UniversalProgressManager.ts`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/app/api/progress/track/route.ts`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/app/[locale]/kanji-browser/KanjiBrowserPage.tsx`

## Goal

Add vocabulary exposure tracking to kanji progress in a way that is additive, sync-safe, and compatible with premium Firebase behavior.

## Requirements

- Extend kanji progress data with vocabulary exposure fields.
- Track at least:
  - exposure count per reading
  - last seen word
  - last seen timestamp
- Wire the new data through local persistence first.
- Ensure premium sync includes the additive fields cleanly.
- Keep backward compatibility with older kanji progress documents.
- Do not regress current learned/unlearned or view-count behavior.

## Non-Goals

- Do not redesign the entire progress architecture.
- Do not own study-card UI.
- Do not own review card UX.

## Deliverables

1. Extended kanji progress data model.
2. Additive write / merge behavior for vocabulary exposure.
3. Server route support for the new optional payload.

## Questions To Answer In Your Final Notes

- What exact new fields are persisted?
- Are the fields local-only, synced, or both?
- What are the migration / backward-compatibility assumptions?

## Parallelization

Start after Agent 1 and Agent 2 define the card/session model.

Can run in parallel with:

- Agent 3
- Agent 5
- Agent 6
