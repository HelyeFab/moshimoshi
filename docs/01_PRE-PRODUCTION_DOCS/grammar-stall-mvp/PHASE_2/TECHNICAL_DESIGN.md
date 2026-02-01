# Grammar Stall Phase 2 Technical Design

**Project**: Moshimoshi Grammar Stall
**Phase**: 2 (URE + XP + Persistence)
**Version**: 1.0.0
**Last Updated**: 2026-01-17

---

## Architecture Overview

### Target Architecture (Phase 2)

```
┌──────────────────────────────────────────────────────────────────┐
│                       Grammar UI (React)                         │
│  - Practice page uses ReviewSessionUI / URE session              │
└───────────────┬──────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────┐
│                 URE SessionManager + Event Hub                   │
│  - SessionManager (src/lib/review-engine/session/manager.ts)     │
│  - Event Hub (src/lib/review-engine/core/event-hub.ts)           │
└───────────────┬──────────────────────────────────────────────────┘
                │ emits SESSION_COMPLETED
                ▼
┌──────────────────────────────────────────────────────────────────┐
│          Gamification Coordinator (server-side)                  │
│  - Awards XP + updates streak                                    │
│  - Source of truth: Firestore                                    │
└───────────────┬──────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────┐
│         Persistence: Local + Firebase (free + premium)           │
│  - Local: IndexedDB or LocalSessionStorage                        │
│  - Cloud: Firestore user progress                                │
└──────────────────────────────────────────────────────────────────┘
```

---

## URE Integration Details

### ContentType and Adapter
- Define a URE contentType: `grammar`.
- Create an adapter that maps grammar exercises into ReviewableContent.
- The adapter should include:
  - `content.id` (unique per exercise)
  - `contentType: 'grammar'`
  - `prompt` and `answer` values
  - `metadata` with grammarPointId, exerciseId, exerciseType, level

### Session Flow
- Grammar practice starts a URE session using SessionManager.
- Event Hub must be initialized before any session (same pattern as other URE features).
- On session complete, XP is awarded via the gamification coordinator.

### XP and Streaks
- XP must be awarded through existing URE completion events.
- Streaks should be updated via the Gamification Coordinator (server-side).
- Reference patterns:
  - `src/lib/gamification/services/gamification-coordinator.ts`
  - `src/lib/review-engine/core/event-hub.ts`
  - `01_PRODUCTION_DOCS/1-URE-Architecture/URE_XP_EXTENSION_GUIDE.md`

---

## Persistence Design

### Local Storage
- Use existing URE storage implementations where possible.
- Grammar sessions should persist locally for offline use.

### Firebase
- Store per-user grammar progress in Firestore.
- Must support free and premium users equally.
- Sync should be idempotent and resilient to offline conditions.

### Guest Behavior
- Guests store progress locally only.
- When authenticated, sync local progress to Firebase.

---

## Admin Dashboard (Grammar Content)

### New Admin Page
- Create a new admin dashboard page for grammar content management.
- Admin auth must follow existing admin page patterns.

### Auth Pattern Requirement
Use the exact same admin check flow as current admin pages.
Reference patterns:
- `src/app/[locale]/admin/firebase-monitoring/page.tsx` (403 handling + redirect)
- `src/app/[locale]/admin/entitlements/page.tsx` (auth + fetch pattern)

---

## Multi-Level Expansion

### Requirement
Grammar data must support multiple levels (N5, N4, N3, N2, N1).

### Recommended Layout
```
/public/data/grammar/
  n5-index.json
  n4-index.json
  n3-index.json
  n2-index.json
  n1-index.json
  points/
    n5/
      001-x-wa-y-desu.json
      ...
    n4/
      ...
  exercises/
    n5/
      001-x-wa-y-desu.json
      ...
    n4/
      ...
```

### Notes
- UI should load by level without breaking existing routes.
- Grammar URLs remain stable; a level selector can be added later.

---

## Accessibility (Minimum)
- Keyboard navigation for exercise choices.
- Focus indicators on interactive elements.
- ARIA labels for exercise inputs and submit buttons.

---

## Non-Goals
- Analytics
- Performance optimization

