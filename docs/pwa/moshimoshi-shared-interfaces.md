# 🤝 Shared Interfaces & Contracts — moshimoshi PWA

This document defines the **interfaces and contracts** that all three agents must respect.  
It ensures independent work streams can integrate seamlessly.

---

## 1. Entitlements API (read-only for Agents 1 & 2)

Determines if a feature is enabled for the current user tier (guest, free, premium).

```ts
type FeatureId =
  | 'push'
  | 'bgSync'
  | 'periodicSync'
  | 'shareTarget'
  | 'fsAccess'
  | 'badging'
  | 'mediaSession';

export function can(feature: FeatureId): boolean;
```

- **Agent 1** uses to decide if SW should register advanced APIs.  
- **Agent 2** uses to enable/disable UI toggles.  
- **Agent 3** enforces premium-only sync features.

---

## 2. IndexedDB Wrapper (Agent 3 provides; 1 & 2 consume)

Typed async wrapper for free-tier storage. Exposed at `/lib/idb/client.ts`.

```ts
export interface ListsApi {
  addList(input: {
    title: string;
    type: 'words' | 'sentences' | 'verbs' | 'adjectives';
  }): Promise<string>;

  addItems(
    listId: string,
    items: Array<{ payload: any; tags?: string[] }>
  ): Promise<void>;

  getDueItems(limit?: number): Promise<Array<any>>;
  getDueCount(): Promise<number>;
}
```

- **Agent 1** never writes here.  
- **Agent 2** consumes for badge counts, list creation.  
- **Agent 3** owns implementation and sync.  

---

## 3. Sync Outbox API (Agent 3)

Used to queue operations when offline. Background Sync will retry.

```ts
export function queueOp(op: {
  type: string;
  payload: any;
}): Promise<void>;
```

- **Agent 1** doesn’t touch this.  
- **Agent 2** may call `queueOp` indirectly (e.g., when saving via Share Target).  
- **Agent 3** owns retry + Firebase integration.  

---

## 4. Events for Badging (Agent 3 emits; Agent 2 consumes)

`dueCountChanged` is dispatched whenever the review count changes.

```ts
// Agent 3 emits
document.dispatchEvent(
  new CustomEvent('dueCountChanged', { detail: { count } })
);

// Agent 2 listens
document.addEventListener('dueCountChanged', (e) => {
  const count = (e as CustomEvent).detail.count;
  updateBadge(count);
});
```

---

## 5. Firebase Sync Protocol (Agent 3)

- **Idempotency:** all ops carry `opId`. Server ignores duplicates.  
- **Conflict policy:**  
  - Streaks/settings → Last Write Wins (server timestamp).  
  - Lists/items → merge.  
  - Review history → append.  

**Payload example:**

```json
{
  "opId": "uuid-123",
  "type": "addItem",
  "payload": {
    "listId": "list-1",
    "item": { "id": "item-9", "payload": "日本語" }
  },
  "createdAt": 1732659200000
}
```

---

## 6. Notifications Contracts (Agent 2 ↔ Agent 3)

- **Agent 2** manages UI + permission.  
- **Agent 3** ensures only valid tokens are synced with backend.  

**Token record schema:**

```ts
type PushToken = {
  id: string;         // deviceId
  userId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: number;
};
```

---

## 7. Testing Expectations

- **TypeScript strict mode** must pass across all modules.  
- **Integration tests** will mock entitlements + IDB wrapper.  
- **Contract changes** require all agents to update docs.  

---

✅ With this contract in place, each agent can work independently while staying aligned.
