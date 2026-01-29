# Blast Mode Overview

**Status:** DRAFT
**Last Updated:** 2026-01-29
**Owner:** Product + Eng

---

## Summary

Blast Mode is a high-velocity learning flow designed to work across content types (kanji, vocabulary, lists, and select sentence/phrase content). It is a **separate flow** (like Kanji Mastery), uses **no typing**, and adapts its step sequence based on content capabilities (readings, kana-only, kanji-only, etc.).

Core idea: **6 potential screens** per item, with adaptive skips.

---

## Goals

- A single blast flow that works across **kanji, vocab, lists, and some sentence content**.
- **No typing** anywhere: tiles or multiple-choice only.
- Adaptive step generation to avoid impossible screens.
- Leverage existing data sources (JMdict, kana/kanji datasets, list pools, review-engine adapters).
- Independent from existing study/review flows (own entry point, own UI).

## Non-Goals

- No timers or time pressure in v1.
- No audio-only flow (may be Phase 3+).
- No new SRS algorithm in v1 (re-use existing progress/tracking hooks).

---

## Entry Point

Proposed route:

- `src/app/[locale]/tools/blast-mode/page.tsx`
- `src/app/[locale]/tools/blast-mode/learn/page.tsx`

Separate flow, but can use shared UI patterns from `kanji-mastery` and `review-engine`.

---

## Feature Flag (Production)

Blast Mode is gated by a feature flag.

- **Flag key:** `NEXT_PUBLIC_FEATURE_BLAST_MODE`
- **Default behavior:**
  - **Development:** ON by default
  - **Production:** OFF by default

### Enable in Production
Set the env var at deploy time:

```
NEXT_PUBLIC_FEATURE_BLAST_MODE=true
```

This enables:
- The Blast Mode card in Learning Village
- `/tools/blast-mode` and `/tools/blast-mode/learn` routes

---

## Core Screens (6 possible)

**Screen 1 — Meaning → Japanese (MCQ)**
- Prompt: English meaning.
- Answers: 1 correct Japanese + 3 Japanese distractors.

**Screen 2 — Reassemble (Tiles)**
- Prompt: English meaning.
- Task: Reassemble the Japanese answer from tiles.
- Tile priority: morpheme split → kana chunk split → kanji character order.

**Screen 3 — Onyomi (MCQ)**
- Prompt: Kanji + "Choose Onyomi".
- Answers: 1 correct onyomi + 3 reading distractors.

**Screen 4 — Kunyomi (MCQ)**
- Prompt: Kanji + "Choose Kunyomi".
- Answers: 1 correct kunyomi + 3 reading distractors.

**Screen 5 — Other Reading (MCQ)**
- If multiple readings exist, test the secondary reading (same or other type).
- If none, skip.

**Screen 6 — Japanese → Meaning (MCQ)**
- Prompt: Japanese word.
- Answers: 1 correct English + 3 English distractors.

---

## Adaptive Rules

### Kanji
- Use 1, 2, 3, 4, 5 (if multiple readings), 6.
- If onyomi or kunyomi missing, skip that screen.

### Vocabulary (kanji + kana)
- Use 1, 2, 6.
- Skip reading screens unless the item explicitly contains onyomi/kunyomi metadata.

### Kana-only vocabulary
- Use 1, 2 (kana chunks), 6.
- Skip onyomi/kunyomi screens.

### Lists
- Treat as vocabulary if item has lemma + reading.
- If list item is sentence/phrase, use 1 and 6, optionally Screen 2 (phrase chunk reorder).

### Sentences / Phrases
- Screen 2 becomes phrase reorder (chunk tiles) or is skipped.
- Reading screens skipped.

---

## Data Model (Proposed)

```ts
export type BlastContentType = 'kanji' | 'vocabulary' | 'list' | 'sentence'

export interface BlastItem {
  id: string
  contentType: BlastContentType
  kanji?: string
  kana?: string
  meaningEn: string
  readings?: {
    onyomi?: string[]
    kunyomi?: string[]
    other?: string[]
  }
  tokens?: string[]        // For tile reconstruction
  sourceTags?: string[]    // JLPT, listId, etc.
}

export type BlastStepType =
  | 'meaning_to_jp_mcq'
  | 'jp_reassemble'
  | 'onyomi_mcq'
  | 'kunyomi_mcq'
  | 'other_reading_mcq'
  | 'jp_to_meaning_mcq'

export interface BlastStep {
  stepType: BlastStepType
  prompt: string
  answer: string | string[]
  options?: string[]
  tiles?: string[]
}
```

---

## Step Generation

Single entry point builds steps per item:

1. Normalize item to `BlastItem` (adapter layer).
2. Generate steps in the fixed order.
3. Apply adaptive skips if required data missing.
4. Attach distractors and tiles.

---

## Distractor Strategy (v1)

**Meaning MCQ**
- Same POS, JLPT tier if possible, similar frequency.
- Avoid synonyms if too close.

**Japanese MCQ**
- Same length and similar kana patterns.
- Same source pool (list/JLPT level).

**Reading MCQ**
- Same mora count.
- Phonetic neighbors.
- Avoid trivial overlap with correct reading.

---

## Tile Strategy (Screen 2)

Priority order:

1. Morpheme split (e.g., 食 + べ + る).
2. Kana chunk split (2–3 mora chunks).
3. Kanji character order (for kanji-only).

---

## Progress + XP

- Separate flow, but should emit `SESSION_COMPLETED` via Event Hub for XP parity.
- Store results using existing review-engine patterns where possible.

---

## Dependencies

- `ReviewSessionUI` (for standardized session events).
- `kanjiService`, `jmdictLocalSearch`, list pools.
- `useFeature` entitlements (if gated).

---

## Risks

- Distractor quality (especially for lists and kana-only items).
- Tile splitting for irregular readings/compounds.
- Over-skipping on sparse items (needs fallback rules).

---

## Open Questions

- How to treat multi-word phrases vs. single vocabulary items in Screen 2.
- Whether to show kanji+kana together in options (default: yes).
- Whether to add optional audio hints (Phase 3+).
