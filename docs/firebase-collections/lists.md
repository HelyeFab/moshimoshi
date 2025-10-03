# Custom Lists - Firebase Collections

## Overview
User-created custom lists for organizing kanji, vocabulary, and other learning content.

## Collections

### `users/{userId}/lists`

**Description:** User-specific custom lists for personalized learning content organization.

**Access:**
- ✅ Authenticated users (own lists only)
- 📍 Location: Subcollection under user document
- 🔄 Synced from: List management UI
- 💎 **Premium Feature:** Firebase sync (free users use IndexedDB only)

**Document Structure:**

```typescript
{
  // List metadata
  id: string                          // UUID v4
  userId: string                      // Owner's user ID
  name: string                        // List name (e.g., "JLPT N5 Kanji")
  type: 'kanji' | 'vocabulary' | 'grammar' | 'mixed'

  // Visual customization
  emoji: string                       // List icon emoji (default: "📚")
  color: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error'

  // List items
  items: ListItem[]                   // Array of list items

  // Settings
  settings: {
    reviewEnabled: boolean            // Whether list can be reviewed
    sortOrder: 'dateAdded' | 'alphabetical' | 'custom'
  }

  // Timestamps
  createdAt: number                   // Timestamp (ms)
  updatedAt: number                   // Timestamp (ms)
}
```

**ListItem Structure:**
```typescript
interface ListItem {
  id: string                          // UUID v4
  content: string                     // The content (kanji character, word, etc.)
  type: 'kanji' | 'vocabulary' | 'grammar' | 'mixed'
  metadata: {
    // For kanji
    character?: string
    meaning?: string
    readings?: {
      on?: string[]
      kun?: string[]
    }
    grade?: string
    jlpt?: string

    // For vocabulary
    word?: string
    reading?: string
    translations?: string[]

    // Common fields
    notes?: string
    tags?: string[]
    addedAt: number                   // Timestamp (ms)
  }
}
```

**Example Document:**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "userId": "8onZzlQg3tQxkw8pinSF9ow4Q6j2",
  "name": "JLPT N5 Essential Kanji",
  "type": "kanji",
  "emoji": "🎯",
  "color": "primary",
  "items": [
    {
      "id": "item-1",
      "content": "日",
      "type": "kanji",
      "metadata": {
        "character": "日",
        "meaning": "day, sun",
        "readings": {
          "on": ["ニチ", "ジツ"],
          "kun": ["ひ", "び"]
        },
        "grade": "1",
        "jlpt": "N5",
        "addedAt": 1696350000000
      }
    },
    {
      "id": "item-2",
      "content": "本",
      "type": "kanji",
      "metadata": {
        "character": "本",
        "meaning": "book, origin",
        "readings": {
          "on": ["ホン"],
          "kun": ["もと"]
        },
        "grade": "1",
        "jlpt": "N5",
        "notes": "Remember: tree with roots!",
        "tags": ["essential", "beginner"],
        "addedAt": 1696350001000
      }
    }
  ],
  "settings": {
    "reviewEnabled": true,
    "sortOrder": "dateAdded"
  },
  "createdAt": 1696350000000,
  "updatedAt": 1696360000000
}
```

**Firestore Path Example:**
```
users/8onZzlQg3tQxkw8pinSF9ow4Q6j2/lists/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

## Default List Emojis

```typescript
const DEFAULT_LIST_EMOJIS = {
  kanji: '🔮',
  vocabulary: '📚',
  grammar: '📝',
  mixed: '🌟'
}
```

## Usage Limits

### Guest Users
- Cannot create lists (must sign in)

### Free Users
- **Limit:** 3 lists/month
- **Storage:** IndexedDB only (no Firebase sync)
- **Access:** Full CRUD on local lists

### Premium Users
- **Limit:** Unlimited
- **Storage:** IndexedDB + Firebase sync
- **Access:** Full CRUD with cloud backup

## API Endpoints

### GET `/api/lists`
Fetch all lists for current user

**Auth:** Required

**Response:**
```json
{
  "lists": [
    {
      "id": "a1b2c3d4-...",
      "name": "JLPT N5 Essential Kanji",
      "type": "kanji",
      "emoji": "🎯",
      "itemCount": 15,
      "createdAt": 1696350000000,
      "updatedAt": 1696360000000
    }
  ],
  "storage": {
    "location": "firebase" | "local" | "none",
    "syncEnabled": true
  }
}
```

**File:** `/src/app/api/lists/route.ts`

---

### POST `/api/lists`
Create a new list

**Auth:** Required

**Request:**
```json
{
  "name": "My Kanji List",
  "type": "kanji",
  "emoji": "🎯",
  "color": "primary",
  "firstItem": {
    "content": "日",
    "metadata": {
      "character": "日",
      "meaning": "day, sun",
      "readings": { "on": ["ニチ"], "kun": ["ひ"] }
    }
  }
}
```

**Response:**
```json
{
  "id": "a1b2c3d4-...",
  "name": "My Kanji List",
  "type": "kanji",
  "items": [...],
  "storage": {
    "location": "firebase",
    "syncEnabled": true
  },
  "usage": {
    "current": 4,
    "limit": "unlimited",
    "remaining": "unlimited"
  }
}
```

**Entitlement Check:**
- Evaluates `custom_lists` feature
- Monthly usage bucket
- Returns 429 if limit exceeded

**File:** `/src/app/api/lists/route.ts`

---

### GET `/api/lists/[listId]`
Get specific list details

**Auth:** Required

**Response:**
```json
{
  "id": "a1b2c3d4-...",
  "name": "JLPT N5 Essential Kanji",
  "type": "kanji",
  "emoji": "🎯",
  "items": [...],
  "settings": {...},
  "createdAt": 1696350000000,
  "updatedAt": 1696360000000
}
```

**File:** `/src/app/api/lists/[listId]/route.ts`

---

### PATCH `/api/lists/[listId]`
Update list metadata (name, emoji, color, settings)

**Auth:** Required

**Request:**
```json
{
  "name": "Updated List Name",
  "emoji": "🌟",
  "color": "accent",
  "settings": {
    "reviewEnabled": false
  }
}
```

**File:** `/src/app/api/lists/[listId]/route.ts`

---

### DELETE `/api/lists/[listId]`
Delete a list

**Auth:** Required

**Response:**
```json
{
  "success": true,
  "message": "List deleted"
}
```

**File:** `/src/app/api/lists/[listId]/route.ts`

---

### POST `/api/lists/[listId]/items`
Add item to list

**Auth:** Required

**Request:**
```json
{
  "content": "本",
  "type": "kanji",
  "metadata": {
    "character": "本",
    "meaning": "book, origin",
    "readings": { "on": ["ホン"], "kun": ["もと"] },
    "notes": "Remember: tree with roots!"
  }
}
```

**Response:**
```json
{
  "item": {
    "id": "item-xyz",
    "content": "本",
    "metadata": {...}
  },
  "listItemCount": 16
}
```

**File:** `/src/app/api/lists/[listId]/items/route.ts`

---

### DELETE `/api/lists/[listId]/items`
Remove item from list

**Auth:** Required

**Request:**
```json
{
  "itemId": "item-xyz"
}
```

**Response:**
```json
{
  "success": true,
  "remainingItems": 15
}
```

**File:** `/src/app/api/lists/[listId]/items/route.ts`

---

### POST `/api/lists/sync`
Sync local lists to Firebase (premium only)

**Auth:** Required (Premium)

**Request:**
```json
{
  "lists": [
    { "id": "...", "name": "...", "items": [...] }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "synced": 3,
  "conflicts": []
}
```

**File:** `/src/app/api/lists/sync/route.ts`

## Storage Decision Logic

```typescript
// From: /src/lib/api/storage-helper.ts

const decision = await getStorageDecision(session)

if (decision.plan === 'guest') {
  // No storage
  return { storage: { location: 'none' } }
}

if (!decision.shouldWriteToFirebase) {
  // Free users: local only
  return { storage: { location: 'local' } }
}

// Premium users: Firebase + local
await saveToFirebase(list)
return { storage: { location: 'firebase', syncEnabled: true } }
```

## Queries & Indexes

### Required Indexes
```
Collection: users/{userId}/lists
- type (asc), updatedAt (desc)
- settings.reviewEnabled (asc), updatedAt (desc)
```

### Query Examples

**Get all lists for user:**
```javascript
const listsRef = adminDb
  .collection('users')
  .doc(userId)
  .collection('lists')

const snapshot = await listsRef
  .orderBy('updatedAt', 'desc')
  .get()
```

**Get kanji lists only:**
```javascript
const kanjiLists = await adminDb
  .collection('users')
  .doc(userId)
  .collection('lists')
  .where('type', '==', 'kanji')
  .orderBy('updatedAt', 'desc')
  .get()
```

**Get review-enabled lists:**
```javascript
const reviewLists = await adminDb
  .collection('users')
  .doc(userId)
  .collection('lists')
  .where('settings.reviewEnabled', '==', true)
  .get()
```

**Count user's lists:**
```javascript
const count = await adminDb
  .collection('users')
  .doc(userId)
  .collection('lists')
  .count()
  .get()

const listCount = count.data().count
```

## Integration with Review System

Lists can be used as sources for review sessions:

```typescript
// Get items from list for review
const list = await getList(listId)
const reviewableItems = list.items.map(item => ({
  id: item.id,
  content: item.content,
  type: item.type,
  metadata: item.metadata
}))

// Create review session from list
await createReviewSession({
  source: 'custom_list',
  listId: list.id,
  items: reviewableItems
})
```

## Related Collections

- **usage**: Monthly list creation tracking
- **users/{userId}/progress**: Learning progress for list items
- **users/{userId}/review_sessions**: Review sessions from lists

## Related Files

- API Routes: `/src/app/api/lists/**`
- Types: `/src/types/userLists.ts`
- Storage Helper: `/src/lib/api/storage-helper.ts`
- Entitlements: `/src/lib/entitlements/evaluator.ts`
- Page: `/src/app/lists/page.tsx`

## Client-Side Storage

### IndexedDB Schema
```typescript
interface IndexedDBList {
  id: string
  userId: string
  name: string
  type: string
  emoji: string
  color: string
  items: ListItem[]
  settings: object
  createdAt: number
  updatedAt: number
  syncedAt?: number                   // Last Firebase sync timestamp
  localOnly: boolean                  // True for free users
}
```

### Sync Strategy
1. **Create:** Save to IndexedDB first
2. **Check tier:** If premium, sync to Firebase
3. **Update:** Update IndexedDB, queue for Firebase sync
4. **Delete:** Remove from IndexedDB, delete from Firebase
5. **Conflict:** Last-write-wins based on `updatedAt`

## Analytics Use Cases

1. **Popular List Types:** Track kanji vs. vocabulary vs. grammar
2. **List Sizes:** Average items per list
3. **Engagement:** Lists with `reviewEnabled = true`
4. **Conversion:** Free users hitting 3-list limit
5. **Retention:** Active lists vs. abandoned lists

## Data Retention

- **Active lists:** Retained indefinitely
- **Deleted lists:** Soft delete for 30 days, then permanent
- **Orphaned items:** Cleaned up with parent list
- **Export:** Included in user data download

## Privacy & Compliance

- Lists are private to user
- No sharing between users (future feature)
- Included in GDPR export
- Deleted on account deletion
- No personal info (just learning content)

## Performance Optimization

- **Lazy loading:** Fetch items on demand
- **Pagination:** For large lists (100+ items)
- **Caching:** Client-side cache for 5 minutes
- **Batch operations:** Add/remove multiple items
- **Debounced sync:** 2-second debounce for updates

## Future Enhancements

- [ ] List sharing between users
- [ ] Public/community lists
- [ ] List templates
- [ ] Import/export formats (CSV, JSON)
- [ ] Collaborative lists
- [ ] List statistics dashboard
- [ ] Auto-generated lists (JLPT N5, etc.)
