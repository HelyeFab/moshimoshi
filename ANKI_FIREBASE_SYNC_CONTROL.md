# Anki Import Firebase Sync Control

## Overview

Anki deck imports now support a **feature flag** to control whether decks sync to Firebase or stay local-only in IndexedDB.

**Default**: Firebase sync is **DISABLED** for cost and scalability reasons.

## Current Configuration

```json
// config/features.v1.json
{
  "id": "anki_imports",
  "metadata": {
    "enableFirebaseSync": false,  // ← Controls Firebase sync
    "syncMode": "local-only"
  }
}
```

## Why Local-Only by Default?

### Problem
- Large Anki decks (1000+ cards) exceed Firestore's 1 MB document limit
- User's 4,152-card deck = 3.5 MB of text data
- Firebase costs at scale:
  - 100 users × 500 MB avg = $118/month
  - Not sustainable for premium pricing

### Solution
- Store Anki imports in IndexedDB only (local-only)
- IndexedDB limits: ~60% of disk space (essentially unlimited)
- Zero Firebase costs
- Users can re-import from .apkg file if needed

## Storage Comparison

| Storage | Limit | Cost | Cross-Device Sync |
|---------|-------|------|-------------------|
| **IndexedDB** (current) | ~60% disk space | $0 | ❌ No |
| **Firestore** | 1 MB per doc | $1-100+/month | ✅ Yes |

## How It Works

### Code Flow

1. **User imports .apkg file**
2. **Parser extracts cards** (`parser.ts`)
3. **AnkiDeckManager checks flag** (`AnkiDeckManager.ts:208-209`):
   ```typescript
   const enableFirebaseSync = ankiImportsFeature?.metadata?.enableFirebaseSync === true
   ```
4. **If disabled**: Save to IndexedDB only
5. **If enabled**: Attempt Firebase sync (may fail for large decks)

### Console Logs

**When disabled** (current):
```
[AnkiDeckManager] ✅ Firebase sync is DISABLED - saving to IndexedDB only
[AnkiDeckManager] 💡 This enables unlimited deck sizes without cloud storage costs
[AnkiDeckManager] 💡 To enable Firebase sync, set enableFirebaseSync: true in config/features.v1.json
```

**When enabled**:
```
[AnkiDeckManager] Firebase sync is ENABLED for Anki imports
[AnkiDeckManager] Premium user - saving to Firebase
```

## How to Re-Enable Firebase Sync (If Needed)

### Option 1: Simple Toggle (Not Recommended)

**File**: `config/features.v1.json`

```diff
{
  "id": "anki_imports",
  "metadata": {
-   "enableFirebaseSync": false,
+   "enableFirebaseSync": true,
-   "syncMode": "local-only"
+   "syncMode": "firebase"
  }
}
```

**Limitations**:
- Large decks (>1000 cards) will fail
- Costs increase significantly
- Firestore 1 MB limit still applies

### Option 2: Hybrid Approach (Better)

Store deck metadata in Firestore, cards in IndexedDB:

**Benefits**:
- Deck list syncs across devices
- Cards stay local (no size limits)
- Lower costs

**Implementation** (requires code changes):
```typescript
// Save only metadata to Firebase
const deckMetadata = {
  id: deck.id,
  name: deck.name,
  cardCount: deck.cards.length,
  createdAt: now,
  updatedAt: now
  // NO cards array!
}
```

### Option 3: Chunked Storage (Most Flexible)

Split large decks into chunks:

**Benefits**:
- Works around 1 MB limit
- Full sync support
- Manageable costs

**Implementation** (requires code changes):
```typescript
// Split cards into 500-card chunks
const chunks = chunkArray(deck.cards, 500)
const deckDoc = { metadata, chunkCount: chunks.length }
chunks.forEach((chunk, i) => {
  firestore.collection('flashcardDecks').doc(deckId)
    .collection('cardChunks').doc(`chunk-${i}`).set({ cards: chunk })
})
```

## Testing

### Test Local-Only Storage

1. Import large .apkg file (1000+ cards)
2. Check console logs:
   ```
   [AnkiDeckManager] ✅ Firebase sync is DISABLED
   ```
3. Verify deck appears in UI
4. Check IndexedDB in DevTools → Application → Storage → IndexedDB

### Test Firebase Sync (If Re-Enabled)

1. Set `enableFirebaseSync: true`
2. Import small deck (<500 cards)
3. Check console logs:
   ```
   [AnkiDeckManager] Firebase sync is ENABLED
   [AnkiDeckManager] Deck saved to Firebase: xxx
   ```
4. Verify deck in Firestore console

## Files Modified

1. **config/features.v1.json**
   - Added `enableFirebaseSync: false` flag
   - Added `syncMode: "local-only"`
   - Added description

2. **src/lib/anki/AnkiDeckManager.ts**
   - Import features config (line 14)
   - Check flag before Firebase sync (lines 207-213)
   - Log messages for clarity (lines 260-266)

3. **src/lib/anki/parser.ts**
   - Fixed anki21 uncompressed detection (lines 240-308)
   - Removed strict error throwing

## Rollback Instructions

To completely revert to always-sync behavior:

```diff
// AnkiDeckManager.ts
- const enableFirebaseSync = ankiImportsFeature?.metadata?.enableFirebaseSync === true
- if (enableFirebaseSync && isPremium && userId !== 'guest') {
+ if (isPremium && userId !== 'guest') {
```

And remove the feature flag from config.

## Cost Projection (If Sync Re-Enabled)

| Users | Storage Cost | Bandwidth Cost | Total/Month |
|-------|--------------|----------------|-------------|
| 10    | $0.00        | $8.40          | $8.43       |
| 100   | $1.14        | $116.40        | $118.25     |
| 1000  | $12.57       | $1196.40       | $1216.70    |

At $10/month premium, 100 users = $1000 revenue, $118 goes to Firebase (12%).

## Recommendations

1. **Keep sync disabled** for Anki imports
2. **Enable sync only** for native flashcards created in-app
3. **Consider hybrid approach** if cross-device sync is critical
4. **Monitor costs** if sync is re-enabled

## Questions?

See:
- `/scripts/calculate-scaling-costs.js` - Cost projections
- `/scripts/check-firebase-storage-usage.js` - Current usage
- `/scripts/firebase-storage-limits-info.md` - Firebase limits

---

Last Updated: 2025-01-06
Status: Firebase sync DISABLED (local-only storage)
