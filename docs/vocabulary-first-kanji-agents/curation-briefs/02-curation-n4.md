# Curation Agent: JLPT N4

Use this brief together with:

- `/home/helye/DevProjects/nextjs/moshimoshi/docs/vocabulary-first-kanji-agents/curation-briefs/00-curation-overview.md`

## Scope

Curate overrides for N4 kanji only.

Primary source data:

- `/home/helye/DevProjects/nextjs/moshimoshi/public/data/kanji/jlpt_4.json`

## Standards

Still strict, but slightly broader than N5.

Prefer:

- common words learners will actually meet soon
- strong reading clarity
- semantically visible kanji contribution

## Deliverable

Edit:

- `/home/helye/DevProjects/nextjs/moshimoshi/src/data/kanjiVocabularyOverrides.ts`

Add only overrides that clearly improve the heuristic pick.
