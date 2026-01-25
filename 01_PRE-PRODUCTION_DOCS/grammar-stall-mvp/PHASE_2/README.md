# Grammar Stall Phase 2 - README

This folder contains the authoritative docs for the Grammar Stall Phase 2 rollout
(URE-only practice, XP/streak via URE, persistence, multi-level readiness, admin shell).

## Start Here (Required Reading)

1. `01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/LAUNCH_GUIDE.md`
2. `01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/PHASE_2_SPECIFICATION.md`
3. `01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/TECHNICAL_DESIGN.md`
4. `01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/DATA_SCHEMA.md`
5. `01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/LEAD_HANDOFF.md`
6. `01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/JLPT_LEVELS_GUIDE.md`
7. `01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/LEAD_PROMPTING_GUIDE.md`

## Additional Required Context (URE + XP)

- `01_PRODUCTION_DOCS/1-URE-Architecture/URE_XP_EXTENSION_GUIDE.md`
- `01_PRODUCTION_DOCS/1-URE-Architecture/URE_ARCHITECTURE_AND_MIGRATION_PLAN.md`
- `01_PRODUCTION_DOCS/1-URE-Architecture/PRODUCT_REQUIREMENTS_VS_ARCHITECTURE.md`

## Key Code Locations

- Grammar data: `public/data/grammar/`
  - Index: `public/data/grammar/n5-index.json`
  - Points: `public/data/grammar/points/n5/*.json`
  - Exercises: `public/data/grammar/exercises/n5/*.json`
  - Points map: `public/data/grammar/points-index.json`
  - Lite payloads: `public/data/grammar/exercises/n5/*.lite.json`
- Grammar service (server + client JSON read): `src/lib/grammar/grammarService.ts`
- Practice page (URE session wiring): `src/app/[locale]/learn/grammar/[pointId]/practice/page.tsx`
- URE adapters: `src/lib/review-engine/adapters/grammar.adapter.ts`, `src/lib/grammar/ureAdapter.ts`
- Progress manager: `src/lib/review-engine/progress/GrammarProgressManager.ts`
- Admin shell page: `src/app/[locale]/admin/grammar-stall/page.tsx`
- Learning Village integration: `src/components/dashboard/LearningVillage.tsx`
- Lite generator script: `scripts/grammar/generate-exercise-lite.js` (run via `npm run grammar:lite`)

## Build / Run / Lighthouse (Known Gotchas)

- Use **full clean builds** for prod testing to avoid stale chunks:
  - `npm run build:full`
  - `npm run start -- -p 4173`
- Lighthouse should be run against the **prod server**:
  - `http://localhost:4173/en/learn/grammar`
  - `http://localhost:4173/en/learn/grammar/{pointId}/practice`
- If you see `TypeError: Cannot read properties of undefined (reading 'call')` in prod,
  it is almost always a stale `.next` build. Run `npm run build:full` again.

## Service Worker Cache (Local Only)

The PWA service worker can serve stale assets during local testing.
If you hit blank pages or chunk errors:

1. DevTools -> Application -> Service Workers -> Unregister.
2. DevTools -> Application -> Storage -> Clear site data.
3. Hard refresh (Cmd/Ctrl-Shift-R).

## Release Bar (Phase 2)

- Grammar practice runs through URE only.
- XP + streak updates via URE event hub.
- Progress persists locally and in Firebase (free + premium).
- Multi-level scaffolding in place (N4+).
- Admin page uses existing auth pattern.
- Lighthouse run in prod mode.

**Last Updated**: 2026-01-17
