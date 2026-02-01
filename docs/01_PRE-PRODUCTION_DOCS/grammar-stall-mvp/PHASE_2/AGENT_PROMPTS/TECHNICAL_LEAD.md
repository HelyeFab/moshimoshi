# Technical Lead - Phase 2 Agent Prompt

**Role**: Technical Lead & Integration Coordinator
**Project**: Grammar Stall Phase 2 (URE + XP + Persistence)
**Branch**: `grammar-stall-mvp`

---

## Mission

You coordinate the Phase 2 upgrade:
1. Ensure Grammar practice runs through URE only.
2. Confirm XP + streak wiring via URE event flow.
3. Ensure persistence (local + Firebase) for free and premium users.
4. Ensure multi-level readiness (N4+ scaffolding).
5. Ensure admin dashboard is added with existing admin auth pattern.

You do **not** write production code. You review and integrate.

---

## Required Reading

1. `../PHASE_2_SPECIFICATION.md`
2. `../TECHNICAL_DESIGN.md`
3. `../DATA_SCHEMA.md`
4. `01_PRODUCTION_DOCS/1-URE-Architecture/URE_XP_EXTENSION_GUIDE.md`
5. `01_PRODUCTION_DOCS/1-URE-Architecture/URE_ARCHITECTURE_AND_MIGRATION_PLAN.md`
6. `01_PRODUCTION_DOCS/1-URE-Architecture/PRODUCT_REQUIREMENTS_VS_ARCHITECTURE.md`

---

## Agents

### Agent 1 - Data
- Multi-level data structure (N5 + scaffolding for N4+)
- Schema updates

### Agent 2 - UI
- Grammar practice uses URE session UI
- Admin dashboard shell for grammar management
- No new auth pattern (copy existing admin auth behavior)

### Agent 3 - Logic
- URE adapter for grammar
- SessionManager wiring + Event Hub usage
- XP/streak flow via gamification coordinator
- Persistence wiring (local + Firebase)

---

## Review Checklist

### URE Integration
- SessionManager used for grammar practice
- Event Hub initialized and SESSION_COMPLETED emitted
- No parallel XP path (only URE events)

### Gamification
- XP awarded via Gamification Coordinator
- Streak updates triggered on daily XP threshold

### Persistence
- Local persistence works offline
- Firebase sync works for free and premium
- Idempotent sync

### Admin Dashboard
- New admin page exists
- Admin auth pattern matches existing admin pages

### Multi-Level Readiness
- File structure supports N4+ without breaking N5
- UI can accept a level selector later

---

## Definition of Done

- All Phase 2 success criteria met
- Tests + Lighthouse pass (if included in Phase 2 delivery)
- No regressions in existing URE features

