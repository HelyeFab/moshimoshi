# Agent B Implementation Summary

**Date:** 2026-03-25
**Agent:** B (Server/API and Firestore Logic)
**Status:** Complete

## Overview

Implemented atomic unlock-or-reuse access for Kanji Browser study with server-side entitlement checking and Firestore transaction logic.

## Changed Files

1. **Created:** `/src/app/api/kanji-browser/study/access/route.ts` (239 lines)
   - Complete server route implementation
   - Atomic transaction logic for unlock + usage increment
   - Premium/free/guest handling

## Route Details

### Route Path
```
POST /api/kanji-browser/study/access
```

### Request Shape
```typescript
{
  "kanji": "見"  // Single kanji character (required)
}
```

### Response Shape
```typescript
{
  allow: boolean;           // Can the user study this kanji? (always present)
  newlyUnlocked: boolean;   // true = just unlocked, false = reuse/already unlocked (always present)
  unlockedCount: number;    // Total kanji unlocked (always present)
  remaining: number;        // Remaining unlock slots, -1 = unlimited (always present)
  plan: string;             // User's plan (always present)
  reason?: string;          // Denial reason (present when allow=false)
  limit?: number;           // Plan limit (present when allow=false)
}
```

### Response Examples

**Premium user, first time unlocking:**
```json
{
  "allow": true,
  "newlyUnlocked": true,
  "unlockedCount": 1,
  "remaining": -1,
  "plan": "premium_monthly"
}
```

**Premium user, already unlocked (reuse):**
```json
{
  "allow": true,
  "newlyUnlocked": false,
  "unlockedCount": 5,
  "remaining": -1,
  "plan": "premium_monthly"
}
```

**Free user, already unlocked (reuse):**
```json
{
  "allow": true,
  "newlyUnlocked": false,
  "unlockedCount": 5,
  "remaining": 5,
  "plan": "free"
}
```

**Free user, new unlock (under cap):**
```json
{
  "allow": true,
  "newlyUnlocked": true,
  "unlockedCount": 6,
  "remaining": 4,
  "plan": "free"
}
```

**Free user, over cap:**
```json
{
  "allow": false,
  "newlyUnlocked": false,
  "unlockedCount": 10,
  "remaining": 0,
  "plan": "free",
  "reason": "limit_reached",
  "limit": 10
}
```

**Guest user:**
```json
{
  "allow": false,
  "newlyUnlocked": false,
  "unlockedCount": 0,
  "remaining": 0,
  "plan": "guest",
  "reason": "Authentication required"
}
```

## Firestore Document Shape

### Progress Document

**Path:** `users/{uid}/progress/kanji_browser_study`

**Fields:**
```typescript
{
  unlockedKanji: string[];    // Array of unlocked kanji characters
  unlockedCount: number;      // Count of unlocked kanji
  lastUnlockedAt: string;     // ISO 8601 timestamp of last unlock
  updatedAt: string;          // ISO 8601 timestamp of last update
}
```

**Example:**
```json
{
  "unlockedKanji": ["見", "聞", "話", "食", "飲"],
  "unlockedCount": 5,
  "lastUnlockedAt": "2026-03-25T10:30:45.123Z",
  "updatedAt": "2026-03-25T10:30:45.123Z"
}
```

### Usage Document

**Path:** `users/{uid}/usage/{bucketKey}`

**Bucket Key Format:** `kanji_browser_study_YYYY-MM` (monthly)

**Fields:**
```typescript
{
  kanji_browser_study: number;  // Usage count for the period
  updatedAt: string;            // ISO 8601 timestamp
  lastUpdated: string;          // ISO 8601 timestamp
}
```

**Example:**
```json
{
  "kanji_browser_study": 5,
  "updatedAt": "2026-03-25T10:30:45.123Z",
  "lastUpdated": "2026-03-25T10:30:45.123Z"
}
```

## Transaction Strategy

### Atomicity Guarantee

The implementation uses Firestore transactions to ensure that:
1. The kanji is added to the unlocked set
2. The usage counter is incremented
3. Both operations succeed or both fail

This prevents:
- Double-counting the same kanji
- Unlocking without consuming quota
- Consuming quota without unlocking

### Transaction Flow

```
1. Start transaction
2. Re-read progress doc (ensure consistency)
3. Re-read usage doc (ensure consistency)
4. Guard: check if kanji already unlocked (race condition)
5. If not unlocked:
   a. Add kanji to unlockedKanji array (arrayUnion)
   b. Increment unlockedCount
   c. Update timestamps
   d. Increment usage counter
6. Commit transaction
```

### Race Condition Handling

The transaction includes a double-check to prevent race conditions:
- If two requests try to unlock the same kanji simultaneously
- The second request will see the kanji is already unlocked
- No duplicate increment occurs

## Implementation Details

### Authentication
- Requires valid session (via `getSession()`)
- Guests receive 401 with appropriate message

### Plan Resolution
- Always reads fresh plan from Firestore `users/{uid}/subscription/plan`
- Never trusts session tier (as per entitlements best practices)
- Defaults to 'free' on error

### Premium Handling
- Premium users bypass entitlement check
- Still mark kanji as unlocked for history/analytics
- Return `remaining: -1` (unlimited)

### Already Unlocked
- No transaction needed
- No usage increment
- Instant allow response

### New Unlock Flow
1. Evaluate entitlement using existing `evaluate()` function
2. If denied → return denial with reason
3. If allowed → run transaction to atomically:
   - Add kanji to progress doc
   - Increment usage in monthly bucket

### Error Handling
- Malformed request: 400 Bad Request
- No auth: 401 Unauthorized
- Transaction failure: 500 Internal Server Error
- All errors logged to console with `[kanji-browser-study]` prefix

## Integration Points

### Used Libraries
- `@/lib/firebase/admin` - adminDb, FieldValue
- `@/lib/auth/session` - getSession
- `@/lib/entitlements/evaluator` - evaluate, getBucketKey
- `@/types/FeatureId` - FeatureId type

### External Dependencies
- Feature config already exists in `config/features.v1.json`
- Types already regenerated by Agent A
- Uses existing entitlement evaluator
- Uses existing session management

## Testing Verification

- [x] TypeScript compilation passes (`npm run type-check`)
- [x] Route structure correct (`/api/kanji-browser/study/access/route.ts`)
- [x] All imports resolve
- [x] Transaction logic uses proper Firestore patterns

## What Agent C (Client) Needs

Agent C should call this API before starting study:

```typescript
const response = await fetch('/api/kanji-browser/study/access', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ kanji: '見' })
});

const data = await response.json();

if (data.allow) {
  // Check if this was a new unlock
  if (data.newlyUnlocked) {
    // Optional: show celebration/feedback for new unlock
  }
  // Start study session
} else {
  // Show upgrade CTA or error message
  // data.reason, data.limit available for context
}
```

**Important:** All responses include `newlyUnlocked` (boolean):
- `newlyUnlocked: true` → Just unlocked this kanji
- `newlyUnlocked: false` → Already unlocked or premium reuse

Agent C can assume these fields are always present:
- `allow` (boolean)
- `newlyUnlocked` (boolean)
- `unlockedCount` (number)
- `remaining` (number, -1 = unlimited)
- `plan` (string)

For multi-kanji sessions, call the API for each new (not already unlocked) kanji in the selection before starting.

## Ownership Boundaries

**Agent B owns:**
- `/src/app/api/kanji-browser/study/access/route.ts`
- Progress document structure
- Transaction logic

**Agent B does NOT own:**
- Feature config (`config/features.v1.json`) - Agent A
- Client-side UI gating - Agent C
- Test implementation - Agent D
- Marketing copy - separate concern

## Design Decisions

### Why Monthly Limit Type?
- This is a catalog unlock cap, not a daily session limit
- Monthly is the closest semantic match in the existing system
- Allows free users to unlock up to 10 kanji per month
- Premium users effectively unlimited

### Why Separate Progress Doc?
- Keeps unlock state independent of usage tracking
- Allows fast membership checks (`unlockedKanji.includes(kanji)`)
- Simpler than one doc per kanji for small cap (10 for free)
- Scalable to premium users with many unlocks

### Why Transaction for New Unlocks?
- Prevents double-counting
- Ensures consistency between quota and unlock state
- Guards against race conditions

### Why No Transaction for Already Unlocked?
- No state mutation needed
- Faster response time
- Reduces Firestore read/write load

## Production Readiness

✅ **Complete:**
- Auth checking
- Plan resolution
- Entitlement evaluation
- Atomic transactions
- Error handling
- Logging
- Type safety

✅ **Follows Patterns:**
- Matches existing API structure (`/api/usage/[featureId]/increment`)
- Uses same Firebase patterns
- Consistent error responses
- Console logging with feature prefix

✅ **Quality:**
- TypeScript strict mode passes
- No linting errors
- Proper error codes (400, 401, 500)
- Race condition guards

## Next Steps

1. **Agent C**: Implement client-side gating in Kanji Browser UI
2. **Agent D**: Write integration tests for this API
3. **Deployment**: Route is ready to deploy (no additional config needed)
4. **Monitoring**: Add metrics for unlock rates if desired

---

**Implementation Status:** ✅ Complete and verified
