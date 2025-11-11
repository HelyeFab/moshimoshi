# Flashcards - Firebase Collections

## Overview
User-created flashcard decks for spaced repetition learning with custom content.

## Collections

### `users/{userId}/flashcard_decks`

**Description:** User-specific flashcard decks with cards for custom learning content.

**Access:**
- ✅ Authenticated users (own decks only)
- 📍 Location: Subcollection under user document
- 🔄 Synced from: Flashcard management UI
- 💎 **Premium Feature:** Firebase sync (free users use IndexedDB only)

**Document Structure:**

```typescript
{
  // Deck metadata
  id: string                          // UUID v4
  userId: string                      // Owner's user ID
  name: string                        // Deck name (e.g., "Basic Japanese Greetings")
  description?: string                // Optional deck description

  // Visual customization
  emoji: string                       // Deck icon emoji (default: "📇")
  color: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error'
  coverImage?: string                 // Optional cover image URL

  // Deck settings
  settings: {
    cardsPerSession: number           // Cards per review session (default: 20)
    newCardsPerDay: number            // Max new cards per day (default: 10)
    reviewOrder: 'random' | 'sequential' | 'spaced'
    showHints: boolean                // Show hints during review
    autoPlayAudio: boolean            // Auto-play audio if available
  }

  // Statistics
  stats: {
    totalCards: number                // Total cards in deck
    newCards: number                  // Cards never reviewed
    learningCards: number             // Cards currently being learned
    reviewCards: number               // Cards in review phase
    masteredCards: number             // Mastered cards
    lastReviewedAt?: number           // Last review timestamp (ms)
  }

  // Timestamps
  createdAt: number                   // Timestamp (ms)
  updatedAt: number                   // Timestamp (ms)
}
```

**Example Document:**

```json
{
  "id": "deck-abc123-def456",
  "userId": "8onZzlQg3tQxkw8pinSF9ow4Q6j2",
  "name": "Basic Japanese Greetings",
  "description": "Essential greetings for everyday conversation",
  "emoji": "👋",
  "color": "primary",
  "settings": {
    "cardsPerSession": 20,
    "newCardsPerDay": 10,
    "reviewOrder": "spaced",
    "showHints": true,
    "autoPlayAudio": false
  },
  "stats": {
    "totalCards": 25,
    "newCards": 5,
    "learningCards": 8,
    "reviewCards": 10,
    "masteredCards": 2,
    "lastReviewedAt": 1696350000000
  },
  "createdAt": 1696340000000,
  "updatedAt": 1696350000000
}
```

**Firestore Path Example:**
```
users/8onZzlQg3tQxkw8pinSF9ow4Q6j2/flashcard_decks/deck-abc123-def456
```

---

### `users/{userId}/flashcard_decks/{deckId}/cards`

**Description:** Individual flashcards within a deck.

**Document Structure:**

```typescript
{
  // Card identification
  id: string                          // UUID v4
  deckId: string                      // Parent deck ID
  userId: string                      // Owner's user ID

  // Card content
  front: {
    text: string                      // Front side text
    image?: string                    // Optional image URL
    audio?: string                    // Optional audio URL
    furigana?: string                 // Optional furigana for Japanese
  }

  back: {
    text: string                      // Back side text/answer
    image?: string                    // Optional image URL
    audio?: string                    // Optional audio URL
    translation?: string              // Optional translation
    notes?: string                    // Additional notes
  }

  // Learning metadata
  type: 'recognition' | 'recall' | 'production'
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]                      // User-defined tags

  // SRS data (Spaced Repetition System)
  srs: {
    status: 'new' | 'learning' | 'review' | 'mastered'
    easeFactor: number                // SM-2 ease factor (1.3-2.5)
    interval: number                  // Current interval in days
    repetitions: number               // Successful repetition count
    lastReviewed?: number             // Last review timestamp (ms)
    nextReview?: number               // Next scheduled review (ms)
  }

  // Performance tracking
  performance: {
    reviewCount: number               // Total reviews
    correctCount: number              // Correct answers
    streak: number                    // Current correct streak
    averageResponseTime?: number      // Avg response time in ms
    lapses: number                    // Times card went back to learning
  }

  // Timestamps
  createdAt: number                   // Timestamp (ms)
  updatedAt: number                   // Timestamp (ms)
}
```

**Example Document:**

```json
{
  "id": "card-xyz789",
  "deckId": "deck-abc123-def456",
  "userId": "8onZzlQg3tQxkw8pinSF9ow4Q6j2",
  "front": {
    "text": "おはよう",
    "furigana": "おはよう",
    "audio": "/audio/ohayou.mp3"
  },
  "back": {
    "text": "Good morning",
    "translation": "Good morning (informal)",
    "notes": "Used until about 10 AM"
  },
  "type": "recognition",
  "difficulty": "easy",
  "tags": ["greetings", "informal", "n5"],
  "srs": {
    "status": "review",
    "easeFactor": 2.5,
    "interval": 7,
    "repetitions": 3,
    "lastReviewed": 1696340000000,
    "nextReview": 1696945600000
  },
  "performance": {
    "reviewCount": 5,
    "correctCount": 4,
    "streak": 3,
    "averageResponseTime": 2340,
    "lapses": 1
  },
  "createdAt": 1696340000000,
  "updatedAt": 1696350000000
}
```

**Firestore Path Example:**
```
users/8onZzlQg3tQxkw8pinSF9ow4Q6j2/flashcard_decks/deck-abc123/cards/card-xyz789
```

## Usage Limits

### Guest Users
- Cannot create decks (must sign in)

### Free Users
- **Limit:** 3 decks/month
- **Cards:** 50 cards per deck maximum
- **Storage:** IndexedDB only
- **Features:** Basic SRS, no audio

### Premium Users
- **Limit:** Unlimited decks
- **Cards:** Unlimited cards per deck
- **Storage:** IndexedDB + Firebase sync
- **Features:** Full SRS, audio, images, advanced stats

## API Endpoints

### GET `/api/flashcards/decks`
Get all decks for current user

**Auth:** Required

**Response:**
```json
{
  "decks": [
    {
      "id": "deck-abc123",
      "name": "Basic Japanese Greetings",
      "emoji": "👋",
      "stats": { "totalCards": 25, "newCards": 5 },
      "createdAt": 1696340000000
    }
  ],
  "storage": {
    "location": "firebase",
    "syncEnabled": true
  }
}
```

**File:** `/src/app/api/flashcards/decks/route.ts`

---

### POST `/api/flashcards/decks`
Create a new deck

**Auth:** Required

**Request:**
```json
{
  "name": "Basic Japanese Greetings",
  "description": "Essential greetings",
  "emoji": "👋",
  "color": "primary",
  "settings": {
    "cardsPerSession": 20,
    "newCardsPerDay": 10,
    "reviewOrder": "spaced"
  }
}
```

**Response:**
```json
{
  "deck": {
    "id": "deck-abc123",
    "name": "Basic Japanese Greetings",
    "stats": { "totalCards": 0 }
  },
  "usage": {
    "current": 4,
    "limit": "unlimited",
    "remaining": "unlimited"
  }
}
```

**Entitlement Check:**
- Evaluates `flashcard_decks` feature
- Monthly usage bucket
- Returns 429 if limit exceeded

**File:** `/src/app/api/flashcards/decks/route.ts`

---

### GET `/api/flashcards/decks/[id]`
Get specific deck with statistics

**Auth:** Required

**Response:**
```json
{
  "id": "deck-abc123",
  "name": "Basic Japanese Greetings",
  "description": "...",
  "emoji": "👋",
  "settings": {...},
  "stats": {...},
  "createdAt": 1696340000000,
  "updatedAt": 1696350000000
}
```

**File:** `/src/app/api/flashcards/decks/[id]/route.ts`

---

### PATCH `/api/flashcards/decks/[id]`
Update deck metadata

**Auth:** Required

**Request:**
```json
{
  "name": "Updated Deck Name",
  "settings": {
    "cardsPerSession": 30
  }
}
```

**File:** `/src/app/api/flashcards/decks/[id]/route.ts`

---

### DELETE `/api/flashcards/decks/[id]`
Delete deck and all its cards

**Auth:** Required

**Response:**
```json
{
  "success": true,
  "deletedCards": 25
}
```

**File:** `/src/app/api/flashcards/decks/[id]/route.ts`

---

### GET `/api/flashcards/decks/[id]/cards`
Get all cards in a deck

**Auth:** Required

**Query Params:**
- `status` - Filter by SRS status (new, learning, review, mastered)
- `limit` - Limit results (default: 100)

**Response:**
```json
{
  "cards": [
    {
      "id": "card-xyz789",
      "front": { "text": "おはよう" },
      "back": { "text": "Good morning" },
      "srs": {...},
      "performance": {...}
    }
  ],
  "total": 25,
  "filtered": 10
}
```

**File:** `/src/app/api/flashcards/decks/[id]/cards/route.ts`

---

### POST `/api/flashcards/decks/[id]/cards`
Add card to deck

**Auth:** Required

**Request:**
```json
{
  "front": {
    "text": "こんにちは",
    "furigana": "こんにちは"
  },
  "back": {
    "text": "Hello",
    "translation": "Hello (daytime)"
  },
  "type": "recognition",
  "difficulty": "easy",
  "tags": ["greetings", "n5"]
}
```

**Response:**
```json
{
  "card": {
    "id": "card-new123",
    "front": {...},
    "back": {...},
    "srs": {
      "status": "new",
      "easeFactor": 2.5,
      "interval": 0,
      "repetitions": 0
    }
  },
  "deckStats": {
    "totalCards": 26,
    "newCards": 6
  }
}
```

**File:** `/src/app/api/flashcards/decks/[id]/cards/route.ts`

---

### PATCH `/api/flashcards/decks/[id]/cards/[cardId]`
Update card (content or SRS data)

**Auth:** Required

**Request:**
```json
{
  "back": {
    "notes": "Updated notes"
  },
  "srs": {
    "status": "learning",
    "easeFactor": 2.3,
    "interval": 1,
    "repetitions": 1
  },
  "performance": {
    "reviewCount": 6,
    "correctCount": 5
  }
}
```

**File:** `/src/app/api/flashcards/decks/[id]/cards/route.ts`

---

### DELETE `/api/flashcards/decks/[id]/cards/[cardId]`
Delete specific card

**Auth:** Required

**Response:**
```json
{
  "success": true,
  "deckStats": {
    "totalCards": 24
  }
}
```

**File:** `/src/app/api/flashcards/decks/[id]/cards/route.ts`

## SRS (Spaced Repetition System)

Flashcards use the SM-2 algorithm (same as review engine):

**Initial State:**
- `status`: "new"
- `easeFactor`: 2.5
- `interval`: 0
- `repetitions`: 0

**Learning Steps:**
1. New card shown → First review
2. Correct: Move to "learning", interval = 1 day
3. Correct again: Move to "review", interval = 3 days
4. Each correct review: interval *= easeFactor
5. Mastered: interval ≥ 21 days

**On Incorrect Answer:**
- Reset to "learning" status
- Reduce easeFactor by 0.2 (min 1.3)
- Reset interval to 1 day
- Increment lapses counter

## Queries & Indexes

### Required Indexes
```
Collection: users/{userId}/flashcard_decks
- updatedAt (desc)
- stats.totalCards (desc)

Collection: users/{userId}/flashcard_decks/{deckId}/cards
- srs.status (asc), srs.nextReview (asc)
- srs.nextReview (asc)
- tags (array-contains), srs.status (asc)
```

### Query Examples

**Get all decks:**
```javascript
const decks = await adminDb
  .collection('users')
  .doc(userId)
  .collection('flashcard_decks')
  .orderBy('updatedAt', 'desc')
  .get()
```

**Get due cards for review:**
```javascript
const now = Date.now()
const dueCards = await adminDb
  .collection('users')
  .doc(userId)
  .collection('flashcard_decks')
  .doc(deckId)
  .collection('cards')
  .where('srs.nextReview', '<=', now)
  .where('srs.status', 'in', ['learning', 'review'])
  .limit(20)
  .get()
```

**Get new cards:**
```javascript
const newCards = await adminDb
  .collection('users')
  .doc(userId)
  .collection('flashcard_decks')
  .doc(deckId)
  .collection('cards')
  .where('srs.status', '==', 'new')
  .limit(10)
  .get()
```

**Get cards by tag:**
```javascript
const taggedCards = await adminDb
  .collection('users')
  .doc(userId)
  .collection('flashcard_decks')
  .doc(deckId)
  .collection('cards')
  .where('tags', 'array-contains', 'n5')
  .get()
```

## Related Collections

- **usage**: Monthly deck creation tracking
- **users/{userId}/progress**: Optional progress tracking
- **user_stats**: XP from flashcard reviews

## Related Files

- API Routes: `/src/app/api/flashcards/**`
- Types: `/src/types/flashcards.ts`
- SRS Algorithm: `/src/lib/review-engine/srs/algorithm.ts`
- Page: `/src/app/flashcards/page.tsx`

## Analytics Use Cases

1. **Engagement:** Reviews per day, deck usage
2. **Difficulty:** Cards with high lapse counts
3. **Retention:** Mastery rates per deck
4. **Conversion:** Free users hitting deck limit
5. **Content Quality:** High-performing decks

## Data Retention

- **Active decks:** Retained indefinitely
- **Inactive decks:** Flagged after 90 days no reviews
- **Deleted decks:** Soft delete for 30 days
- **Cards:** Deleted with parent deck
- **Export:** Included in user data download

## Privacy & Compliance

- Decks are private to user
- No sharing (future feature)
- GDPR export compliant
- Deleted on account deletion
- No personal info tracking

## Performance Optimization

- **Lazy loading:** Fetch cards on demand
- **Pagination:** 100 cards per page
- **Caching:** Deck stats cached 5 minutes
- **Batch operations:** Bulk card creation
- **Debounced sync:** 2-second debounce

## Future Enhancements

- [ ] Shared/community decks
- [ ] Import from Anki format
- [ ] Export to CSV/JSON
- [ ] Collaborative decks
- [ ] Auto-generated decks from lists
- [ ] Voice recording for audio
- [ ] Handwriting recognition
- [ ] Deck statistics dashboard
