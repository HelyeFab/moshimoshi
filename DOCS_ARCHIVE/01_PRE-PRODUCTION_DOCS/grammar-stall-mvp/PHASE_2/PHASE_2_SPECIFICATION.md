# Grammar Stall Phase 2 Specification

**Project**: Moshimoshi Grammar Stall
**Phase**: 2 (URE + XP + Persistence)
**Version**: 1.0.0
**Status**: Planning
**Last Updated**: 2026-01-17

---

## Executive Summary

Phase 2 upgrades Grammar Stall from a standalone MVP to a first-class URE feature.
Grammar practice must run through the Universal Review Engine only, award XP, and count toward streaks.
Progress must persist locally and in Firebase for free and premium users.
We will not pursue analytics or performance optimization in this phase.

---

## Core Requirements

### 1) URE-Only Grammar Practice
- Grammar exercises must be delivered as URE sessions (no parallel practice engine).
- XP awards must flow through the URE event hub and the gamification coordinator.
- Streaks must increment when daily XP threshold is met.

### 2) XP + Streak Integration (Required)
- Follow the URE XP integration patterns described in:
  - `01_PRODUCTION_DOCS/1-URE-Architecture/URE_XP_EXTENSION_GUIDE.md`
  - `01_PRODUCTION_DOCS/1-URE-Architecture/URE_ARCHITECTURE_AND_MIGRATION_PLAN.md`
  - `01_PRODUCTION_DOCS/1-URE-Architecture/PRODUCT_REQUIREMENTS_VS_ARCHITECTURE.md`
- Use the existing event hub:
  - `src/lib/review-engine/core/event-hub.ts`
- XP must count toward streak (same policy as flashcards and news).

### 3) Persistence (Local + Firebase)
- Persist progress locally for offline use.
- Sync progress to Firebase for authenticated users (free + premium).
- Guest/offline users rely on local storage with graceful upgrade to Firebase when authenticated.

### 4) Multi-Level Ready (Future-Expandable)
- Add a clean path to support N4/N3/N2/N1.
- Structure should be simple to extend without rewriting the grammar UI or URE wiring.
- This phase focuses on scaffolding and schema; content expansion can be future work.

### 5) Admin Dashboard (Required)
- Add a new admin dashboard page for grammar content management.
- Admin auth MUST follow the exact pattern of existing admin pages (no new auth flow).
- Reference a known admin page and copy the auth behavior.

### 6) Accessibility (Minimum)
- Ensure keyboard navigation and basic ARIA labels in practice UI and session flows.
- No advanced accessibility work required in this phase.

---

## Non-Goals (Explicitly Out of Scope)

- Analytics and usage reporting.
- Performance optimization beyond the normal URE usage.
- New UX polish or major layout redesign.

---

## URE Integration Pattern (Required)

### URE Components
- Session lifecycle: `src/lib/review-engine/session/manager.ts`
- Event hub: `src/lib/review-engine/core/event-hub.ts`
- Gamification: `src/lib/gamification/services/gamification-coordinator.ts`

### Expected Flow
1. Grammar session starts via URE SessionManager.
2. Session events emit through Event Hub.
3. Gamification listener awards XP + updates streak.
4. Results stored in Firebase and local persistence.

### Product Requirement Note
When architecture conflicts with product behavior, product requirements win.
See: `01_PRODUCTION_DOCS/1-URE-Architecture/PRODUCT_REQUIREMENTS_VS_ARCHITECTURE.md`.

---

## Data Scope

- Existing N5 data remains supported.
- Schema must allow additional levels without breaking current UI.
- Prefer new per-level indices over a monolithic index to keep build times manageable.

---

## Success Criteria

- Grammar practice uses URE only.
- XP rewards are awarded via URE event flow and count toward streak.
- Local + Firebase persistence works for free and premium users.
- Admin dashboard exists with correct admin auth behavior.
- Code is ready to add N4+ levels without redesign.

---

## Open Decisions

- Final mapping of grammar exercises to URE item types.
- Naming of URE contentType for grammar (suggested: `grammar`).

