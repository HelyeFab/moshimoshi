# XP Farming Prevention

**Status**: OPEN - Not yet implemented
**Last Updated**: 2025-12-19
**Priority**: Medium

## Problem Statement

Users can earn unlimited XP by repeatedly studying/reviewing the same content multiple times in the same day. There is no mechanism to prevent this "farming" behavior.

### Example Exploit
1. User selects 5 hiragana characters
2. Completes study session → earns ~15 XP
3. Starts new study session with same 5 characters → NEW sessionId generated → earns ~15 XP again
4. Repeat 20 times → 300 XP in minutes

## Current State Analysis

### SessionId Generation
Each session generates a unique ID using timestamp + random suffix:

```typescript
// Study sessions
const sessionId = `study_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
// Example: "study_1734567890123_x7f9k2m1a"

// Review sessions
const sessionId = `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
// Example: "review_1734567890456_p3q8w5n2b"

// Drill sessions
const sessionId = `drill_${userId}_${Date.now()}`
// Example: "drill_8onZzlQg3tQxkw8pinSF9ow4Q6j2_1734567890789"
```

### What Currently Exists

| Protection | Status | Notes |
|------------|--------|-------|
| Daily XP Cap | Configured (500-5000) | Not strictly enforced at record time |
| Per-Session XP Caps | Yes | Flashcards: 500, Drills: 75 |
| Streak Guard | Yes | Only one streak update per day |
| Session Replay Prevention | **NO** | Same sessionId could theoretically be submitted twice |
| Content Deduplication | **NO** | Same content can earn XP unlimited times |

### XP Flow
```
User Action → SESSION_COMPLETED event → gamificationListener →
POST /api/review/session/complete → gamification-coordinator →
Firebase user_stats update
```

Key file: `src/lib/gamification/services/gamification-coordinator.ts`

## Solutions Considered

### Option 1: Session Idempotency Check (REJECTED)

**Approach**: Track sessionIds that have already been awarded XP.

```typescript
// In user_stats
xp: {
  completedSessionIds: {
    "study_123": "2025-12-19T10:30:00Z",
    "review_456": "2025-12-19T11:45:00Z"
  }
}
```

**Why Rejected**: Only prevents exact session replay (network retries). Does NOT prevent farming because each new session gets a unique sessionId.

### Option 2: Content-Based Daily Limits (RECOMMENDED)

**Approach**: Track which specific content items have been reviewed today.

```typescript
// In user_stats
xp: {
  reviewedItemsToday: {
    "2025-12-19": {
      "hiragana_a": { count: 3, lastXpAt: "2025-12-19T10:30:00Z" },
      "hiragana_ka": { count: 2, lastXpAt: "2025-12-19T11:00:00Z" }
    }
  }
}
```

**Rules**:
- First review of item X today: Full XP
- Second review: 50% XP (or 0)
- Third+: 0 XP

**Pros**: Truly prevents farming specific content
**Cons**: Requires tracking every item ID, more complex implementation

### Option 3: Content Hash Deduplication

**Approach**: Hash the set of content IDs reviewed in a session.

```typescript
const contentHash = hashContentIds(["a", "ka", "ki", "ku", "ke"])
// Check if this exact combination was reviewed today
```

**Pros**: Prevents exact same content set from earning XP twice
**Cons**: Changing one item bypasses the check

### Option 4: Daily Session Limits Per Content Type

**Approach**: Limit XP-earning sessions per content type per day.

```typescript
// Config
{
  "kana_study": { maxSessionsPerDay: 5 },
  "kanji_review": { maxSessionsPerDay: 10 },
  "vocabulary_study": { maxSessionsPerDay: 5 }
}
```

**Pros**: Simple to implement
**Cons**: Arbitrary limits may frustrate legitimate users

### Option 5: Diminishing Returns

**Approach**: XP decreases with each session of the same type per day.

```typescript
// Session 1: 100% XP
// Session 2: 75% XP
// Session 3: 50% XP
// Session 4: 25% XP
// Session 5+: 10% XP (minimum)
```

**Pros**: Doesn't block users, just reduces incentive
**Cons**: May still allow significant farming

## Recommended Implementation

**Option 2 (Content-Based Daily Limits)** is recommended as it:
1. Directly addresses the farming vector
2. Allows legitimate varied study
3. Is transparent to users ("You've already earned XP for this item today")

### Implementation Steps

1. **Add daily review tracking to user_stats**
   ```typescript
   'xp.reviewedItemsToday': {
     [today]: {
       [itemId]: { xpAwarded: true, timestamp: ISO }
     }
   }
   ```

2. **Modify SESSION_COMPLETED payload** to include content IDs
   ```typescript
   {
     sessionId: "...",
     statistics: { ... },
     contentIds: ["a", "ka", "ki"] // NEW
   }
   ```

3. **Update gamification-coordinator** to check/track items
   - Filter out already-reviewed items
   - Calculate XP only for new items
   - Update reviewedItemsToday

4. **Add cleanup job** to clear reviewedItemsToday at midnight (or use date-keyed structure that self-expires)

### Files to Modify

- `src/lib/gamification/services/gamification-coordinator.ts` - Add item tracking
- `src/lib/gamification/gamificationListener.ts` - Pass content IDs
- `src/lib/review-engine/session/manager.ts` - Include content IDs in event
- `src/components/learn/KanaLearningComponent.tsx` - Include content IDs in study event

## Risk Assessment

| Factor | Without Fix | With Fix |
|--------|-------------|----------|
| XP Farming Possible | HIGH | LOW |
| Implementation Complexity | N/A | MEDIUM |
| Breaking Changes | N/A | LOW |
| User Experience Impact | N/A | MINIMAL |

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-19 | Documented issue | Analysis complete |
| 2025-12-19 | Rejected session-only approach | Doesn't prevent real farming |
| 2025-12-19 | Recommended content-based approach | Deferred for future sprint |

## References

- `src/lib/gamification/services/gamification-coordinator.ts` - XP calculation
- `src/app/api/review/session/complete/route.ts` - API endpoint
- `src/lib/gamification/gamificationListener.ts` - Event listener
- `01_PRODUCTION_DOCS/1-URE-Architecture/XP_ACTIVITIES.md` - XP formulas
