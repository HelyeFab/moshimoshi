# Agent 01 - Data Normalization & Mapping (N4)

## Mission
Normalize N4 grammar data to match N5 runtime shape and wire the level mapping used by the UI and practice flows.

## Must Read First (in order)
1. `01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/LEAD_HANDOFF.md`
2. `01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/PHASE_2_SPECIFICATION.md`
3. `01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/TECHNICAL_DESIGN.md`
4. `01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/DATA_SCHEMA.md`

## Required Code & Data Context
- `src/lib/grammar/grammarService.ts`
- `public/data/grammar/n4-index.gpt.json`
- `public/data/grammar/n4-index.json`
- `public/data/grammar/points/n4-gpt/`
- `public/data/grammar/points/n5/`
- `public/data/grammar/points-index.json`
- `src/app/[locale]/learn/grammar/[pointId]/practice/page.tsx`
- `src/components/grammar/RelatedPoints.tsx`

## Constraints (Do Not Violate)
- Do not change auth or admin patterns.
- Preserve URE-only practice flow; no new XP paths.
- Keep backwards compatibility for existing N5 IDs and routes.
- No new dependencies.

## Tasks
1. **Normalize N4 file layout**
   - Ensure runtime paths match: `public/data/grammar/n4-index.json` and `public/data/grammar/points/n4/*.json`.
   - If needed, move/copy from `n4-index.gpt.json` and `points/n4-gpt/`.

2. **Fix relatedPoints references for N4**
   - `relatedPoints` must be IDs (not titles) so `/points/{level}/{id}.json` fetch works.
   - Update N4 points accordingly.

3. **Update points-level map**
   - Add every N4 point ID to `public/data/grammar/points-index.json` with value `"n4"`.

4. **Provide a short verification note**
   - Describe how you verified the mapping for 2-3 sample points.

## Deliverables
- Updated data files and mappings.
- Brief summary of changes and any assumptions.

## Out of Scope
- Exercise generation.
- UI/SEO changes.
- Any URE logic changes.
