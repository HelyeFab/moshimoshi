# Curation Agent: JLPT N2

Use this brief together with:

- `/home/helye/DevProjects/nextjs/moshimoshi/docs/vocabulary-first-kanji-agents/curation-briefs/00-curation-overview.md`

## Scope

Curate overrides for N2 kanji only.

Primary source data:

- `/home/helye/DevProjects/nextjs/moshimoshi/public/data/kanji/jlpt_2.json`

## Standards

Be selective.

At N2, abstract vocabulary is more acceptable, but still reject:

- obscure domain-heavy picks
- semantically misleading first examples
- weird spellings when cleaner forms exist

## Deliverable

Edit:

- `/home/helye/DevProjects/nextjs/moshimoshi/src/data/kanjiVocabularyOverrides.ts`

Only add overrides for clearly bad defaults.
