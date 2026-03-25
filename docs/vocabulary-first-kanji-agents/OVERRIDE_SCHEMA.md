# Vocabulary-First Kanji: Override Schema

## Purpose

This document defines the code-level schema for curated vocabulary overrides.

These overrides exist to correct pedagogically weak heuristic picks for specific:

- kanji
- reading
- reading type

The heuristic JMdict-backed ranker remains the default. Overrides should be sparse and high-value.

## Code Location

Primary file:

- `/home/helye/DevProjects/nextjs/moshimoshi/src/data/kanjiVocabularyOverrides.ts`

Current integration point:

- `/home/helye/DevProjects/nextjs/moshimoshi/src/lib/review-engine/adapters/KanjiBrowserAdapter.ts`

## Current Type Shape

```ts
export type OverrideReadingType = 'onyomi' | 'kunyomi'
export type OverrideConfidence = 'high' | 'medium' | 'low'

export interface CuratedVocabularyCandidate {
  word: string
  wordReading: string
  meaning: string
  reason: string
  confidence: OverrideConfidence
  isCommonWord?: boolean
  notes?: string
}

export interface CuratedReadingOverrideSet {
  kunyomi?: Record<string, CuratedVocabularyCandidate[]>
  onyomi?: Record<string, CuratedVocabularyCandidate[]>
}

export interface CuratedKanjiVocabularyOverride extends CuratedReadingOverrideSet {
  jlpt?: JLPTLevel
  notes?: string
}

export type KanjiVocabularyOverrideMap = Record<string, CuratedKanjiVocabularyOverride>
```

## Example

```ts
export const kanjiVocabularyOverrides: KanjiVocabularyOverrideMap = {
  子: {
    jlpt: 'N5',
    notes: 'Avoid technical or semantically opaque first examples',
    kunyomi: {
      こ: [
        {
          word: '子ども',
          wordReading: 'こども',
          meaning: 'child',
          reason: 'Most common and semantically transparent beginner example',
          confidence: 'high',
          isCommonWord: true,
        },
        {
          word: '男の子',
          wordReading: 'おとこのこ',
          meaning: 'boy',
          reason: 'Very common supporting example for the same reading',
          confidence: 'high',
          isCommonWord: true,
        },
      ],
    },
    onyomi: {
      ス: [
        {
          word: '椅子',
          wordReading: 'いす',
          meaning: 'chair',
          reason: 'Common everyday word that cleanly teaches the reading',
          confidence: 'high',
          isCommonWord: true,
        },
      ],
    },
  },
}
```

## Operational Semantics

Current adapter behavior:

- if curated candidates exist for a kanji+reading, the first candidate is used as the study card
- otherwise the system falls back to heuristic JMdict ranking
- if JMdict has no acceptable match, the system falls back again to embedded `kanji.examples`

Sequence source metadata now supports:

- `curated`
- `jmdict`
- `fallback`
- `mixed`

## Editorial Rules

Before adding overrides, read:

- `/home/helye/DevProjects/nextjs/moshimoshi/docs/vocabulary-first-kanji-agents/CURATION_RULES.md`

That document defines what makes a good teaching example.

## Override Discipline

Do:

- add overrides only when the default ranking is pedagogically weak
- keep reasons short and concrete
- prefer high-confidence entries for N5-N4
- preserve the heuristic fallback for untouched kanji

Do not:

- dump giant raw word lists
- add five mediocre alternatives “just in case”
- override every kanji by default
- treat this as a full curriculum authoring system

## Agent Deliverable Format

Agents working by JLPT level should propose patches directly in:

- `src/data/kanjiVocabularyOverrides.ts`

Each override should include:

- `jlpt`
- `readingType`
- exact `reading`
- `word`
- `wordReading`
- `meaning`
- `reason`
- `confidence`

## Review Checklist

Before accepting an override:

1. Is the word more useful than the heuristic pick?
2. Is the kanji’s meaning more transparent?
3. Is the reading easier to feel?
4. Is the spelling learner-friendly?
5. Does it satisfy `CURATION_RULES.md`?

If the answer is not clearly yes, do not add it.
