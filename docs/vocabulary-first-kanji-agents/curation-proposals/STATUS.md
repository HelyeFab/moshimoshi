# Vocabulary Override Proposal Status

This file tracks review outcomes for JLPT-level curation proposals.

## Current Status

### N4

- Proposal file:
  - `/home/helye/DevProjects/nextjs/moshimoshi/docs/vocabulary-first-kanji-agents/curation-proposals/n4.md`
- Review status:
  - approved as proposal
- Integration status:
  - implemented in code
- Implementation rule:
  - if integrated, implement `required` overrides only
  - do not implement `optional` overrides unless testing shows the heuristic actually misfires there

Notes:
- The revised N4 proposal is considered precise enough to use as the approved proposal baseline.
- `試 + こころみる → 試みる` is acceptable, but slightly less central than the strongest N4 overrides.
- Required overrides have now been merged into `src/data/kanjiVocabularyOverrides.ts`.
- Optional overrides remain proposal-only.

### N5

- Proposal file:
  - `/home/helye/DevProjects/nextjs/moshimoshi/docs/vocabulary-first-kanji-agents/curation-proposals/n5.md`
- Review status:
  - approved as proposal
- Integration status:
  - implemented in code
- Implementation rule:
  - if integrated, implement `required` overrides only
  - do not implement `optional` overrides unless testing shows the heuristic actually misfires there

Notes:
- The revised N5 proposal is considered precise enough to use as the approved proposal baseline.
- The following required overrides are the approved integration baseline:
  - `子` + `こ` → `子ども`
  - `生` + `いきる` → `生きる`
  - `生` + `せい` → `学生`
  - `上` + `うえ` → `上`
  - `上` + `あがる` → `上がる`
  - `上` + `じょう` → `上手`
  - `下` + `した` → `下`
  - `中` + `なか` → `中`
- Those required overrides have now been merged into `src/data/kanjiVocabularyOverrides.ts`.
- Optional overrides remain proposal-only.

### N3

- Proposal file:
  - `/home/helye/DevProjects/nextjs/moshimoshi/docs/vocabulary-first-kanji-agents/curation-proposals/n3.md`
- Review status:
  - approved as proposal
- Integration status:
  - validated against live heuristic output and implemented in code
- Implementation rule:
  - if integrated, implement `required` overrides only
  - do not implement `optional` overrides unless testing shows the heuristic actually misfires there

Notes:
- The revised N3 proposal is approved as a conservative proposal set.
- The approved integration baseline is intentionally minimal:
  - `術` → `技術`
  - `費` → `費用`
- Both required overrides were validated with the internal inspector and then merged into `src/data/kanjiVocabularyOverrides.ts`.
- All other N3 proposals remain proposal-only unless real heuristic failures are observed in testing.

### N2

- Proposal file:
  - `/home/helye/DevProjects/nextjs/moshimoshi/docs/vocabulary-first-kanji-agents/curation-proposals/n2.md`
- Review status:
  - approved as proposal
- Integration status:
  - validated against live heuristic output and implemented in code for required items
- Implementation rule:
  - do not merge N2 overrides blindly
  - test the live heuristic output first for each `required` candidate
  - only merge a required override if the heuristic actually selects a weaker pedagogical word

Notes:
- The revised N2 proposal is approved as a conservative proposal set.
- The current `required` candidates are:
  - `乳` → `牛乳`
  - `準` → `準備`
  - `複` → `複雑`
- All three required candidates were validated with the internal inspector and each still misfired under the live heuristic.
- Those validated required overrides have now been merged into `src/data/kanjiVocabularyOverrides.ts`.
- Optional N2 proposals remain proposal-only.

### N1

- Proposal file:
  - `/home/helye/DevProjects/nextjs/moshimoshi/docs/vocabulary-first-kanji-agents/curation-proposals/n1.md`
- Review status:
  - approved as proposal
- Integration status:
  - not separately implemented in code
- Implementation rule:
  - do not merge N1 overrides by default
  - validate live heuristic output first for every candidate
  - expect final N1 integration to be extremely small, possibly zero

Notes:
- The N1 proposal is approved as a conservative planning artifact.
- `乳` → `牛乳` is the only strong candidate currently worth serious integration consideration.
- That case was validated and is now covered indirectly by the N2 `乳` override already merged into `src/data/kanjiVocabularyOverrides.ts`.
- `娯` → `娯楽` may remain optional if testing shows poor heuristic output.
- `玩` should remain optional at most.
- `硝` should remain investigate-only unless strong evidence supports it.
- Philosophy: N1 learners can handle technical, literary, and specialized vocabulary, so trust the heuristic unless there is a catastrophic failure.

## Decision Rules

- `approved as proposal` means the document is accepted as a planning/input artifact
- it does not mean the overrides have been merged into `src/data/kanjiVocabularyOverrides.ts`
- only approved proposals should be considered for code integration
