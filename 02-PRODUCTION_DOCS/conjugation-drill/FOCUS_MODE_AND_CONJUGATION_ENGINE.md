# Conjugation Drill: Focus Word Mode and Conjugation Engine

**Status:** Production feature guide / troubleshooting reference
**Last updated:** 2026-02-26

---

## Summary

This document explains:

1. How the Conjugation Drill works end-to-end
2. How `Focus Word` mode differs from `Random`, `My Lists`, and `SRS`
3. How word type detection feeds the conjugation engine
4. Why kanji-only `-る` verbs (example: `灯る`) can be misclassified if reading/POS data is lost
5. Recent hardening applied to `Focus Word` mode

This is the reference to read before changing:

- `src/app/[locale]/drill/page.tsx`
- `src/app/api/drill/session/route.ts`
- `src/lib/drill/question-generator.ts`
- `src/lib/conjugation/engine.ts`
- `src/lib/conjugation/wordTypeDetector.ts`
- `src/utils/jmdictLocalSearch.ts`

---

## High-Level Architecture

### Core pipeline

1. User configures drill settings on the drill page
2. Client sends `POST /api/drill/session`
3. API selects or resolves words (random/lists/srs/focus)
4. `QuestionGenerator` generates drill questions
5. `ExtendedConjugationEngine` produces conjugation forms
6. API stores session and returns questions
7. Client renders MCQ session and optional rules/help

### Key components

- **UI page**: `src/app/[locale]/drill/page.tsx`
- **Session API**: `src/app/api/drill/session/route.ts`
- **Question generation**: `src/lib/drill/question-generator.ts`
- **Conjugation engine**: `src/lib/conjugation/engine.ts`
- **Type detection**: `src/lib/conjugation/wordTypeDetector.ts`
- **Word utilities**: `src/lib/drill/word-utils.ts`
- **JMdict search**: `src/utils/jmdictLocalSearch.ts`

---

## Practice Modes Overview

### `Random Words`

- Pulls conjugatable words from JMdict practice pool (`getConjugatableWordsPractice`)
- Applies JLPT and word type filters
- Generates questions from a mixed set of words

### `My Lists`

- Pulls words from user-selected lists in Firestore
- Filters/repairs word types using drill word utilities
- Generates questions from eligible verbs/adjectives only

### `SRS`

- Pulls due words from drill SRS selection logic
- Uses same question generation + conjugation engine pipeline as other modes

### `Focus Word`

- Goal: practice many forms for **one word**
- Preferred path: user selects a specific JMdict suggestion, then API uses that exact selected entry
- Fallback path: if no suggestion selected, API searches by the typed string and resolves best match
- Last-resort fallback: pattern detection on raw input (works, but less reliable for ambiguous `-る` verbs)

---

## Entitlements (Focus Mode)

`Focus Word` mode now uses its own entitlement feature:

- **Feature ID:** `drill_focus_mode`
- **Limit type:** `daily`
- **Guest:** `5`
- **Free:** `5`
- **Premium (monthly/yearly):** `-1` (unlimited)

Mode-based entitlement mapping on the drill page / session API:

- `mode === 'focus'` -> `drill_focus_mode`
- `mode !== 'focus'` (`random`, `lists`, `srs`) -> `conjugation_drill`

Implementation references:

- Client pre-check + quota indicator switching: `src/app/[locale]/drill/page.tsx`
- Server enforcement + usage increment: `src/app/api/drill/session/route.ts`

UX note:

- Focus mode entitlement denial on drill start uses the standard entitlement toast with upgrade action (same upgrade CTA pattern as other entitlement-denied flows).

---

## Focus Word Mode (Detailed Flow)

## 1. Client-side search UI

`Focus Word` UI lives in `src/app/[locale]/drill/page.tsx`.

Behavior:

- User types a term (Japanese or English)
- Client searches local JMdict (`searchJMdictWords`)
- Client classifies each result using `detectWordType(word, kana, partsOfSpeech)`
- Only conjugatable results are shown in the suggestion list

Important detail:

- `searchJMdictWords()` often returns generic `type: 'verb'`
- `Focus Word` must **not** trust that generic type for conjugation classification
- It must reclassify using `wordTypeDetector` + reading + POS

## 2. Exact selected-word payload

When the user taps a suggestion, the client stores a typed `focusWordSelection` payload (id + kanji + kana + meaning + derived conjugation type + POS).

This avoids the classic homograph bug:

- User selects one `かえる` entry
- API re-searches `かえる`
- API accidentally picks a different `かえる`

`focusWordSelection` preserves the exact JMdict entry identity.

## 3. API resolution order (`POST /api/drill/session`)

In `mode === 'focus'`, the API resolves the target word in this order:

1. **Use `focusWordSelection` directly** (preferred)
2. **Search JMdict by typed string**, classify with `detectWordType(..., partsOfSpeech)`, reject low-confidence matches
3. **Firebase cache lookup** — check `drill_word_resolutions` for a prior AI resolution
4. **Live AI call** via `DrillWordResolverProcessorHybrid` (Ollama/Qwen primary, OpenAI fallback)
5. **Error** `NOT_CONJUGATABLE` if all paths fail or AI returns low confidence

This order is intentional. It maximizes correctness by preserving:

- reading (`kana`)
- part-of-speech tags
- exact JMdict entry identity

Raw pattern detection (`detectWordType(input, input)` with no POS) is **not used** in the focus mode path. If JMdict cannot resolve the word, the system falls through to cache/AI rather than guessing.

---

## AI Fallback for Unresolvable Words (Phase 1)

> **Status:** Fully implemented and integrated into `POST /api/drill/session` focus mode path.
> See `02-PRODUCTION_DOCS/content-generation/DRILL_WORD_RESOLVER_AI_FALLBACK_PLAN.md` for the full plan.

### Why AI fallback exists

When a word is absent from `jmdict-eng-common.json`, the system previously had no recourse except raw pattern detection, which can misclassify ambiguous `-る` verbs (e.g. `灯る` defaulted to Ichidan).

AI fallback adds two steps after JMdict search fails:

1. **Firebase cache** (`drill_word_resolutions` collection) — check if a prior AI resolution exists
2. **Live AI call** via `DrillWordResolverProcessorHybrid` — Ollama/Qwen primary, OpenAI fallback

### Components

| Component | File |
|-----------|------|
| AI Processor (OpenAI) | `src/lib/ai/processors/DrillWordResolverProcessor.ts` |
| AI Processor (Hybrid) | `src/lib/ai/processors/DrillWordResolverProcessorHybrid.ts` |
| Zod Validation Schema | `src/lib/ai/schemas/drill-word-resolver.schema.ts` |
| Firebase Cache Helper | `src/lib/drill/server/drill-word-resolution-cache.ts` |
| Route Integration | `src/app/api/drill/session/route.ts` (lines 414-511) |

### Resolution order (implemented)

```
Step 1  focusWordSelection         Client sends exact JMdict entry
        ↓ not available or invalid
Step 2  JMdict server search       searchJMdictWords() + detectWordType()
        │                          Rejects low-confidence matches
        ↓ no conjugatable match with medium/high confidence
Step 3  Firebase cache lookup      resolutionCache.get(trimmedWord)
        │                          ├─ unresolved → block immediately
        │                          └─ resolved + conjugatable + non-low confidence → use it
        ↓ cache miss
Step 4  Live AI call               DrillWordResolverProcessorHybrid
        │                          ├─ low confidence → skip (not cached, not used)
        │                          ├─ conjugatable → use + cache via setResolved()
        │                          └─ non-conjugatable → cache via setUnresolved()
        ↓ still no target word
Step 5  Block                      Return NOT_CONJUGATABLE error
```

### Caching behavior

- **Conjugatable AI results** with medium/high confidence → cached as `resolved`
- **Non-conjugatable AI results** → cached as `unresolved` (prevents repeated calls)
- **Low-confidence AI results** → **not cached, not used** (AI may improve on retry)
- Previously cached `unresolved` entries → cause immediate block (no AI call)

### Source provenance

The route tracks `resolutionSource` for every focus mode session and logs it:

| Label | Meaning |
|-------|---------|
| `selected_jmdict` | Client sent a `focusWordSelection` and it was valid |
| `searched_jmdict` | Server JMdict search produced a conjugatable match |
| `firebase_ai_cache` | Result served from `drill_word_resolutions` cache |
| `ai_live` | Fresh AI call via `DrillWordResolverProcessorHybrid` |

Log line: `[Drill API] Focus word found: X Godan (source: ai_live)`

### Phase 1 locked decisions

- **Focus Word only** — other modes are not affected
- **Block on low-confidence** — no silent Ichidan default; user sees an error
- **Provider order**: Ollama/Qwen primary, OpenAI fallback
- **Global shared cache** — all users share the `drill_word_resolutions` collection
- **Indefinite retention** — no TTL cleanup in phase 1
- **AI resolves metadata only** — the conjugation engine still generates all forms

### Safety invariant

The AI processor returns word classification metadata (lemma, reading, POS, conjugationType, confidence). It does **not** generate conjugation forms. The `ExtendedConjugationEngine` remains solely responsible for conjugation.

---

## Why `灯る` Exposed the Issue

## Symptom

`灯る` was sometimes treated as **Ichidan**, producing incorrect forms like `灯たい` and showing Ichidan in the rules modal.

## Why this happened

`灯る` is a Godan `-る` verb, but it is ambiguous if you only inspect kanji.

Correct classification needs one of:

- reading (`ともる`)
- precise JMdict POS code (e.g. `v5r`)
- reliable descriptive POS + reading

If the system falls back to raw input and effectively uses:

- `word = 灯る`
- `reading = 灯る` (wrong)

then the detector may default to low-confidence Ichidan for `-る` verbs.

## Root causes fixed in Focus mode / detection path

1. **Focus UI was filtering suggestions by exact type names** (`Godan`, `Ichidan`, etc.) even though JMdict search returns generic `verb`
2. **Focus API server-search path also relied too much on generic type / fallback**
3. **`detectWordType()` dropped the reading in some POS fallback branches**
4. **POS parsing had broad string matches that could mis-route classification (`verb` / `adverb`)**
5. **Medium-confidence POS-based conjugatable results were discarded too aggressively**

The conjugation engine itself was not the primary problem.

---

## Conjugation Engine vs Type Detection (Important Distinction)

## What the engine does well

`ExtendedConjugationEngine` in `src/lib/conjugation/engine.ts` is responsible for:

- generating forms for a **known** conjugation type
- applying conjugation rules consistently
- supporting many forms (basic, polite, te-form, potential, passive, causative, tai-form, etc.)

## What the engine does **not** decide

The engine should not be blamed for:

- identifying whether a word is Ichidan/Godan/Irregular
- recovering reading/POS for kanji-only user input
- picking the right homograph from JMdict

Those are responsibilities of:

- JMdict search (`jmdictLocalSearch`)
- Focus mode resolver (`/api/drill/session`)
- Type detection (`wordTypeDetector`)

If classification is wrong, the engine can produce incorrect-but-consistent forms.

---

## Question Generation Pipeline (Focus Mode)

`QuestionGenerator.generateQuestionsForWord(...)`:

1. Resolves word type (prefers already-resolved `word.type` from Focus/JMdict/AI/cache, falls back to `detectWordType`)
2. Enhances the word object for conjugation
3. Calls `ExtendedConjugationEngine.conjugate(...)`
4. Filters compatible forms for the detected type
5. Picks target forms
6. Generates distractors + MCQ options

This means a wrong classification early in the pipeline propagates into:

- wrong correct answer
- wrong distractors
- wrong rule modal label/pattern

### Important hardening (2026-02-26)

`QuestionGenerator` now trusts a resolved drill `word.type` (`Godan` / `Ichidan` / etc.) when present instead of always re-detecting.

Why this matters:

- `Focus Word` can resolve uncommon words via AI/cache correctly (e.g. `灯る` -> `Godan`)
- a later re-detection pass could still downgrade an ambiguous `-る` verb to `Ichidan`
- that caused incorrect Rules modal labels/patterns even when the API had resolved the word correctly

This downstream type-trust fix prevents `Godan -> Ichidan` regressions in the drill question + Rules modal path.

---

## Rules Modal: Pattern vs Usage Notes

The Rules modal now shows two distinct kinds of help:

1. **📐 Pattern** (mechanical transformation)
2. **🧠 When it's used** (pedagogical usage/meaning)

### Pattern source (engine)

- `ExtendedConjugationEngine.getConjugationRule(...)`
- Source file: `src/lib/conjugation/engine.ts`

This is a static rule explanation lookup keyed by `wordType + targetForm`.

### Usage-note source (new)

- `getConjugationUsageNote(...)`
- Source files:
  - `src/lib/conjugation/usage/getConjugationUsageNote.ts`
  - `src/lib/conjugation/usage/conjugation-usage-notes.ts`
  - `src/lib/conjugation/usage/schema.ts`

### Coverage status (2026-02-26)

- `CONJUGATION_USAGE_NOTES` now covers all `104` `ExtendedConjugationForms` keys
- `RAW_USAGE_NOTES` now explicitly contains all `104` entries (expanded from the complete runtime dataset)
- All `104` entries are currently marked `reviewed: true`
- See `02-PRODUCTION_DOCS/conjugation-drill/CONJUGATION_USAGE_NOTES_MISSING_FORMS_CHECKLIST.md` for review workflow and authoring guidance

---

## Data Shapes (Focus Mode)

### Client request payload additions

- `focusWord`: raw typed string (kept for fallback)
- `focusWordSelection`: exact selected suggestion (preferred)

### `FocusWordSelection` shape (shared type)

Defined in `src/types/drill.ts` and validated in `src/lib/schemas/drill.schema.ts`.

Key fields:

- `id`
- `kanji`
- `kana`
- `meaning`
- `type` (`Godan` / `Ichidan` / `Irregular` / `i-adjective` / `na-adjective`)
- `partsOfSpeech` (optional but important for robust detection)

---

## Recent Hardening Changes (2026-02-25)

### Focus mode fixes

- Preserve exact selected JMdict entry (`focusWordSelection`)
- Server uses selected entry before re-search
- JMdict server-search fallback classifies using `detectWordType(..., partsOfSpeech)`
- `searchJMdictWords()` now includes `partsOfSpeech` in returned objects

### Detector fixes relevant to Focus mode

- POS fallback now preserves `reading` when pattern-detecting
- Generic `verb` matching tightened to avoid accidental matches (e.g. `adverb`)
- Medium-confidence conjugatable POS results are no longer thrown away immediately
- `godan`/`ichidan` text ordering and handling improved for descriptive POS strings

---

## Testing and Regression Coverage

### Focus mode API tests

`src/app/api/drill/session/__tests__/route.test.ts`

Covers:

- exact selected focus entry is used (no re-search)
- fallback to server JMdict search when no selected entry is provided
- generic JMdict `type: 'verb'` plus POS-based reclassification path

### Word type detector regression

`src/lib/conjugation/__tests__/wordTypeDetector.test.ts`

Targeted regression added for descriptive POS + reading:

- `灯る` + `ともる` + `["Godan verb with ru ending"]` should classify as `Godan`

Note:

- Some existing tests in this file assert historical confidence behavior and may require broader normalization if the detector is refactored further.

---

## Troubleshooting Guide

## If Focus mode shows no suggestions while typing

This is no longer treated as an error by itself.

Current UX behavior:

- JMdict suggestions are optional helper suggestions
- If no suggestions appear, the user can still start the drill
- The server will then attempt: JMdict -> cache -> AI -> confidence gate

Only the server path should block with an error if it cannot confidently resolve a conjugatable word.

## If a `-る` verb is conjugated as Ichidan incorrectly

Check:

1. Did the API use a selected JMdict entry or raw fallback?
2. Does the target word have correct `kana`?
3. Did `detectWordType()` receive `reading` and POS?
4. Did the rules modal show a synthetic `word (word)` reading (bad sign)?

Red flag example:

- `灯る (灯る)` displayed as word + reading means the system likely constructed a fallback word without real kana.

## If the drill starts even after no suggestions

This is expected and intentional. Suggestions are optional convenience UI, not the source of truth.

The source of truth is the server resolution pipeline:

- selected JMdict entry (if present)
- searched JMdict
- Firebase AI cache
- live AI fallback
- low-confidence block (if unresolved/uncertain)

---

## Recommended Future Improvements

1. **Expose confidence in Focus UI**
- Show `high/medium/low` classification confidence for AI-resolved words

2. **Warn before low-confidence block**
- Example: "We could not confirm this word. Please try a different word."

3. **Add end-to-end test for `灯る`**
- UI search + select + start drill + verify no Ichidan/tai-form corruption

4. **Store resolved source on session document**
- `resolutionSource` is logged but not persisted on the Firestore session document
- Persisting it would enable analytics queries on resolution path distribution

5. **Iterate wording quality on advanced/rare forms**
- Coverage and reviewed status are complete
- Future improvements are mostly pedagogical refinement (especially classical/formal/presumptive and helper forms)

---

## Quick File Map

- `src/app/[locale]/drill/page.tsx`: drill UI, mode selector, Focus Word search UI
- `src/app/api/drill/session/route.ts`: mode dispatch and Focus Word resolution
- `src/lib/drill/question-generator.ts`: generates questions/forms/distractors
- `src/lib/conjugation/engine.ts`: conjugation logic by resolved type
- `src/lib/conjugation/usage/schema.ts`: usage-note schema for Rules modal explanations
- `src/lib/conjugation/usage/conjugation-usage-notes.ts`: complete usage-note dataset (104 explicit entries; mixed review status)
- `src/lib/conjugation/usage/getConjugationUsageNote.ts`: usage-note accessor used by the Rules modal
- `src/lib/conjugation/wordTypeDetector.ts`: detects Ichidan/Godan/etc.
- `src/utils/jmdictLocalSearch.ts`: local JMdict search and result mapping
- `src/types/drill.ts`: shared drill/focus payload types
- `src/lib/schemas/drill.schema.ts`: request schema validation
- `src/lib/ai/processors/DrillWordResolverProcessor.ts`: AI word resolver (OpenAI)
- `src/lib/ai/processors/DrillWordResolverProcessorHybrid.ts`: AI word resolver (Ollama + OpenAI)
- `src/lib/ai/schemas/drill-word-resolver.schema.ts`: Zod schema for AI output validation
- `src/lib/drill/server/drill-word-resolution-cache.ts`: Firebase cache for AI resolution results

---

## Developer Notes

- When debugging conjugation issues, always separate:
  - **word resolution**
  - **type detection**
  - **conjugation engine**
- Most "engine is broken" reports for Focus mode are actually upstream classification/data-shape issues.
