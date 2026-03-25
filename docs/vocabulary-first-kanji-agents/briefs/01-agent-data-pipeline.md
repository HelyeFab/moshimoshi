# Agent 1: Data Pipeline And Card Generation

## Overview

We are implementing a vocabulary-first kanji study mode. The system should generate card sequences that teach readings through real words before showing a final reading summary.

You own the data modeling and card-generation layer for this feature.

You are not alone in the codebase. Other agents may be working at the same time. Do not revert their changes. Work only within your assigned files unless a small supporting type import is necessary.

## Ownership

Primary ownership:

- `/home/helye/DevProjects/nextjs/moshimoshi/src/lib/review-engine/adapters/KanjiBrowserAdapter.ts`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/utils/jmdictLocalSearch.ts`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/utils/kanjiReadingPriority.ts`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/types/kanji.ts`

New files you are allowed to create:

- `/home/helye/DevProjects/nextjs/moshimoshi/src/types/kanji-study.ts`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/utils/kanjiVocabularyLookup.ts`

## Read First

- `/home/helye/DevProjects/nextjs/moshimoshi/docs/vocabulary-first-kanji-agents/00-feature-overview.md`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/lib/review-engine/adapters/KanjiBrowserAdapter.ts`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/utils/jmdictLocalSearch.ts`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/utils/kanjiReadingPriority.ts`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/services/kanjiService.ts`
- `/home/helye/DevProjects/nextjs/moshimoshi/public/data/dictionary/jmdict-eng-common.json`
- `/home/helye/DevProjects/nextjs/moshimoshi/public/data/kanji/jlpt_5.json`

## Goal

Create a robust, local-data-backed way to generate study cards for one kanji:

- 1 meaning card
- N vocabulary cards
- 1 reading summary card

The vocabulary cards must use real words from local data and prefer common, learner-useful words.

## Requirements

- Define stable TypeScript types for study cards and study sessions.
- Add a vocabulary lookup helper that finds candidate words for a specific kanji and specific reading.
- Prioritize words using local JMdict signals:
  - common flag
  - tags / priority
  - simple / short / learner-friendly words
  - strong reading match
- Prefer one strong example per reading over many mediocre examples.
- Support graceful fallback if no good vocabulary match exists for a reading.
- Extend `KanjiBrowserAdapter` with a card-generation API for vocabulary-first study.

## Non-Goals

- Do not build UI components.
- Do not own session persistence UI logic.
- Do not own IndexedDB / Firebase sync changes.

## Deliverables

1. New study-card type model.
2. New lookup utility or helper for `findWordsForKanjiReading`.
3. Adapter method that generates vocabulary-first card sequences.
4. Clear fallback behavior for missing words.

## Design Guidance

- Keep the generated card schema explicit and serializable.
- The output must be safe to persist in localStorage.
- Avoid coupling card generation directly to React components.
- Prefer additive APIs over changing existing review-mode transformation behavior.

## Questions To Answer In Your Final Notes

- What constitutes a “good” vocabulary example for a reading?
- Which readings can be safely omitted from vocabulary cards?
- What fallback card is used when vocabulary coverage is weak?

## Parallelization

This agent can run in parallel with:

- Agent 2
- Agent 6

This agent should finish before:

- Agent 3
- Agent 4
- Agent 5
