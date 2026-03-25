# Curation Agent: JLPT N3

Use this brief together with:

- `/home/helye/DevProjects/nextjs/moshimoshi/docs/vocabulary-first-kanji-agents/curation-briefs/00-curation-overview.md`

## Scope

Curate overrides for N3 kanji only.

Primary source data:

- `/home/helye/DevProjects/nextjs/moshimoshi/public/data/kanji/jlpt_3.json`

## Standards

Focus on the worst offenders first.

N3 does not require hand-curation for every kanji. Prefer surgical fixes where:

- the heuristic picks are confusing
- the word is too technical or opaque
- a much better common alternative exists

## Deliverable

Edit:

- `/home/helye/DevProjects/nextjs/moshimoshi/src/data/kanjiVocabularyOverrides.ts`

Prioritize quality over coverage.
