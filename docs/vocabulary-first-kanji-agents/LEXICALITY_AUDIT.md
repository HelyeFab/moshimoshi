# Lexicality Audit

Generated from the live `KanjiBrowserAdapter` study sequence generator after the current
vocabulary-first cleanup pass.

Source artifact:
- `docs/vocabulary-first-kanji-agents/LEXICALITY_AUDIT.json`

## Summary

Remaining bare-kanji vocabulary cards in live output:

- Total: `198`
- N5: `6`
- N4: `8`
- N3: `29`
- N2: `33`
- N1: `122`

Breakdown by source/type:

- `kunyomi:jmdict`: `188`
- `onyomi:jmdict`: `8`
- `kunyomi:curated`: `2`

## Interpretation

This is materially better than the earlier state.

The major failure mode that was hurting the feature has been reduced:

- bad bare `onyomi` pseudo-senses
- affix-like meanings
- counter glosses without a real counted form
- abstract dictionary entries outranking better teaching words

Those are now mostly handled by:

- global bare-word demotion in `src/utils/kanjiVocabularyLookup.ts`
- sparse curated overrides in `src/data/kanjiVocabularyOverrides.ts`

What remains is mostly a different category:

- standalone `kunyomi` nouns that are already real lexical items

Examples:

- `丘 / おか / hill`
- `傘 / かさ / umbrella`
- `刀 / かたな / sword`
- `机 / つくえ / desk`
- `森 / もり / forest`
- `酒 / さけ / alcohol`

These are not automatically feature failures.

## Product Decision

The vocabulary-first rule should be:

- prefer fuller lexical items over bare-kanji entries when a clearer, more teachable word exists
- do not replace standalone lexical items just because they are single-kanji words

That means:

- bare `onyomi` cards are high suspicion by default
- bare `kunyomi` cards are acceptable when they are genuine everyday words

## Priority Worklist

### P0: Keep auditing `onyomi` bare cards

There are only a small number left, and they deserve manual review first.

Examples already known to need intervention were:

- `人`
- `日`
- `一`
- `中`
- `出`

That class should continue to be treated as high priority.

### P1: Review low-level `kunyomi` edge cases

These are the only remaining N5/N4 bare cards in live output:

- N5:
  - `上 / うえ`
  - `下 / した`
  - `下 / もと`
  - `十 / と`
  - `十 / とお`
  - `土 / つち`
- N4:
  - `公 / おおやけ`
  - `妹 / いもうと`
  - `姉 / あね`
  - `字 / あざ`
  - `弟 / おとうと`
  - `文 / ふみ`
  - `病 / やまい`
  - `空 / そら`

These should be reviewed case-by-case, not auto-replaced.

Likely acceptable:

- `妹`
- `姉`
- `弟`
- `空`
- `土`

Likely suspicious:

- `下 / もと`
- `字 / あざ`
- `文 / ふみ`
- `病 / やまい`
- `公 / おおやけ`

### P2: Leave most N2/N1 standalone nouns alone

At N2/N1, many remaining bare cards are already strong standalone lexical items.
Examples:

- `傘`
- `刀`
- `机`
- `森`
- `湖`
- `祭`
- `扉`
- `暁`

These do not need replacement just to satisfy a "fuller phrase" preference.

Replacing them would often make the teaching word less clear, not more.

## Recommended Next Step

Do not start a broad override pass across all 198 items.

Instead:

1. Manually review the remaining `onyomi` bare cards first.
2. Manually review the small N5/N4 suspicious `kunyomi` set.
3. Leave N2/N1 standalone lexical nouns alone unless a concrete problem appears in QA.

## Current Status

The feature is not yet "finished forever", but the lexicality problem is now much narrower:

- previously: structural and widespread
- now: mostly localized to a small review set plus some acceptable standalone nouns
