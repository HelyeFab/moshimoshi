# Agent 5: Browser Consistency, Review Alignment, And Pedagogy Polish

## Overview

Vocabulary-first study should not feel isolated from the rest of the kanji browser. The kanji browser, study mode, and review mode should present a coherent pedagogical story.

You own the alignment layer across browser surfaces and review surfaces.

You are not alone in the codebase. Other agents may be working at the same time. Do not revert their changes.

## Ownership

Primary ownership:

- `/home/helye/DevProjects/nextjs/moshimoshi/src/components/review-engine/cards/KanjiCard.tsx`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/components/kanji/KanjiDetailsModal.tsx`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/components/review-engine/ReviewSessionUI.tsx`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/hooks/usePrioritizedKanjiReadings.ts`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/utils/kanjiReadingPriority.ts`

## Read First

- `/home/helye/DevProjects/nextjs/moshimoshi/docs/vocabulary-first-kanji-agents/00-feature-overview.md`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/components/review-engine/cards/KanjiCard.tsx`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/components/kanji/KanjiDetailsModal.tsx`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/components/review-engine/ReviewSessionUI.tsx`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/utils/kanjiReadingPriority.ts`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/utils/jmdictLocalSearch.ts`

## Goal

Ensure the new vocabulary-first study approach aligns with:

- review-mode answer presentation
- browser modal summaries
- reading prioritization logic
- pattern explanation quality
- optional furigana / ruby presentation choices

## Requirements

- Review surfaces should remain pedagogically consistent with study surfaces.
- Curated readings should remain curated on pedagogical surfaces.
- Full reading inventory should remain available on the reference surface.
- If pattern hints are added, ensure they are actually correct enough for learners.
- Avoid introducing fake rules that will mislead later.
- Consider how furigana or reading toggles should behave in study cards.

## Non-Goals

- Do not own the core study session architecture.
- Do not own progress sync schema.
- Do not create a large product copy project.

## Deliverables

1. Review/browser alignment adjustments.
2. Pattern-hint correctness pass.
3. Recommendation on whether furigana should be default-on, toggleable, or delayed.

## Questions To Answer In Your Final Notes

- Which surfaces are pedagogical vs reference?
- What pattern hints are safe?
- What is the recommended furigana behavior for vocabulary-first cards?

## Parallelization

Start after Agent 1 establishes the vocabulary and reading data shape.

Can run in parallel with:

- Agent 3
- Agent 4
- Agent 6
