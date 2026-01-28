# Usage Tracking - Firebase Collections

## Overview
Tracks feature usage for rate limiting, quota enforcement, and analytics across all user tiers.

## Collections

### `usage` (Top-Level)

**Description:** Top-level collection tracking per-user feature usage with time-bucketed subcollections.

**Access:**
- ✅ All users (system-managed)
- 📍 Location: Top-level collection
- 🔄 Updated by: API routes with entitlement checks

**Document Structure:**

```typescript
// Document ID: userId

{
  // Feature usage counts (legacy format, being phased out)
  [featureId: string]: number         // e.g., "conjugation_drill_2025-10-03": 14

  // Metadata
  lastUpdated: Date                   // Last update timestamp
}
```

**Example Document:**
```json
{
  "conjugation_drill_2025-10-03": 14,
  "custom_lists_2025-10": 3,
  "flashcard_decks_2025-10": 5,
  "tts_synthesis_2025-10-03": 87,
  "ai_story_generation_2025-10": 2,
  "lastUpdated": "2025-10-03T14:54:14.413Z"
}
```

### `usage/{userId}/daily/{date}`

**Description:** Daily usage tracking subcollection (new bucket-based system).

**Document Structure:**
```typescript
// Document ID: YYYY-MM-DD

{
  [featureId: string]: number         // Usage count for this feature on this day

  // Examples:
  conjugation_drill: number
  tts_synthesis: number
  ai_story_generation: number
  kanji_review_add: number

  lastUpdated: Date
}
```

### `usage/{userId}/monthly/{month}`

**Description:** Monthly usage tracking subcollection.

**Document Structure:**
```typescript
// Document ID: YYYY-MM

{
  [featureId: string]: number         // Usage count for this feature this month

  // Examples:
  custom_lists: number
  flashcard_decks: number
  ai_story_generation: number

  lastUpdated: Date
}
```

**Firestore Path Examples:**
```
usage/8onZzlQg3tQxkw8pinSF9ow4Q6j2
usage/8onZzlQg3tQxkw8pinSF9ow4Q6j2/daily/2025-10-03
usage/8onZzlQg3tQxkw8pinSF9ow4Q6j2/monthly/2025-10
```

## Feature IDs

### Daily-Bucketed Features
- `conjugation_drill` - Conjugation drill sessions
- `tts_synthesis` - Text-to-speech API calls
- `kanji_review_add` - Adding kanji to review queue
- `ai_story_generation` - AI story generation (daily limit)

### Monthly-Bucketed Features
- `custom_lists` - Custom list creation
- `flashcard_decks` - Flashcard deck creation
- `ai_story_generation` - AI story generation (monthly limit)

### Legacy Date-Stamped Keys (being phased out)
- `conjugation_drill_YYYY-MM-DD`
- `custom_lists_YYYY-MM`

## Usage Limits by Tier

### Guest Users
- All features: 0 (must sign up)

### Free Users
- `conjugation_drill`: 3/day
- `custom_lists`: 3/month
- `flashcard_decks`: 3/month
- `tts_synthesis`: 50/day
- `kanji_review_add`: 10/day
- `ai_story_generation`: 0

### Premium Users (Monthly/Yearly)
- `conjugation_drill`: Unlimited
- `custom_lists`: Unlimited
- `flashcard_decks`: Unlimited
- `tts_synthesis`: Unlimited
- `kanji_review_add`: Unlimited
- `ai_story_generation`: 5/month

## API Endpoints

### GET `/api/usage/[featureId]`
Get current usage for a feature

**Response:**
```json
{
  "current": 14,
  "limit": 50,
  "remaining": 36,
  "resetAt": "2025-10-04T00:00:00.000Z",
  "bucket": "daily"
}
```

**File:** `/src/app/api/usage/[featureId]/route.ts`

### POST `/api/usage/[featureId]/increment`
Increment usage for a feature (with limit check)

**Request:**
```json
{
  "amount": 1
}
```

**Response:**
```json
{
  "success": true,
  "current": 15,
  "limit": 50,
  "remaining": 35
}
```

**File:** `/src/app/api/usage/[featureId]/increment/route.ts`

### GET `/api/usage/[featureId]/check`
Check if usage is within limits (no increment)

**Response:**
```json
{
  "allowed": true,
  "current": 14,
  "limit": 50,
  "remaining": 36,
  "reason": null
}
```

**File:** `/src/app/api/usage/[featureId]/check/route.ts`

## Entitlement Integration

Usage tracking integrates with the entitlement system:

**File:** `/src/lib/entitlements/evaluator.ts`

**Evaluation Flow:**
```typescript
const evalContext = {
  userId: string,
  plan: 'guest' | 'free' | 'premium_monthly' | 'premium_yearly',
  usage: { [featureId]: number },
  nowUtcISO: string
}

const decision = evaluate(featureId, evalContext)
// Returns: { allow: boolean, reason: string, limit: number, remaining: number }
```

## Bucket System

**Daily Buckets:**
- Format: `YYYY-MM-DD` (e.g., `2025-10-03`)
- Reset: Daily at 00:00 UTC
- Used for: High-frequency features (drills, TTS)

**Monthly Buckets:**
- Format: `YYYY-MM` (e.g., `2025-10`)
- Reset: Monthly on 1st at 00:00 UTC
- Used for: Resource-intensive features (AI, storage)

**Helper Function:**
```typescript
import { getBucketKey } from '@/lib/entitlements/policy'

const dailyKey = getBucketKey('daily', new Date())    // "2025-10-03"
const monthlyKey = getBucketKey('monthly', new Date()) // "2025-10"
```

## Write Patterns

### Pattern 1: Direct Increment (Legacy)
```typescript
const usageRef = adminDb.collection('usage').doc(userId)
await usageRef.set({
  [`conjugation_drill_${dateStr}`]: (currentUsage || 0) + 1,
  lastUpdated: new Date()
}, { merge: true })
```

### Pattern 2: Bucket-Based (Preferred)
```typescript
const bucketKey = getBucketKey('daily', new Date())
const usageRef = adminDb
  .collection('usage')
  .doc(userId)
  .collection('daily')
  .doc(bucketKey)

await usageRef.set({
  conjugation_drill: (currentUsage || 0) + 1,
  lastUpdated: new Date()
}, { merge: true })
```

### Pattern 3: Batch Update with Limit Check
```typescript
const evalDecision = evaluate(featureId, evalContext)

if (!evalDecision.allow) {
  return { error: 'Limit reached', limit: evalDecision.limit }
}

// Perform action
await performAction()

// Increment usage
await usageRef.set({
  [featureId]: (currentUsage || 0) + 1,
  lastUpdated: new Date()
}, { merge: true })
```

## Queries & Indexes

### Required Indexes
```
Collection: usage/{userId}/daily
- (No indexes needed - simple document reads by date)

Collection: usage/{userId}/monthly
- (No indexes needed - simple document reads by month)
```

### Query Examples

**Get today's usage:**
```javascript
const today = new Date().toISOString().split('T')[0]
const dailyUsage = await adminDb
  .collection('usage')
  .doc(userId)
  .collection('daily')
  .doc(today)
  .get()

const drillCount = dailyUsage.data()?.conjugation_drill || 0
```

**Get this month's usage:**
```javascript
const month = new Date().toISOString().slice(0, 7) // YYYY-MM
const monthlyUsage = await adminDb
  .collection('usage')
  .doc(userId)
  .collection('monthly')
  .doc(month)
  .get()

const listCount = monthlyUsage.data()?.custom_lists || 0
```

**Legacy format query:**
```javascript
const usageDoc = await adminDb
  .collection('usage')
  .doc(userId)
  .get()

const drillKey = `conjugation_drill_${dateStr}`
const drillCount = usageDoc.data()?.[drillKey] || 0
```

## Features Using Usage Tracking

### Drill Sessions
- **Feature ID:** `conjugation_drill`
- **Bucket:** Daily
- **Limits:** Free: 3/day, Premium: Unlimited
- **APIs:** `/api/drill/session/route.ts`

### Custom Lists
- **Feature ID:** `custom_lists`
- **Bucket:** Monthly
- **Limits:** Free: 3/month, Premium: Unlimited
- **APIs:** `/api/lists/route.ts`

### Flashcard Decks
- **Feature ID:** `flashcard_decks`
- **Bucket:** Monthly
- **Limits:** Free: 3/month, Premium: Unlimited
- **APIs:** `/api/flashcards/decks/route.ts`

### TTS Synthesis
- **Feature ID:** `tts_synthesis`
- **Bucket:** Daily
- **Limits:** Free: 50/day, Premium: Unlimited
- **APIs:** `/api/tts/synthesize/route.ts`

### Kanji Review Queue
- **Feature ID:** `kanji_review_add`
- **Bucket:** Daily
- **Limits:** Free: 10/day, Premium: Unlimited
- **APIs:** `/api/kanji/add-to-review/route.ts`

### AI Story Generation
- **Feature ID:** `ai_story_generation`
- **Bucket:** Monthly
- **Limits:** Free: 0, Premium: 5/month
- **APIs:** `/api/admin/generate-story/route.ts`

## Related Files

- Entitlement Evaluator: `/src/lib/entitlements/evaluator.ts`
- Policy Config: `/src/lib/entitlements/policy.ts`
- API Helper: `/src/lib/firebase/admin.ts` (getUserDailyUsage)
- Usage APIs: `/src/app/api/usage/[featureId]/`

## Analytics Use Cases

1. **Feature Adoption:** Track which features users engage with
2. **Tier Conversion:** Identify users hitting free limits
3. **Capacity Planning:** Monitor high-usage features
4. **Abuse Prevention:** Detect unusual usage patterns
5. **Pricing Optimization:** Analyze limit effectiveness

## Data Retention

- **Daily buckets:** Retained for 90 days
- **Monthly buckets:** Retained for 24 months
- **Legacy format:** Cleaned up periodically
- **Aggregated stats:** Kept indefinitely

## Privacy & Compliance

- Usage data is anonymous (just counts)
- No user content stored in usage docs
- Used solely for quota enforcement
- Included in user data export
- Automatically deleted on account deletion

## Performance Optimization

- **Document reads:** Cached in memory for 5 minutes
- **Batch writes:** Multiple increments batched together
- **Conditional updates:** Only write if limits not exceeded
- **Lazy creation:** Documents created on first use

## Migration Notes

**Legacy → Bucket-Based:**
- Old format: `featureId_YYYY-MM-DD` as top-level field
- New format: Nested subcollections (`daily/YYYY-MM-DD`, `monthly/YYYY-MM`)
- Both formats supported during transition
- Gradual migration to bucket-based system
