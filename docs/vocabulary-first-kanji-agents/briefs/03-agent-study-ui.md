# Agent 3: Study UI And New Card Components

## Overview

We are turning kanji study into a multi-card learning flow. The UI must stay mobile-first, visually clear, and pedagogically focused.

You own the study-mode UI layer and the new card components.

You are not alone in the codebase. Other agents may be working at the same time. Do not revert their changes. Assume Agent 1 and Agent 2 may have changed card/session types.

## Ownership

Primary ownership:

- `/home/helye/DevProjects/nextjs/moshimoshi/src/components/kanji/KanjiStudyMode.tsx`

New files you are allowed to create:

- `/home/helye/DevProjects/nextjs/moshimoshi/src/components/kanji/VocabularyCard.tsx`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/components/kanji/PatternHint.tsx`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/components/kanji/ReadingSummaryCard.tsx`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/components/kanji/MeaningCard.tsx`

## Read First

- `/home/helye/DevProjects/nextjs/moshimoshi/docs/vocabulary-first-kanji-agents/00-feature-overview.md`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/components/kanji/KanjiStudyMode.tsx`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/components/kanji/KanjiDetailsModal.tsx`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/components/review-engine/cards/KanjiCard.tsx`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/hooks/useTTS.ts`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/utils/kuromojiService.ts`

## Goal

Build the visual and interactive study experience for vocabulary-first kanji learning.

## Requirements

- Render multiple card types in study mode:
  - meaning
  - vocabulary
  - reading summary
- Mobile first: no unnecessary scrolling in the common case.
- Vocabulary card should make the target reading obvious.
- Pattern hints should be short and helpful, not lecture-like.
- Support TTS playback for the vocabulary word.
- Keep the UI visually aligned with the kanji-browser design language.
- Preserve current study controls:
  - exit
  - previous / next
  - examples
  - mark learned / reset

## Furigana / Presentation Guidance

- If you add ruby/furigana treatment, make it optional and structurally clean.
- Avoid overloading cards with every possible helper.
- The core lesson is:
  - real word
  - real reading
  - minimal useful pattern hint

## Non-Goals

- Do not own session persistence logic.
- Do not own progress storage schema.
- Do not own i18n across the whole app unless your new UI strings require it.

## Deliverables

1. New vocabulary-first card components.
2. Updated `KanjiStudyMode` that routes card rendering by card type.
3. Responsive layout that holds up on phones.

## Questions To Answer In Your Final Notes

- Which UI tradeoffs did you make for mobile?
- Where is furigana shown, and why?
- Which strings or icons still need product review?

## Parallelization

Start after Agent 1 and Agent 2 establish the card/session contract.

Can run in parallel with:

- Agent 4
- Agent 5
- Agent 6
