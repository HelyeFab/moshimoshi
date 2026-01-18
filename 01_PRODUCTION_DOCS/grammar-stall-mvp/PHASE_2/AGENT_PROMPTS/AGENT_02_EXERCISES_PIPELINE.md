# Agent 02 - N4 Exercises Pipeline

## Mission
Provide N4 exercises in the same runtime format as N5 so practice sessions work end-to-end.

## Must Read First (in order)
1. `01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/LEAD_HANDOFF.md`
2. `01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/PHASE_2_SPECIFICATION.md`
3. `01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/TECHNICAL_DESIGN.md`
4. `01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/DATA_SCHEMA.md`

## Required Code & Data Context
- `public/data/grammar/exercises/n5/`
- `public/data/grammar/exercises/`
- `scripts/grammar/generate-exercise-lite.js`
- `src/app/[locale]/learn/grammar/[pointId]/practice/page.tsx`
- `src/lib/grammar/types.ts`

## Constraints (Do Not Violate)
- Do not add dependencies.
- Keep exercise schema identical to N5.
- Do not modify URE adapters or XP paths.

## Tasks
1. **Generate or provide N4 exercises**
   - Write exercise JSON to `public/data/grammar/exercises/n4/` matching N5 schema.
   - Ensure `grammarPointId` matches N4 point IDs.

2. **Generate lite files**
   - Run or reuse `scripts/grammar/generate-exercise-lite.js` to create `.lite.json` for N4.

3. **Provide a coverage report**
   - List how many N4 points have exercises and how many are missing.

## Deliverables
- N4 exercises (full + lite) in the correct folder.
- Coverage summary and any gaps.

## Out of Scope
- Data normalization of grammar points.
- UI / SEO changes.
