# Vocabulary-First Kanji: Curation Rules

## Purpose

This document defines how to choose or override vocabulary examples for kanji study cards.

It exists because the current system uses a strong heuristic baseline, but some kanji still need editorial correction. Multiple people or agents should be able to curate examples from this document and arrive at roughly the same choices.

This is the rulebook for:

- deciding when the default ranking is good enough
- deciding when a kanji/reading needs an override
- choosing the best replacement examples

## Scope

These rules apply to vocabulary-first study cards in the kanji browser.

They do not apply in the same way to:

- the details modal, which is a reference surface
- raw dictionary search
- full reading inventories

Study cards are a teaching surface. That means clarity and usefulness matter more than exhaustiveness.

## Core Principle

A good teaching example is not just a valid word. It is a word that helps the learner understand:

- the kanji’s meaning
- the target reading
- how that reading behaves in real Japanese

If a word is technically valid but pedagogically bad, it should not be a first-choice study card.

## Selection Priorities

When multiple candidate words are available for the same kanji reading, prefer them in this order.

### 1. Everyday usefulness

Prefer words a learner is likely to encounter in:

- daily conversation
- beginner textbooks
- signs and menus
- media aimed at general audiences
- common compound vocabulary

Examples of high-value words:

- `子ども`
- `時間`
- `料理`
- `上手`

Examples of lower-value words:

- anatomical terms
- technical jargon
- academic compounds
- archaic or literary words

### 2. Meaning transparency

Prefer words where the target kanji’s core meaning is still visible to a learner.

Good:

- `親子` for `子`
- `子犬` for `子`
- `上手` for `上`

Bad:

- words where the kanji is historically present but semantically opaque to a beginner
- words where the learner cannot reasonably feel what the kanji contributes

### 3. Reading clarity

Prefer words where the target reading is easy to connect to the target kanji.

Good:

- the reading segment is easy to identify
- the kanji’s position supports the reading pattern
- the example reinforces a clear on’yomi or kun’yomi intuition

Bad:

- irregular or opaque reading behavior
- forms where a short reading could be misattributed to another kanji or mora

### 4. Short and simple forms

Prefer:

- one-kanji words
- short mixed-kanji forms
- two-kanji compounds
- short common expressions

Avoid long compounds unless they are clearly the best pedagogical example.

### 5. Orthographic friendliness

Prefer forms learners are likely to actually see.

Good:

- common spellings
- common mixed-kanji/kana forms
- standard learner-facing orthography

Avoid as first picks:

- rare kanji spellings
- `ateji`
- `gikun`
- obscure alternate spellings

### 6. Pattern value

Prefer words that help a learner notice something useful.

Examples:

- on’yomi in short kanji compounds
- kun’yomi in standalone words or kana-mixed forms
- small families of words that reinforce a kanji’s main semantic field

## Explicit Penalties

A candidate should usually be rejected for first-card use if it is primarily:

- anatomical
- medical
- technical
- scientific
- legal/bureaucratic
- literary/archaic
- proper-noun-like
- semantically opaque for beginners

This does not mean the word is bad. It means it is a bad first teaching example.

## Reading-Type Guidance

### Kun’yomi

Prefer:

- standalone words
- kana-mixed forms
- everyday native-Japanese words
- words where the reading is easy to feel

Strong examples:

- `子ども`
- `男の子`
- `女の子`
- `上がる`

### On’yomi

Prefer:

- short compounds
- common Sino-Japanese vocabulary
- words the learner will actually see again

Strong examples:

- `時間`
- `音楽`
- `学生`

Avoid on’yomi picks that are:

- hyper-technical
- formal but rare in ordinary learner input
- semantically distant from the kanji’s core meaning if a better option exists

## JLPT-Sensitive Standards

The curation bar is not identical across levels.

### N5-N4

Be strict.

Expect examples to be:

- very common
- easy to understand
- beginner-safe
- high immediate utility

### N3

Still prioritize usefulness, but allow slightly broader vocabulary if it teaches the reading well.

### N2-N1

Allow more abstract examples when:

- they are genuinely common
- they are the clearest reading carrier
- the kanji itself is abstract or advanced

But still avoid needlessly obscure or domain-heavy examples if a cleaner option exists.

## Override Policy

Do not override everything.

The default heuristic should remain the baseline. Add a curated override only when one of these is true:

1. The chosen word is pedagogically bad.
2. The chosen word is semantically opaque for first exposure.
3. The chosen word is too technical or too rare for the target level.
4. The chosen word uses a weird spelling a learner should not see first.
5. A clearly better, more useful candidate exists in local data.

## What A Good Override Looks Like

A good override should provide:

- the kanji
- the exact reading being taught
- the replacement word
- the reading
- the meaning
- a short reason

Example:

```ts
{
  kanji: '子',
  readingType: 'kunyomi',
  reading: 'こ',
  word: '子ども',
  wordReading: 'こども',
  meaning: 'child',
  reason: 'Most common and semantically transparent beginner example'
}
```

## Ranking Checklist

Before approving a candidate, ask:

1. Would a learner likely see this word again soon?
2. Does the kanji’s meaning feel visible in the word?
3. Is the reading easy to associate with the target kanji?
4. Is the orthography learner-friendly?
5. Is this better than the current heuristic pick?

If the answer to two or more of those is “no”, the candidate probably should not be the first teaching example.

## Examples Of Good Judgement

### `子`

Better:

- `子ども`
- `男の子`
- `女の子`
- `親子`
- `子犬`
- `子猫`

Worse:

- `子宮`
- `硝子`

### `生`

This is a likely override candidate because it has many readings and many valid but confusing words. Picks should be especially careful and reading-specific.

### `上`

Also a likely override candidate because some common words teach different semantic intuitions. Curated choices should clearly separate readings and usage patterns.

## Deliverable Standard For Curation Agents

When reviewing a JLPT level, agents should not dump raw word lists.

They should return:

1. Kanji that need overrides
2. Reading-specific chosen examples
3. One-line reason for each choice
4. Confidence:
   - high
   - medium
   - low

## Recommended Workflow

1. Let the heuristic generate its default picks.
2. Review only the kanji/readings where the output looks weak.
3. Add overrides only for those cases.
4. Keep the override layer small and high-value.

## Non-Goals

This document does not try to:

- fully replace heuristic ranking
- create a complete curriculum by hand
- force every kanji to have manual editorial review

The intended model is:

- heuristics for full coverage
- curation for weak spots

## Future Companion Doc

If curation work scales up, add:

- `OVERRIDE_SCHEMA.md`

That doc should define the exact file format, validation rules, and integration path for curated overrides in code.
