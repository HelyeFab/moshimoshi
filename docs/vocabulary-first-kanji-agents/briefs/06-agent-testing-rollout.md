# Agent 6: Testing, Rollout, And QA Strategy

## Overview

Vocabulary-first kanji study changes data flow, study UX, persistence, and sync. We need a serious test and rollout plan, not a hand-wavy one.

You own the validation and rollout package.

You are not alone in the codebase. Other agents may be working at the same time. Do not revert their changes. Prefer documentation, tests, and verification scaffolding.

## Ownership

Primary ownership:

- `/home/helye/DevProjects/nextjs/moshimoshi/docs/vocabulary-first-kanji-agents/`
- relevant test files under `/home/helye/DevProjects/nextjs/moshimoshi/src/**/__tests__/`
- any new QA markdown or rollout checklist files you add

## Read First

- `/home/helye/DevProjects/nextjs/moshimoshi/docs/vocabulary-first-kanji-agents/00-feature-overview.md`
- `/home/helye/DevProjects/nextjs/moshimoshi/docs/kanji-system-architecture.md`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/app/[locale]/kanji-browser/KanjiBrowserPage.tsx`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/components/kanji/KanjiStudyMode.tsx`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/utils/kanjiProgressManager.ts`

## Goal

Produce the test strategy, rollout controls, and regression checklist needed to ship vocabulary-first kanji study safely.

## Requirements

- Define unit, integration, and manual QA coverage.
- Call out the highest-risk regressions:
  - session persistence
  - collection resume
  - progress sync
  - mobile card layout
  - reading correctness
- Propose feature-flag or staged-rollout mechanics if appropriate.
- Add tests where the codebase already has a natural home for them.
- Produce a concise QA checklist for human verification.

## Non-Goals

- Do not own the main production implementation.
- Do not rewrite unrelated test infrastructure.

## Deliverables

1. Test plan document.
2. Rollout / feature-flag recommendation.
3. Regression checklist.
4. Any high-value focused tests you can add safely.

## Questions To Answer In Your Final Notes

- What are the top 5 regressions we must test before launch?
- Which parts require manual QA instead of only unit tests?
- What is the safest rollout shape?

## Parallelization

This agent can begin immediately in read-only planning mode.

It should do a final pass after:

- Agent 1
- Agent 2
- Agent 3
- Agent 4
- Agent 5
