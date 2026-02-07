# Flashcards Mastery Widget (Streak-Based)

**Status:** Draft  
**Last Updated:** 2026-02-07  
**Owner:** Codex (Senior TypeScript Engineer)

## Goal
Implement a dashboard widget that mirrors the “Flashcards mastery — measured by its streak” design:
- Top summary counters (Mastered / Good / To confirm / Bad).
- A 7‑day stacked area chart showing card counts by streak bucket (Streak 1, Streak 2, Streak 3+).
- “Last 7 days” trend view with a clear legend.

This widget should live in the Flashcards dashboard (likely `StatsDashboard`) and reuse existing charting patterns in the app.

---

## Current State (What Exists)

### Data Model
`FlashcardContent.metadata` already includes card-level streak fields:
- `streak` (current correct-answer streak)
- `bestStreak`
- `status` (`new | learning | review | mastered`)
- `reviewCount`, `correctCount`, `lapses`, etc.

See: `src/types/flashcards.ts`, `src/lib/flashcards/SRSHelper.ts`.

### No Daily Streak Time Series
We do **not** currently store daily aggregates of streak buckets.  
No `streak1 / streak2 / streak3plus` snapshots exist in IndexedDB or Firestore.

### Dashboard UI
`StatsDashboard` shows summary cards and sections, but no charts.  
See: `src/components/flashcards/StatsDashboard.tsx`.

### Charting Library (Existing)
We already use **Recharts** elsewhere in the app:
- `src/components/dashboard/LearningVelocity.tsx`
- `src/components/admin/charts/AdminCharts.tsx`

We should reuse Recharts for visual consistency and to avoid adding new dependencies.

---

## Streak Definition (Chosen)

Use the **existing card-level streak** from SRS metadata:

**Definition:**  
`card.metadata.streak` = consecutive correct reviews for that card.  
This is a common, non-awkward streak definition used across learning apps and already maintained by the SRS system (`FlashcardSRSHelper.updateCardAfterReview`).

**Bucket mapping for the chart:**
- Streak 1: `streak === 1`
- Streak 2: `streak === 2`
- Streak 3+: `streak >= 3`

**Total line** = sum of all streak buckets.

---

## Data Model Needed (New)

We need a **daily snapshot** to render the “Last 7 days” chart:

```ts
export interface FlashcardStreakSnapshot {
  date: string; // YYYY-MM-DD (local)
  streak1: number;
  streak2: number;
  streak3plus: number;
  total: number;
  updatedAt: number; // epoch ms
}
```

Where stored:
- **Local:** IndexedDB (new store under Flashcards DB).
- **Premium:** Firestore (optional sync).

---

## Aggregation Pipeline (Preferred)

User preference: **compute on page load and don’t worry about historical backfill**.

### Proposed flow
1. On Flashcards page load, compute snapshot for **today** from current deck cards.
2. Save snapshot to local IndexedDB if today’s snapshot doesn’t exist or is stale.
3. For premium users, optionally sync snapshot to Firestore (latest wins).

### Notes
- This yields “last 7 days” only if we stored snapshots for those days in the past.
- For now, we only ensure **today** is present (no backfill).
- If the user doesn’t visit daily, the 7‑day chart will have gaps. That’s acceptable per current scope.

---

## Summary Counters (Top Row)

We need a clear mapping from card metadata to the 4 categories:

**Proposed mapping (uses existing fields):**
- **Mastered**: `status === 'mastered'`
- **Good**: `status === 'review'` AND `streak >= 3`
- **To confirm**: `status === 'learning'` OR (`status === 'review'` AND `streak === 1`)
- **Bad**: `lapses >= 2` OR (`status === 'review'` AND `streak === 0`)

This mapping is consistent with typical SRS apps:
- “Mastered” = graduated cards.
- “Good” = reliably correct in review.
- “To confirm” = still stabilizing.
- “Bad” = repeated failures/lapses.

If product wants different semantics, this can be adjusted without changing the snapshot model.

---

## UI Placement

Add a **new widget** inside `StatsDashboard`:
- Top row: summary counters.
- Main body: stacked area chart (Recharts `AreaChart`).
- Legend at bottom: Streak 1 / Streak 2 / Streak 3+.

Proposed component file:
- `src/components/flashcards/FlashcardMasteryWidget.tsx`

Integration:
- Render inside the “Stats” view in `StatsDashboard`.
- Use existing layout patterns (cards, rounded panels, light/dark theme styling).

---

## Storage + Sync (Draft)

### IndexedDB
Add a new store in Flashcards DB:
- Store name: `flashcardStreakSnapshots`
- Key: `date` (string `YYYY-MM-DD`)
- Value: `FlashcardStreakSnapshot`

### Firestore (Premium)
Collection: `users/{uid}/flashcardStreakSnapshots/{date}`
- Use `updatedAt` for LWW merge.
- No deletes required initially.

---

## Open Questions (Non-Blocking)
1. Do we want to backfill any historical data, or strictly track forward?
2. Should the “To confirm” bucket include `status === 'new'`?
3. Should “Bad” be stricter (e.g. `lapses >= 3`)?
4. Should the chart roll up **all decks** or allow deck-level filtering?

---

## Implementation Checklist (Future)
1. Add new snapshot type in `src/types/flashcards.ts`.
2. Add IndexedDB store (FlashcardDB) + helper methods.
3. Compute today’s snapshot on Flashcards page load (in `FlashcardsContent`).
4. Optional: sync snapshots for premium via new API route.
5. Build `FlashcardMasteryWidget` using Recharts.
6. Add i18n strings for labels.

