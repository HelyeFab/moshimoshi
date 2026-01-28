# Agent 2 - UI Engineer (Phase 2 Standalone)

**Role**: URE UI Integration + Admin Dashboard Shell
**Project**: Grammar Stall Phase 2
**Branch**: `grammar-stall-mvp`

---

## Mission

1. Replace the Grammar practice flow with URE session UI (ReviewSessionUI or equivalent URE pattern).
2. Create a grammar admin dashboard page using the exact same admin auth pattern as existing admin pages.

---

## Requirements

- Do NOT create a new auth pattern. Copy the pattern from existing admin pages.
- Grammar practice must run through URE sessions (no parallel exercise engine).
- Keep locale-aware routing and existing grammar UI as much as possible.
- Keep accessibility baseline (keyboard nav, visible focus).

---

## References (Auth Pattern)

Use one of these as the pattern to follow:
- `src/app/[locale]/admin/firebase-monitoring/page.tsx`
- `src/app/[locale]/admin/entitlements/page.tsx`

---

## Expected Files

- Grammar practice page: `/src/app/[locale]/learn/grammar/[pointId]/practice/page.tsx`
- Admin page: `/src/app/[locale]/admin/grammar-stall/page.tsx` (or similar)

---

## Done Criteria

- Grammar practice uses URE sessions and awards XP via event flow.
- Admin grammar dashboard exists and is gated like other admin pages.

