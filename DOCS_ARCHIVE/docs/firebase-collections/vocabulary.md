# Vocabulary Feature - Firebase Collections

## Overview
The Vocabulary feature tracks search history for premium users, storing their vocabulary lookups and interactions.

## Collections

### `users/{userId}/searched_words`

**Description:** Subcollection storing vocabulary search history for premium users.

**Access:**
- ✅ Premium users only
- 📍 Location: Subcollection under user document
- 🔄 Synced from: Client-side localStorage (premium users)

**Document Structure:**

```typescript
{
  // Search details
  term: string                    // The search term (e.g., "食べる")
  timestamp: Timestamp            // When the search was performed
  resultCount: number             // Number of results found
  searchSource: 'wanikani' | 'jmdict'  // Which API was used

  // User context
  deviceType: 'mobile' | 'tablet' | 'desktop'  // Device type when searched
  userId: string                  // User ID (redundant but kept for queries)

  // Analytics
  clickedResults: string[]        // Array of words the user clicked on

  // Sync metadata
  syncedAt: Timestamp            // Server timestamp when synced
}
```

**Example Document:**
```json
{
  "term": "食べる",
  "timestamp": "2025-10-03T14:30:00Z",
  "resultCount": 5,
  "searchSource": "jmdict",
  "deviceType": "desktop",
  "userId": "abc123def456",
  "clickedResults": ["食べる", "食べ物"],
  "syncedAt": "2025-10-03T14:30:01Z"
}
```

**Firestore Path Example:**
```
users/abc123def456/searched_words/xyz789
```

## API Endpoints

### GET `/api/vocabulary/history`
- **Auth:** Required (JWT session)
- **Premium:** Required
- **Query Params:**
  - `limit` (optional): Number of items to return (default: 50)
- **Returns:** Array of search history entries

### POST `/api/vocabulary/history`
- **Auth:** Required (JWT session)
- **Premium:** Required
- **Body:**
  ```json
  {
    "entry": {
      "term": "string",
      "timestamp": "ISO Date",
      "resultCount": "number",
      "searchSource": "wanikani | jmdict",
      "deviceType": "mobile | tablet | desktop",
      "clickedResults": ["string"]
    }
  }
  ```

### DELETE `/api/vocabulary/history`
- **Auth:** Required (JWT session)
- **Premium:** Required
- **Action:** Clears all search history for the user

### PATCH `/api/vocabulary/history`
- **Auth:** Required (JWT session)
- **Premium:** Required
- **Body:**
  ```json
  {
    "entryId": "string",
    "clickedWord": "string"
  }
  ```
- **Action:** Adds clicked word to search entry's clickedResults array

## Storage Strategy

### Three-Tier Storage System

1. **Guest Users**
   - ❌ No storage
   - Search history not saved

2. **Free Users**
   - 💾 localStorage only
   - Limit: 20 items
   - Client-side only

3. **Premium Users**
   - 💾 localStorage (20 items)
   - ☁️ Firebase (50 items)
   - Synced with 1-second debounce
   - Merged on load (Firebase is authoritative)

## Manager Class

**File:** `/src/utils/vocabularyHistoryManager.ts`

**Key Methods:**
- `saveSearch()` - Save a new search (localStorage + Firebase for premium)
- `loadHistory()` - Load search history (merges localStorage + Firebase)
- `clearHistory()` - Clear all history (both sources)
- `trackResultClick()` - Track when user clicks a result (premium only)

## Queries & Indexes

### Required Indexes
```
Collection: users/{userId}/searched_words
- timestamp (desc)
```

### Query Examples

**Load recent searches:**
```javascript
adminDb
  .collection('users')
  .doc(userId)
  .collection('searched_words')
  .orderBy('timestamp', 'desc')
  .limit(50)
  .get()
```

**Clear user history:**
```javascript
const snapshot = await adminDb
  .collection('users')
  .doc(userId)
  .collection('searched_words')
  .get()

const batch = adminDb.batch()
snapshot.docs.forEach(doc => batch.delete(doc.ref))
await batch.commit()
```

## Related Files

- API Routes: `/src/app/api/vocabulary/history/route.ts`
- Manager: `/src/utils/vocabularyHistoryManager.ts`
- Page: `/src/app/vocabulary/page.tsx`
- Components:
  - `/src/app/vocabulary/components/VocabularySearch.tsx`
  - `/src/app/vocabulary/components/SearchHistory.tsx`
  - `/src/app/vocabulary/components/WordDetailsModal.tsx`

## Notes

- Search history is purely for user convenience and analytics
- Not used for core functionality (searches work without it)
- Premium-only feature to incentivize upgrades
- Debounced syncing prevents excessive writes to Firebase
- Local storage acts as cache and fallback
