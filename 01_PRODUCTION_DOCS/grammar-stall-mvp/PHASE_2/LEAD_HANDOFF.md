# Grammar Stall - Lead Handoff Guide (Phase 2)

This is the onboarding guide for the next Technical Lead.

---

## Required Reading (In Order)

1. `01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/README.md`
2. `01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/PHASE_2_SPECIFICATION.md`
3. `01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/TECHNICAL_DESIGN.md`
4. `01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/DATA_SCHEMA.md`
5. `01_PRODUCTION_DOCS/1-URE-Architecture/URE_XP_EXTENSION_GUIDE.md`
6. `01_PRODUCTION_DOCS/1-URE-Architecture/URE_ARCHITECTURE_AND_MIGRATION_PLAN.md`
7. `01_PRODUCTION_DOCS/1-URE-Architecture/PRODUCT_REQUIREMENTS_VS_ARCHITECTURE.md`

---

## What You Must Preserve

- Grammar practice runs **only** through URE sessions.
- XP + streak updates happen only via URE event hub.
- Progress persistence is **local + Firebase** for free + premium users.
- Multi-level readiness (N4+) must not break N5 behavior.
- Admin dashboard shell uses the **existing** admin auth pattern.

---

## Where to Inspect First

- Practice flow: `src/app/[locale]/learn/grammar/[pointId]/practice/page.tsx`
- URE adapter: `src/lib/review-engine/adapters/grammar.adapter.ts`
- URE helper: `src/lib/grammar/ureAdapter.ts`
- Progress manager: `src/lib/review-engine/progress/GrammarProgressManager.ts`
- Data loader: `src/lib/grammar/grammarService.ts`
- Points map: `public/data/grammar/points-index.json`
- Lite generator: `scripts/grammar/generate-exercise-lite.js`

---

## Release / QA (Known Gotchas)

- Production tests must use a **full clean build**:
  - `npm run build:full`
  - `npm run start -- -p 4173`
- Service Worker can cache stale chunks locally. If pages break:
  - Unregister SW + clear site data.

---

## Decision Rules

- If performance is poor in dev, **always** re-check in prod build before blocking.
- Reject changes that remove multi-level fallback logic.
- Reject any new XP paths outside URE.
- Require all schema additions to be mirrored across points, exercises, index, and map.

---

**Last Updated**: 2026-01-17
