# Vocabulary-First Kanji: Technical Onboarding

This document is the operational source of truth for the live vocabulary-first kanji feature.

If you are a future agent or engineer encountering a problem here, read this document first.
It is written to answer:

- what the feature is
- what the current product decisions are
- which files matter
- how to diagnose issues correctly
- what to change and what not to change

## What This Feature Is

The kanji browser study mode supports a `vocabulary-first` flow:

1. meaning card
2. one or more vocabulary cards that teach readings through real words
3. reading summary card
4. reading-match reinforcement card when there are at least 2 vocabulary words for that kanji

The product goal is:

- teach readings through lexical items, not through abstract reading lists
- keep study and review pedagogically aligned
- preserve progress and resumability
- let heuristics cover the full corpus, then correct only the important failures

This is not a pure dictionary-lookup feature.
It is a teaching system with editorial judgment layered on top of heuristics.

## Read This First

If you only have 10 minutes, read these files in order:

1. `/home/helye/DevProjects/nextjs/moshimoshi/src/app/[locale]/kanji-browser/KanjiBrowserPage.tsx`
2. `/home/helye/DevProjects/nextjs/moshimoshi/src/types/kanji-study.ts`
3. `/home/helye/DevProjects/nextjs/moshimoshi/src/lib/review-engine/adapters/KanjiBrowserAdapter.ts`
4. `/home/helye/DevProjects/nextjs/moshimoshi/src/utils/kanjiVocabularyLookup.ts`
5. `/home/helye/DevProjects/nextjs/moshimoshi/src/data/kanjiVocabularyOverrides.ts`
6. `/home/helye/DevProjects/nextjs/moshimoshi/src/components/kanji/KanjiStudyMode.tsx`
7. `/home/helye/DevProjects/nextjs/moshimoshi/src/components/kanji/VocabularyCard.tsx`
8. `/home/helye/DevProjects/nextjs/moshimoshi/src/components/kanji/ReadingMatchCard.tsx`
9. `/home/helye/DevProjects/nextjs/moshimoshi/src/lib/kanji/kanjiVocabularyInspector.ts`
10. `/home/helye/DevProjects/nextjs/moshimoshi/docs/vocabulary-first-kanji-agents/LEXICALITY_AUDIT.md`
11. `/home/helye/DevProjects/nextjs/moshimoshi/src/lib/review-engine/adapters/__tests__/kanjiBrowserAdapter.vocabulary-first.golden.test.ts`
12. `/home/helye/DevProjects/nextjs/moshimoshi/src/utils/__tests__/furigana.target-reading.test.ts`

If your work touches content quality, also read:

- `/home/helye/DevProjects/nextjs/moshimoshi/docs/vocabulary-first-kanji-agents/CURATION_RULES.md`
- `/home/helye/DevProjects/nextjs/moshimoshi/docs/vocabulary-first-kanji-agents/OVERRIDE_SCHEMA.md`

If your work touches Kanji Browser study gating, also read:

- `/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/entitlements/KANJI_BROWSER_STUDY_GATING_PLAN.md`
- `/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/entitlements/KANJI_BROWSER_STUDY_AGENT_OVERVIEW.md`

Important rollout note:

- the current production rollout is intentionally private-first
- the feature is currently guarded by:
  - `src/lib/features/featureFlags.ts`
  - `src/lib/features/kanjiBrowserStudyRollout.ts`
- that rollout guard is temporary and is expected to be removed once the feature is approved for public release

## Current System Model

### 1. Session Layer

File:

- `src/types/kanji-study.ts`

This defines:

- `KanjiStudyCard`
- `KanjiStudySessionState`
- `getSessionPosition()`
- `advanceToNextCard()`
- `goToPreviousCard()`

Important persisted fields:

- `mode`
- `kanji[]`
- `currentKanjiIndex`
- `completedCards`
- `trackedVocabularyCardIds`

`trackedVocabularyCardIds` is intentional and important:

- each vocabulary card is counted at most once per session
- back/next revisits do not inflate exposure
- refresh/resume does not double-count either

### 2. Page / Flow Layer

File:

- `src/app/[locale]/kanji-browser/KanjiBrowserPage.tsx`

Responsibilities:

- starts study sessions
- restores persisted sessions from `localStorage`
- shows the resume banner on browser entry
- routes between browse, study, and review
- tracks vocabulary exposure on card completion
- emits vocabulary-first analytics

Important current behavior:

- entering the kanji browser does **not** auto-resume into study
- persisted sessions are restored into state
- the browser page shows a resume/discard choice
- vocabulary-first analytics are emitted client-side and persisted server-side for admin reporting
- the live page may also hide study-specific UI entirely if the temporary rollout helper says the current user is not in the private rollout

### 3. Card Generation Layer

File:

- `src/lib/review-engine/adapters/KanjiBrowserAdapter.ts`

Core method:

- `generateStudySequence()`

Card order:

1. meaning
2. prioritized vocabulary cards
3. reading summary
4. reading-match reinforcement card if 2+ vocabulary pairs exist

The adapter decides:

- which readings are taught
- in what order
- which example word is used for each reading
- whether that word came from:
  - curated override
  - JMdict heuristic
  - fallback example data

### 4. Vocabulary Selection Layer

File:

- `src/utils/kanjiVocabularyLookup.ts`

This is the heuristic engine.

It uses:

- JLPT ladder search first:
  - look for good words in the kanji's own JLPT band first
  - then climb upward level by level
  - only fall back to unrestricted JMdict search if the ladder fails
- reading match quality
- JMdict priority tags
- common flag
- word type preference
- word-shape bonuses
- penalties for opaque forms (`ateji`, `gikun`, rare spellings)
- penalties for technical/anatomical glosses
- penalties for affix/function-only glosses
- penalties for abstract low-value glosses
- global demotion of bare single-kanji words, especially on'yomi

Important truth:

- this is still heuristic
- it is not a linguistic parser
- it is intentionally complemented by sparse curated overrides

Supporting local JLPT data:

- `src/data/external/jlpt-word-list/raw/*.csv`
- `src/data/external/jlpt-word-list/generated/jlpt-word-index.json`
- `src/utils/jlptWordIndex.ts`

Generation script:

- `npm run build:jlpt-word-index`

Important 2026-03-25 upgrade:

- JLPT entries are now treated as first-class teaching candidates, not just a search-space filter
- display meanings prefer learner-clean JLPT meanings, but fall back to the cleanest short JMdict gloss if JLPT text is dictionary-like
- dictionary-note clutter such as `(same as ...)` must never be surfaced as the learner-facing meaning when a cleaner gloss exists

Important reading-selection rule:

- raw kunyomi notation from the source data must be preserved long enough to make editorial decisions
- affix-style readings like `おお-` or `-てき` must not become standalone vocabulary-first study targets
- closely related kunyomi variants from the same family should collapse to one representative study target

Example:

- `大` should not generate:
  - `おお`
  - `大勢`
  - duplicate `おお...` family entries in the reading match game
- `大` should generate a learner-facing set more like:
  - `大きい`
  - `大学`
  - `大切`

### 5. Curated Override Layer

File:

- `src/data/kanjiVocabularyOverrides.ts`

This is where pedagogical corrections live.

Use this file when:

- the heuristic is technically valid but pedagogically weak
- a high-impact reading needs a stable teaching word
- you need a consistent lexical anchor for a reading

Do **not** use it to hand-author the whole corpus.

Override philosophy:

- keep it sparse
- use it for high-value corrections
- let heuristics cover the majority of the corpus

### 6. UI Layer

Files:

- `src/components/kanji/KanjiStudyMode.tsx`
- `src/components/kanji/MeaningCard.tsx`
- `src/components/kanji/VocabularyCard.tsx`
- `src/components/kanji/ReadingSummaryCard.tsx`
- `src/components/kanji/ReadingMatchCard.tsx`

Important UI decisions:

- vocabulary-first cards render by card type
- active cards are keyed by `currentCard.id` to avoid stale visual reuse
- single-kanji cards hide the redundant full-reading line when it only repeats the target reading
- reading summary uses curated/prioritized readings, not the full raw inventory
- the reading-match card is tap-to-match, not drag-and-drop
- on mobile, the reading-match card stacks words above readings and uses a taller, internally scrollable frame
- on the final card of the final kanji, the primary forward action becomes an explicit finish-session action
- the reading-match card should not show two near-duplicate kunyomi family members for the same kanji
- if you see confusing near-duplicates in the match game, diagnose the reading-priority layer first, not the card UI first
- Kanji Browser now distinguishes:
  - `Unlocked` = entitlement/unlock state
  - `Learned` = actual learner progress state
- those are intentionally different and should not be collapsed into one concept

### 7. Furigana Rule

Files:

- `src/components/kanji/VocabularyCard.tsx`
- `src/utils/furigana.ts`

This is a key product invariant.

On vocabulary-first cards:

- the target kanji must render with the **target reading of the card**
- not with a guessed whole-word default reading
- not with a tokenizer-inferred alternate reading

Example:

- if a card teaches `人 / ジン`, the ruby over `人` must show `じん`
- even if the whole word has other reading behavior elsewhere

The helper enforcing this is:

- `generateTargetKanjiRuby()`

Do not revert to generic whole-word furigana generation for study cards.

### 8. Progress Layer

File:

- `src/utils/kanjiProgressManager.ts`

Current additions:

- vocabulary exposure fields are additive on top of existing kanji progress
- `trackVocabularyExposure()`
- `getVocabularyExposureStats()`

This must remain backward-compatible with existing progress storage and premium sync.

### 9. Inspector / QA Layer

Files:

- `src/lib/kanji/kanjiVocabularyInspector.ts`
- `src/app/api/admin/kanji-vocabulary-inspector/route.ts`
- `src/app/[locale]/admin/kanji-vocabulary-inspector/page.tsx`

Use the inspector for:

- single-kanji inspection
- proposal validation (`N3` / `N2` / `N1`)
- lexicality review queue
- real-user outcomes summary for the last 14 days

The inspector is a content-QA tool, not a learner-facing feature.

Admin entry point:

- `/[locale]/admin/kanji-vocabulary-inspector`

## Current Product Decisions

These are intentional and should not be casually changed:

- manual exit from study returns to browse but preserves the session
- session completion clears the saved session
- refresh/browser revisit restores session state but does not auto-drop the user into study
- vocabulary exposure counts once per vocabulary card per session
- study and review should use the same curated reading logic
- reference surfaces can show fuller reading inventory than teaching surfaces
- vocabulary-first cards should prefer lexical teaching words over dictionary-like pseudo-senses
- reading-match is per kanji, not per whole session
- reading-match appears only when a kanji has at least 2 vocabulary words
- the user must complete reading-match before advancing past that card
- the final reading-match of the final kanji should feel like closing the session, not like another ordinary skip

## Lexical-First Rule

This rule is now central.

The feature should prefer:

- a real lexical item

over:

- a bare-kanji pseudo-sense
- a suffix-like gloss
- a function-only gloss
- a context-dependent dictionary meaning
- an abstract low-value noun when a clearer teaching word exists

But do **not** over-apply this.

Important nuance:

- not every single-kanji word is bad
- many kunyomi nouns are already real lexical items and are acceptable

Examples of acceptable standalone lexical items:

- `傘`
- `刀`
- `机`
- `森`

Examples of previously bad failures:

- bare `人 = -ian`
- bare `人 = counter for people`
- bare `日 = Sunday`
- `均一` as a first `イツ` anchor
- `出演` as the first `シュツ` anchor
- `間中` as a `ジュウ` teaching card

## Runtime Data Sources

Primary local sources:

- `/home/helye/DevProjects/nextjs/moshimoshi/public/data/dictionary/jmdict-eng-common.json`
- `/home/helye/DevProjects/nextjs/moshimoshi/public/data/kanji/jlpt_5.json`
- corresponding JLPT kanji JSON files

Fallback source:

- `kanji.examples` embedded in kanji data

External benchmark source used editorially:

- Kanji Alive data
- `elzup/jlpt-word-list` data is imported locally as a search-ladder source, not called as a remote runtime API

Important rule:

- Kanji Alive is used as a benchmark/reference source, not as a runtime dependency
- we are **not** calling their API in live card generation
- the JLPT word list is local runtime data after import/build, not a network dependency

## What Has Already Been Fixed

These issue classes were already addressed and should not be accidentally reintroduced:

### Furigana alignment

Fixed:

- target reading now controls the ruby on the target kanji

Do not regress to:

- guessed whole-word furigana

### Redundant single-kanji reading display

Fixed:

- single-kanji cards no longer repeat the same reading line under the ruby when it adds no information

### JLPT ladder search

Fixed:

- kanji now search for candidate teaching words from their own JLPT level upward before falling back to unrestricted JMdict

Do not regress to:

- global unrestricted JMdict choice as the default first pass

### Stuck card rendering

Fixed:

- vocabulary-first active card container is keyed by `currentCard.id`
- reading-match uses its own card type and render branch, not a hacked summary variant

### Auto-resume hijack on browser entry

Fixed:

- session restore no longer auto-enters study when re-entering the kanji browser

### End-of-kanji passivity

Fixed:

- a kanji can now end with an active reading-match reinforcement step instead of stopping on a purely passive summary

### High-impact content failures

Corrected by heuristic changes and/or overrides:

- `人 / ジン -> 日本人`
- `人 / ニン -> 三人`
- `一 / イツ -> 唯一`
- `日 / ニチ -> 一日`
- `日 / ジツ -> 本日`
- `中 / なか -> 真ん中`
- `中 / チュウ -> 中学校`
- `中 / ジュウ -> 年中`
- `出 / シュツ -> 出発`
- `生 / セイ -> 学生`
- `度 / ド -> 何度`
- `試 / シ -> 試験`
- `術 / ジュツ -> 技術`
- `費 / ヒ -> 費用`
- `乳 / ニュウ -> 牛乳`
- `準 / ジュン -> 準備`
- `複 / フク -> 複雑`

## How To Diagnose A New Issue

When you see a bad card, classify it before changing anything.

### Class A: Furigana correctness bug

Symptoms:

- target reading badge says one thing
- ruby on the target kanji shows another

What to inspect:

- `VocabularyCard.tsx`
- `furigana.ts`

Likely fix:

- furigana generation, not scoring

### Class B: Session/render bug

Symptoms:

- progress says cards exist but UI appears stuck
- next/skip advances state but display does not update

What to inspect:

- `KanjiStudyMode.tsx`
- `KanjiBrowserPage.tsx`
- session helpers in `kanji-study.ts`

Likely fix:

- render key or state derivation, not vocabulary curation

### Class B2: Reading-match layout / gating bug

Symptoms:

- the reading-match card overflows or overlaps controls on mobile
- the user can bypass the matching step
- the final card does not read like a finish state

What to inspect:

- `ReadingMatchCard.tsx`
- `KanjiStudyMode.tsx`

Likely fix:

- responsive layout, card-frame sizing, or next-button gating

### Class C: Bad teaching word

Symptoms:

- furigana is correct
- card is internally coherent
- but the selected word is weak, abstract, pseudo-lexical, or low-teaching-value

What to inspect:

- `kanjiVocabularyLookup.ts`
- `kanjiVocabularyOverrides.ts`
- admin inspector
- lexicality audit

Likely fix:

- heuristic adjustment or sparse override

### Class D: Bare word that may actually be okay

Symptoms:

- word is single-kanji
- but also a real standalone lexical item

What to inspect:

- lexicality audit
- actual JLPT level
- whether replacing it would make the teaching word worse

Likely action:

- often leave it alone

## What To Do In Practice

If you encounter a future issue, follow this workflow:

1. Reproduce the issue in a fresh study session.
2. Decide which class of issue it is:
   - furigana
   - render/session
   - bad teaching word
   - acceptable standalone lexical item
3. Open the admin inspector:
   - inspect the kanji
   - check curated vs heuristic source
   - check alternatives
   - if the issue is outcomes-related, load the outcomes panel
4. Check the lexicality queue if it looks like a content-quality problem.
5. If the current selection is bad and the heuristic has no good alternative:
   - add or refine a sparse override
6. If the heuristic is broadly wrong for a class of words:
   - adjust scoring in `kanjiVocabularyLookup.ts`
7. If the issue is high-impact and should never regress:
   - add it to the golden set test

## How To Use The Existing QA Tooling

### Lexicality Audit

Files:

- `docs/vocabulary-first-kanji-agents/LEXICALITY_AUDIT.json`
- `docs/vocabulary-first-kanji-agents/LEXICALITY_AUDIT.md`

Purpose:

- inventory remaining live bare-kanji vocabulary cards across N5-N1
- distinguish suspicious cases from acceptable standalone nouns

Interpretation:

- do not mass-replace all bare cards
- focus on the suspicious subset

### Lexicality Review Queue

Available in:

- `/[locale]/admin/kanji-vocabulary-inspector`

Use:

- click `Review Lexicality Queue`
- start with `high` items first

Current meaning:

- `high` = remaining bare on'yomi
- `medium` = suspicious low-level kunyomi cases

### Golden Set

File:

- `src/lib/review-engine/adapters/__tests__/kanjiBrowserAdapter.vocabulary-first.golden.test.ts`

Purpose:

- protect high-impact reading/example anchors from regression

Current coverage:

- stable N5-N2 reading anchors

Rule:

- if you fix a high-impact teaching-word failure, add it here if it should remain stable

### Furigana Invariant Test

File:

- `src/utils/__tests__/furigana.target-reading.test.ts`

Purpose:

- protect the rule that study-card ruby must show the targeted reading for the targeted kanji
- especially for irregular whole-word readings like `9日`

Rule:

- if you touch study-card furigana behavior, run this test

### Real-User Outcomes Panel

Files:

- `src/app/api/kanji-study/analytics/route.ts`
- `src/app/api/admin/kanji-vocabulary-inspector/route.ts`
- `src/app/[locale]/admin/kanji-vocabulary-inspector/page.tsx`

Purpose:

- answer:
  - are people finishing sessions more often?
  - which cards are people leaving on?

Important note:

- outcomes only include events persisted after server-side analytics storage was added
- older client-only kanji-study activity is not retroactively available

## How To Safely Change This Feature

Before changing anything meaningful:

1. decide whether your change affects:
   - session persistence
   - card generation
   - furigana
   - reading prioritization
   - lexicality / vocabulary quality
   - progress tracking
   - i18n
2. run `npm run type-check`

After changing anything meaningful:

1. run `npm run type-check`
2. if content logic changed, run the golden-set test:
   - `npm run test:unit -- --runInBand src/lib/review-engine/adapters/__tests__/kanjiBrowserAdapter.vocabulary-first.golden.test.ts`
3. if furigana behavior changed, run:
   - `npm run test:unit -- --runInBand src/utils/__tests__/furigana.target-reading.test.ts`
4. manually test:
   - study start
   - refresh resume
   - exit and resume
   - session completion
   - one vocabulary card counted once per session
   - mobile card layout
   - reading-match appears when expected
   - reading-match is required before advancing
   - final reading-match of final kanji finishes the session cleanly

If you touched content quality specifically:

1. inspect the changed kanji in the admin inspector
2. check whether the lexicality queue got better or worse
3. consider adding/adjusting a golden-set case

## What Not To Do

- do not introduce a runtime dependency on the Kanji Alive API
- do not introduce a runtime dependency on remote JLPT word-list APIs
- do not replace the heuristic system with full manual curation
- do not mass-convert all bare single-kanji words into phrases
- do not treat every abstract word as bad at N2/N1
- do not change resume semantics casually
- do not switch furigana back to generic whole-word generation for study cards
- do not bypass the JLPT ladder and go straight to unrestricted search unless you are intentionally changing the ranking architecture
- do not let users bypass reading-match by accident once they are on that card

## Current Strategic Direction

The system now relies on this combination:

- strong heuristic defaults
- sparse expert overrides
- JLPT ladder search
- vocabulary-first sequencing
- per-kanji reading-match reinforcement
- curated reading prioritization
- persistence and progress continuity
- queue-based editorial review
- golden-set regression protection
- furigana invariant protection
- real-user outcomes visibility in admin

That is the intended architecture going forward.

If you need to improve the feature further, the next best moves are:

1. extend the golden set gradually
2. work through the high-priority lexicality queue
3. only then review broader low-risk standalone nouns
