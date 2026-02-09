# DeckMarket MVP — Agent Playbook

**Tech Lead decisions are final. Agents execute, you guide.**

---

## Execution Order

```
Wave 1 (parallel — no dependencies):
  ├── Agent 1: Types
  ├── Agent 2: i18n
  └── Agent 3: Firestore rules

Wave 2 (parallel — depends on Wave 1):
  ├── Agent 4: Admin API routes
  └── Agent 5: Public API routes

Wave 3 (parallel — depends on Wave 2):
  ├── Agent 6: Admin UI pages
  └── Agent 7: User UI pages + Flashcards link

Wave 4 (sequential):
  └── Agent 8: Build + integration review
```

---

## Wave 1 — Foundation

### Agent 1: TypeScript Types

**Creates:** `src/types/deckmarket.ts`

---

### Agent 2: i18n Strings

**Modifies:** All 6 locale files in `src/i18n/locales/*/strings.ts`

---

### Agent 3: Firestore Security Rules

**Modifies:** `firestore.rules`

---

## Wave 2 — Backend API

### Agent 4: Admin API Routes

**Creates 4 files** under `src/app/api/admin/deckmarket/`

---

### Agent 5: Public API Routes

**Creates 4 files** under `src/app/api/deckmarket/`

---

## Wave 3 — Frontend UI

### Agent 6: Admin UI

**Creates 3 pages** + sidebar entry

---

### Agent 7: User UI

**Creates 2 pages** + Flashcards page link

---

## Wave 4 — Integration

### Agent 8: Build & Review

Run `npm run build`, fix issues, verify against spec.
