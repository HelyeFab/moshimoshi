# Vocabulary-First Kanji Mode

## Mission

Implement a new kanji-browser study experience that teaches kanji readings through real vocabulary words before presenting isolated reading summaries.

This feature must feel like a natural extension of the existing kanji browser, not a disconnected experiment.

## Product Goal

Replace the current "see kanji + all readings at once" study experience with a vocabulary-first progression:

1. Meaning introduction
2. Vocabulary cards that teach one reading through a real word
3. Reading summary after the learner has seen the readings in context

The learner should feel that they are learning useful Japanese words first, and discovering kanji patterns through repeated exposure.

## Core UX Principles

- No reading overload on first contact.
- Real words before isolated readings.
- Patterns should emerge naturally from examples.
- The feature must work on mobile first.
- Study session persistence is product-critical.
- Existing kanji browser review mode must remain coherent with the new study model.
- Curated readings on pedagogical surfaces, full readings only on reference surfaces.

## Existing System Context

Read these first if you are new to the subsystem:

- `/home/helye/DevProjects/nextjs/moshimoshi/src/app/[locale]/kanji-browser/KanjiBrowserPage.tsx`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/components/kanji/KanjiStudyMode.tsx`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/components/review-engine/ReviewSessionUI.tsx`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/components/review-engine/cards/KanjiCard.tsx`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/lib/review-engine/adapters/KanjiBrowserAdapter.ts`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/services/kanjiService.ts`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/utils/jmdictLocalSearch.ts`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/utils/kanjiReadingPriority.ts`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/utils/kanjiProgressManager.ts`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/lib/review-engine/progress/UniversalProgressManager.ts`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/app/api/progress/track/route.ts`

## Shared Constraints

- Do not break the existing kanji browser browse/review flows.
- Do not regress study-session persistence.
- Avoid introducing network dependencies when local data already exists.
- Prefer local JMdict and existing kanji/Tatoeba caches over new remote sources.
- Respect current i18n conventions for all user-facing strings.
- Avoid large architectural rewrites unless the file owner prompt explicitly asks for them.

## Canonical Local Data Sources

- `/home/helye/DevProjects/nextjs/moshimoshi/public/data/dictionary/jmdict-eng-common.json`
- `/home/helye/DevProjects/nextjs/moshimoshi/public/data/kanji/jlpt_5.json`
- `/home/helye/DevProjects/nextjs/moshimoshi/public/data/kanji-sentences/manifest.json`
- `/home/helye/DevProjects/nextjs/moshimoshi/public/data/kanji-sentences/*.json`

## Feature Shape We Are Building

- New study mode option: `vocabulary-first`
- Multi-card study sequence per kanji
- Session schema that supports card-level persistence
- Vocabulary lookup and prioritization using local data
- Pattern hints and furigana-aware vocabulary presentation
- Progress tracking for vocabulary exposure
- No breaking API changes

## Workstream Layout

- Agent 1: data model and vocabulary card generation
- Agent 2: study-session architecture and persistence
- Agent 3: study UI and new card components
- Agent 4: progress tracking and sync integration
- Agent 5: review/reuse alignment, furigana/pedagogy polish, browser consistency
- Agent 6: testing, rollout, and QA plan

## Parallelization Summary

Can run in parallel immediately:

- Agent 1 and Agent 2
- Agent 6 can begin read-only test planning in parallel with both

Can begin after Agent 1 and Agent 2 establish contracts:

- Agent 3
- Agent 4
- Agent 5

Should run after the implementation shape stabilizes:

- Agent 6 final verification pass

## Deliverable Standard

Every agent should return:

1. What they changed
2. Files touched
3. Risks / assumptions
4. What depends on their work
5. What should be reviewed before merge
