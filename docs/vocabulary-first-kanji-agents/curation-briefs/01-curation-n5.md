# Curation Agent: JLPT N5

Use this brief together with:

- `/home/helye/DevProjects/nextjs/moshimoshi/docs/vocabulary-first-kanji-agents/curation-briefs/00-curation-overview.md`

## Scope

Curate overrides for N5 kanji only.

Primary source data:

- `/home/helye/DevProjects/nextjs/moshimoshi/public/data/kanji/jlpt_5.json`

## Standards

Be strict.

N5 overrides should strongly prefer:

- very common words
- immediate learner usefulness
- semantic transparency
- simple spelling
- high beginner payoff

## Deliverable

Edit:

- `/home/helye/DevProjects/nextjs/moshimoshi/src/data/kanjiVocabularyOverrides.ts`

Add only high-confidence overrides.
