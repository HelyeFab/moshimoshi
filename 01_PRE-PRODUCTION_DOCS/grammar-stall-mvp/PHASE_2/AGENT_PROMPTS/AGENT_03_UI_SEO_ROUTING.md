# Agent 03 - UI/SEO/Routing for N4

## Mission
Expose N4 in the UI with parity to N5 and ensure metadata + sitemaps include N4 content.

## Must Read First (in order)
1. `01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/LEAD_HANDOFF.md`
2. `01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/PHASE_2_SPECIFICATION.md`
3. `01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/TECHNICAL_DESIGN.md`
4. `01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/DATA_SCHEMA.md`

## Required Code & Data Context
- `src/app/[locale]/learn/grammar/page.tsx`
- `src/app/[locale]/learn/grammar/[pointId]/page.tsx`
- `src/app/[locale]/learn/grammar/sitemap.ts`
- `src/components/grammar/GrammarPageClient.tsx`
- `src/components/grammar/GrammarPointDetail.tsx`
- `src/components/dashboard/LearningVillage.tsx`
- `public/data/grammar/points-index.json`
- `src/lib/grammar/grammarService.ts`

## Constraints (Do Not Violate)
- Preserve existing routes for N5.
- No new dependencies.
- Keep SSR/RSC safe patterns intact.
- Don’t change URE/XP logic.
- Use the existing i18n system for any new UI text; add translation keys for all supported locales.
- Preserve existing theme tokens and dark-mode styling patterns (no new visual language).

## Tasks
1. **Level selection & routing**
   - Add a level selector or routing strategy that surfaces N4 alongside N5.
   - Ensure point detail resolves level from `points-index.json` (no hardcoded N5).

2. **Metadata & SEO**
   - Update metadata to reflect N4 when applicable.
   - Extend sitemap to include N4 points.

3. **Dashboard**
   - Update Learning Village copy to not be N5-only.
   - Ensure new text is localized and theme-consistent.

## Deliverables
- N4 visible in grammar hub and point detail pages.
- SEO/sitemap updated for N4.
- Brief verification notes.

## Out of Scope
- Data normalization and exercises generation.
