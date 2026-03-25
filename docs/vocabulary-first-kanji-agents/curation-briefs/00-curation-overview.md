# Vocabulary-First Kanji: Curation Work Overview

## Mission

Review heuristic vocabulary picks for one JLPT level and add curated overrides only where the current study examples are pedagogically weak.

This is not a rewrite of the system. The heuristic ranking remains the global default. Your job is to improve the weak spots.

## Read First

1. `/home/helye/DevProjects/nextjs/moshimoshi/docs/vocabulary-first-kanji-agents/TECHNICAL_ONBOARDING.md`
2. `/home/helye/DevProjects/nextjs/moshimoshi/docs/vocabulary-first-kanji-agents/CURATION_RULES.md`
3. `/home/helye/DevProjects/nextjs/moshimoshi/docs/vocabulary-first-kanji-agents/OVERRIDE_SCHEMA.md`
4. `/home/helye/DevProjects/nextjs/moshimoshi/src/data/kanjiVocabularyOverrides.ts`
5. `/home/helye/DevProjects/nextjs/moshimoshi/src/lib/review-engine/adapters/KanjiBrowserAdapter.ts`
6. `/home/helye/DevProjects/nextjs/moshimoshi/src/utils/kanjiVocabularyLookup.ts`

## Output Standard

You should edit `src/data/kanjiVocabularyOverrides.ts` directly.

Add overrides only when:

- the current word is pedagogically weak
- a clearly better local-data candidate exists

Each override must include:

- word
- wordReading
- meaning
- reason
- confidence

## Non-Goals

- Do not change ranking logic
- Do not change UI
- Do not change session architecture
- Do not create overrides for every kanji by default
