# Curation Agent: JLPT N1

Use this brief together with:

- `/home/helye/DevProjects/nextjs/moshimoshi/docs/vocabulary-first-kanji-agents/curation-briefs/00-curation-overview.md`

## Scope

Curate overrides for N1 kanji only.

Primary source data:

- `/home/helye/DevProjects/nextjs/moshimoshi/public/data/kanji/jlpt_1.json`

## Standards

Be minimal and pragmatic.

N1 should rely mostly on the heuristic baseline unless a pick is clearly poor even for advanced learners.

Override only when:

- the heuristic output is actively misleading
- the example is bizarre, technical, or low-teaching-value
- a clearly better, more standard candidate exists

## Deliverable

Edit:

- `/home/helye/DevProjects/nextjs/moshimoshi/src/data/kanjiVocabularyOverrides.ts`

Keep the override layer sparse.
