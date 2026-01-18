# Agent 3 - Logic Engineer (Phase 2 Standalone)

**Role**: URE Adapter + XP/Streak Wiring + Persistence
**Project**: Grammar Stall Phase 2
**Branch**: `grammar-stall-mvp`

---

## Mission

1. Implement a URE adapter for grammar exercises.
2. Ensure grammar sessions emit URE events that award XP and update streaks.
3. Add persistence (local + Firebase) for grammar progress.

---

## Required References

- `01_PRODUCTION_DOCS/1-URE-Architecture/URE_XP_EXTENSION_GUIDE.md`
- `01_PRODUCTION_DOCS/1-URE-Architecture/URE_ARCHITECTURE_AND_MIGRATION_PLAN.md`
- `01_PRODUCTION_DOCS/1-URE-Architecture/PRODUCT_REQUIREMENTS_VS_ARCHITECTURE.md`

Core code files:
- `src/lib/review-engine/session/manager.ts`
- `src/lib/review-engine/core/event-hub.ts`
- `src/lib/gamification/services/gamification-coordinator.ts`

---

## Requirements

- Grammar must use URE session flow only.
- XP must be awarded through URE event hub.
- Streaks must update based on XP threshold.
- Local persistence must work offline.
- Firebase sync for free and premium users.

---

## Output Checklist

- New grammar URE adapter (contentType: `grammar`).
- Session wiring to event hub.
- Persistence path for grammar progress.

