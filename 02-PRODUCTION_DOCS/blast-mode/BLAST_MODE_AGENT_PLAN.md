# Blast Mode Agent Plan (4-Way Split)

**Status:** DRAFT
**Last Updated:** 2026-01-29
**Owner:** Tech Lead

---

## Overview

This plan decomposes Blast Mode implementation into four parallel agent tracks. Each agent has a clearly scoped area with deliverables, interfaces, and handoff artifacts to minimize coupling.

---

## Agent A — Core Flow + Routing

**Scope**
- New Blast Mode entry + learn routes.
- Session shell UI and screen orchestration.
- Step runner (advance, skip, back, completion).
- Event Hub completion emission.

**Primary Files (expected)**
- `src/app/[locale]/tools/blast-mode/page.tsx`
- `src/app/[locale]/tools/blast-mode/learn/page.tsx`
- `src/app/[locale]/tools/blast-mode/learn/BlastSession.tsx`
- `src/app/[locale]/tools/blast-mode/learn/BlastStepRenderer.tsx`

**Deliverables**
- Working navigation from entry → session.
- Step runner that consumes `BlastStep[]` and renders screens.
- Completion handler that emits `ReviewEventType.SESSION_COMPLETED`.

**Handoff Artifacts**
- Step runner API: `renderStep(step: BlastStep)` contract.
- `BlastSession` expects `steps` + `items` from Agent B.

---

## Agent B — Data Model + Step Generator

**Scope**
- Define `BlastItem` + `BlastStep` types.
- Build step generator with adaptive rules.
- Adapter layer for kanji/vocab/list items (minimal v1: kanji + vocab).

**Primary Files (expected)**
- `src/lib/blast-mode/types.ts`
- `src/lib/blast-mode/step-generator.ts`
- `src/lib/blast-mode/adapters/kanji.adapter.ts`
- `src/lib/blast-mode/adapters/vocab.adapter.ts`

**Deliverables**
- Deterministic step generation for kanji/vocab.
- Adaptive skipping logic per item.
- Unit tests for step generation.

**Handoff Artifacts**
- `generateBlastSteps(items: BlastItem[]): BlastStep[]`.
- `BlastItem[]` payload shape consumed by Agent A.

---

## Agent C — Distractors + Tiles

**Scope**
- Distractor selection strategies for JP and EN MCQs.
- Reading distractors (onyomi/kunyomi).
- Tile splitting: morpheme → kana chunk → kanji order.

**Primary Files (expected)**
- `src/lib/blast-mode/distractors.ts`
- `src/lib/blast-mode/tile-splitter.ts`
- `src/lib/blast-mode/phonetics.ts`

**Deliverables**
- `buildMcqOptions()` for meaning/JP/reading screens.
- `splitIntoTiles()` with fallbacks and tests.

**Handoff Artifacts**
- Option builders consumed by Agent B step generator.
- Tile splitter consumed by Agent B step generator.

---

## Agent D — UI Components (Screens)

**Scope**
- Individual screen components for the 6 step types.
- MCQ UI (no typing).
- Tile reassembly UI (drag/click).

**Primary Files (expected)**
- `src/components/blast-mode/screens/MeaningToJpMcq.tsx`
- `src/components/blast-mode/screens/JpReassemble.tsx`
- `src/components/blast-mode/screens/OnyomiMcq.tsx`
- `src/components/blast-mode/screens/KunyomiMcq.tsx`
- `src/components/blast-mode/screens/OtherReadingMcq.tsx`
- `src/components/blast-mode/screens/JpToMeaningMcq.tsx`

**Deliverables**
- Consistent styling + feedback states.
- Accessibility: keyboard navigation for MCQ + tiles.

**Handoff Artifacts**
- `BlastStepRenderer` mapping (Agent A) references these components.

---

## Integration Milestones

1) **M1 — Core wiring**: Agent A has route + runner + stub steps.
2) **M2 — Data + steps**: Agent B provides real step list.
3) **M3 — UI + logic**: Agent D connects screens to runner.
4) **M4 — Quality**: Agent C feeds distractors/tiles into step gen.

---

## Detailed Prompts for Each Agent

### Prompt for Agent A (Core Flow + Routing)
```
You are Agent A implementing Blast Mode core flow. Create new routes for Blast Mode entry and learn session. Implement BlastSession that:
- Accepts BlastItem[] and BlastStep[] props
- Orchestrates step progression, skipping, and completion
- Emits ReviewEventType.SESSION_COMPLETED on finish
Use existing patterns from kanji-mastery and review-engine, but keep Blast Mode separate. Provide a simple placeholder step renderer if components are not ready. Ensure no typing anywhere.
Deliver: route files + BlastSession + BlastStepRenderer.
```

### Prompt for Agent B (Data Model + Step Generator)
```
You are Agent B implementing Blast Mode data model + step generator. Create BlastItem and BlastStep types under src/lib/blast-mode. Implement generateBlastSteps(items) that builds the 6-step sequence per item and applies adaptive skips (missing readings, kana-only, etc.). Provide adapters for kanji and vocab to normalize into BlastItem. Avoid UI work; focus on deterministic logic and add unit tests. Expose a clean API for Agent A.
```

### Prompt for Agent C (Distractors + Tiles)
```
You are Agent C implementing distractor and tile logic for Blast Mode. Build:
- Reading distractors (onyomi/kunyomi) with phonetic neighbors
- Meaning distractors (EN) using same POS and similar length
- Japanese distractors (JP) using same length/kanji/kana pattern
- Tile splitter with morpheme > kana chunk > kanji order fallback
Create pure utility functions with tests. Provide APIs used by Agent B step generator.
```

### Prompt for Agent D (UI Screens)
```
You are Agent D implementing Blast Mode UI screens (MCQ + tiles). Build screen components for all step types with consistent layout, clear feedback, and keyboard navigation. Use no typing; only option selection and tile reassembly. Expose props that allow Agent A's step renderer to plug in. Keep styles consistent with existing app patterns (buttons, cards).
```

