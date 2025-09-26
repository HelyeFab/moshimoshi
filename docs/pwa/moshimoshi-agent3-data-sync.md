# 🧩 Agent 3 — Data & Sync

**Owner:** IndexedDB, Outbox, Background/Periodic Sync, Firebase

## Deliverables
- Typed IndexedDB wrapper + stores
- Outbox queue + Background Sync handler (pending writes only)
- Firebase sync (login/logout triggers, explicit “Sync now”)
- Periodic Sync (premium only) for daily reminder checks
- Conflict policy docs (LWW/merge/append)

## Acceptance Tests
- Network loss → writes queued; reconnect → syncs
- Login with existing cloud data → merges correctly
- Periodic sync does not run without explicit user opt-in
- Deleting account clears local stores
