# Agent 6: Precision Review Report

**Date:** 2026-03-24
**Agent:** Testing & Rollout (Agent 6)
**Review Type:** Precision alignment with actual codebase contracts

---

## Executive Summary

The initial v1.0 deliverables invented contracts and assumed infrastructure that doesn't exist. This report documents all corrections made in v2.0 to align with actual implementation.

**Status:** ✅ **ALL CORRECTIONS COMPLETE** - Documents now grounded in reality

---

## Files Updated

| File | Status | Changes |
|------|--------|---------|
| `vocabularyKanjiTestUtils.ts` | ✅ Revised | Rewrote to use real contracts from `kanji-study.ts` |
| `TEST_STRATEGY.md` | ✅ Revised | Distinguished current/proposed, corrected session model |
| `ROLLOUT_STRATEGY.md` | ✅ Revised | Grounded in actual feature flag systems |
| `AGENT_6_SUMMARY.md` | ✅ Revised | Documented all corrections and mapping to contracts |
| `QA_CHECKLIST.md` | ✅ No changes | Was already accurate |
| `TEST_TEMPLATES.md` | ℹ️ Not revised | Original templates still useful as patterns |

---

## Category 1: Test Utilities Corrections

### Issue: Invented Card/Session Contracts

**v1.0 Problem:**
```typescript
// INVENTED - Not from kanji-study.ts
interface VocabularyCard {
  parentKanjiId: string   // ❌ Not in real contract
  order: number           // ❌ Not in real contract
}

interface VocabularyStudySession {
  cards: VocabularyCard[]      // ❌ Flat array (wrong)
  currentCardIndex: number     // ❌ Global index (wrong)
}
```

**v2.0 Fix:**
```typescript
// IMPORTED - From src/types/kanji-study.ts
import type {
  KanjiStudySessionState,      // ✅ Real contract
  StudySessionKanjiItem,        // ✅ Real contract
  KanjiStudyCard,               // ✅ Union type
  MeaningCard,                  // ✅ Real card type
  VocabularyCard,               // ✅ Real card type
  ReadingSummaryCard,           // ✅ Real card type
} from '@/types/kanji-study'

// Nested structure (correct)
session.kanji[kanjiIndex].cards[cardIndex]
```

**What was corrected:**
- ✅ Removed `parentKanjiId` (not in contract)
- ✅ Removed `order` field (not in contract)
- ✅ Removed flat `cards[]` array (wrong architecture)
- ✅ Removed `pattern-hint` card type (it's a field, not a type)
- ✅ Added imports from `@/types/kanji-study`
- ✅ Use nested structure: `kanji[].cards[]`

---

### Issue: Invented Helper Functions

**v1.0 Problem:**
```typescript
// INVENTED - Not checking if these exist
class VocabKanjiTestHelpers {
  static advanceSession(session, steps) { ... }  // ❌ Custom logic
  static isSessionComplete(session) { ... }      // ❌ Custom logic
}
```

**v2.0 Fix:**
```typescript
// USE REAL HELPERS - From src/types/kanji-study.ts
import {
  advanceToNextCard,     // ✅ Real helper (line 281)
  goToPreviousCard,      // ✅ Real helper (line 332)
  getSessionPosition,    // ✅ Real helper (line 244)
  isLegacySession,       // ✅ Real type guard (line 182)
  isCurrentSession,      // ✅ Real type guard (line 197)
} from '@/types/kanji-study'

// Tests use REAL functions
const updated = advanceToNextCard(session)  // ✅ Not custom
```

**What was corrected:**
- ✅ Removed custom `advanceSession()` (use `advanceToNextCard()`)
- ✅ Removed custom `isSessionComplete()` (use `getSessionPosition().isSessionComplete`)
- ✅ Added imports of all real helper functions

---

## Category 2: Test Strategy Corrections

### Issue: Assumed Session Upgrade Logic

**v1.0 Problem:**
```typescript
// ASSUMED - Legacy sessions are upgraded
it('should upgrade old session format', () => {
  const legacy = createLegacySession()
  const upgraded = migrateSession(legacy)  // ❌ Doesn't exist
  expect(upgraded.version).toBe(1)
})
```

**v2.0 Fix:**
```typescript
// ACTUAL BEHAVIOR - Legacy sessions are CLEARED
it('should CLEAR legacy sessions, not upgrade them', () => {
  const legacy = VocabKanjiFixtures.createLegacySession(kanji)

  expect(isLegacySession(legacy)).toBe(true)
  // Actual behavior: localStorage.removeItem() called
  // NOT: session migration
})
```

**Evidence from code:**
```typescript
// KanjiBrowserPage.tsx:~line 225 (actual implementation)
if (isLegacySession(parsed)) {
  clearPersistedStudySession()  // ✅ CLEAR
  return null                   // ✅ No migration
}
```

**What was corrected:**
- ✅ Removed all "migration" test cases
- ✅ Document CLEAR behavior (actual)
- ✅ Reference `isLegacySession()` type guard (line 182)

---

### Issue: Assumed Vocabulary Progress Fields

**v1.0 Problem:**
```typescript
// ASSUMED - Fields exist now
it('should track vocabularySeenCount', async () => {
  const progress = await manager.getProgress('日')
  expect(progress.vocabularySeenCount).toBe(2)  // ❌ Field doesn't exist yet
})
```

**v2.0 Fix:**
```typescript
// MARKED AS FUTURE - Agent 4 will add
it.skip('should track vocabularySeenCount (Agent 4 - NOT YET IMPLEMENTED)', async () => {
  // NOTE: This test will fail until Agent 4 adds vocabulary fields
  // Current KanjiProgressData has NO vocabularySeenCount field
})
```

**Evidence from code:**
```typescript
// kanjiProgressManager.ts (current state)
export interface KanjiProgressData extends ReviewProgressData {
  character?: string
  jlptLevel?: string
  // NO vocabularySeenCount
  // NO readingsExposed
  // Agent 4 will add these
}
```

**What was corrected:**
- ✅ Marked vocabulary progress tests as `.skip()`
- ✅ Added "Agent 4 - NOT YET IMPLEMENTED" comments
- ✅ Documented which fields are missing

---

### Issue: Presented Metrics as Requirements

**v1.0 Problem:**
```markdown
## Coverage Targets

- Unit tests: 85% (required)
- Integration tests: 90% (required)
- Performance: Session load < 100ms (required)
```

**v2.0 Fix:**
```markdown
## Coverage Targets (🎯 PROPOSED, Not Requirements)

- Unit tests: 🎯 85%+ (proposed target)
- Integration tests: 🎯 90%+ (proposed target)
- Performance: 🎯 < 100ms (recommended threshold)

**These are recommended targets, not approved requirements.**
```

**What was corrected:**
- ✅ Added "🎯 PROPOSED" labels
- ✅ Changed "required" → "proposed target"
- ✅ Added disclaimer at bottom of each section

---

## Category 3: Rollout Strategy Corrections

### Issue: Assumed Remote Config Exists

**v1.0 Problem:**
```typescript
// PRESENTED AS IF EXISTS
function getVocabularyFirstVariant(user, isPremium) {
  const rolloutPercent = getRemoteConfig('vocabulary_first_rollout_percent')  // ❌ Doesn't exist
  // ... complex logic
}
```

**v2.0 Fix:**
```markdown
## Current Feature Flag Infrastructure

**System 1: Environment Flags** (src/lib/features/featureFlags.ts)
- ✅ EXISTS: `isFeatureEnabled(feature: FeatureFlag)`
- ❌ MISSING: `VOCABULARY_FIRST_KANJI` flag (needs to be added)
- Limitations: No percentage rollout, no user overrides

**System 2: Runtime Firestore Flags** (src/lib/features/runtimeFeatureFlags.ts)
- ✅ EXISTS: `isFeatureEnabled(flag: FeatureFlag)` (async)
- ❌ MISSING: Percentage rollout logic
- Limitations: All-or-nothing flags only

## Proposed Options

**Option A: Use Existing Entitlements** (Implementation-Ready)
**Option B: Build Percentage Rollout** (Requires Development)
```

**What was corrected:**
- ✅ Documented ACTUAL feature flag systems
- ✅ Identified what's MISSING (percentage rollout)
- ✅ Proposed two options: minimal (ready) vs enhanced (needs dev)
- ✅ Marked Option B as "PROPOSAL WITH PREREQUISITES"

---

### Issue: Presented Hypothetical A/B Testing as Real

**v1.0 Problem:**
```markdown
## A/B Testing Strategy

Variants:
- Control (A): Default study mode
- Variant (B): Vocabulary-first mode

Allocation: 50/50 split
Analysis: t-test on retention metrics
```
(Presented as if infrastructure exists)

**v2.0 Fix:**
```markdown
## Option C: Full A/B Testing (Future)

**⚠️ SPECULATIVE - Not recommended for initial launch**

Would require:
- Experiment framework (e.g., LaunchDarkly, Optimizely)
- Analytics integration (track by variant)
- Sample size calculations
- Statistical analysis tooling

**Estimated effort:** 2-3 weeks

**Recommendation:** Do Option A or B first, consider A/B testing for v2 improvements.
```

**What was corrected:**
- ✅ Moved A/B testing to "Option C (Future)"
- ✅ Marked as "⚠️ SPECULATIVE"
- ✅ Listed prerequisites explicitly
- ✅ Recommended simpler approach first

---

### Issue: Rollout Schedule Assumed Infrastructure

**v1.0 Problem:**
```markdown
Week 1: Set `vocabulary_first_rollout_percent = 10`
Week 2: Set `vocabulary_first_rollout_percent = 50`
```
(As if `rollout_percent` mechanism exists)

**v2.0 Fix:**
```markdown
**Option A (Minimal - Implementation-Ready):**
Week 0: Admin testing (`policies.admin: true`)
Week 1: All premium users (`policies.premium: true`)
Week 2: Free users (N5 only) (`policies.free: true`)

**Option B (Enhanced - Needs Development):**
Week 0: Build percentage rollout infrastructure (3-4 hours)
Week 1: Set `rolloutPercent: 10` (after implementation)
Week 2: Set `rolloutPercent: 50`
...
```

**What was corrected:**
- ✅ Split into two schedules (Option A vs B)
- ✅ Marked Option A as "Implementation-Ready"
- ✅ Marked Option B prerequisites explicitly
- ✅ Recommended Option A for MVP

---

## Category 4: Precision of Language

### Issue: Ambiguous Status Terms

**v1.0 Problem:**
- "Ready for implementation" (ambiguous)
- "Coverage target: 85%" (sounds like requirement)
- "Rollout will use..." (sounds like decision made)

**v2.0 Fix:**
- "✅ Implementation-Ready" or "⚠️ Proposal with Prerequisites"
- "🎯 Proposed Target: 85%+" (clearly a proposal)
- "Recommended approach: Option A" (recommendation, not decision)

**Symbols Used:**
- ✅ = Exists, verified, or implementation-ready
- ❌ = Missing or incorrect
- 🎯 = Proposed target (not requirement)
- ⚠️ = Requires prerequisites
- 🔮 = Future work (not current)
- ℹ️ = Informational note

---

## Mapping to Real Contracts

### Session Architecture

| v1.0 (Invented) | v2.0 (Real Contract) | File:Line |
|-----------------|----------------------|-----------|
| `parentKanjiId` field | ❌ Removed | N/A (doesn't exist) |
| Flat `cards[]` array | `kanji[].cards[]` nested | `kanji-study.ts:147` |
| Global `currentCardIndex` | Per-kanji `currentCardIndex` | `kanji-study.ts:121` |
| `pattern-hint` card type | Field on `VocabularyCard` | `kanji-study.ts:41` |
| Custom `advanceSession()` | `advanceToNextCard()` | `kanji-study.ts:281` |
| Custom migration logic | `isLegacySession()` + clear | `kanji-study.ts:182` |

---

### Progress Schema

| v1.0 (Assumed) | v2.0 (Actual State) | Owner |
|----------------|---------------------|-------|
| `vocabularySeenCount` exists | ❌ NOT YET IMPLEMENTED | Agent 4 |
| `readingsExposed` exists | ❌ NOT YET IMPLEMENTED | Agent 4 |
| Schema migration needed | ✅ Agent 4 will handle | Agent 4 |
| Backward compatibility | 🎯 Proposed requirement | Agent 4 |

---

### Feature Flags

| v1.0 (Assumed) | v2.0 (Actual) | File |
|----------------|---------------|------|
| `getRemoteConfig()` | ❌ Doesn't exist | N/A |
| `VOCABULARY_FIRST_KANJI` flag | ❌ Not yet added | `featureFlags.ts` needs it |
| Percentage rollout | ❌ Not supported | Would need new code |
| A/B testing framework | ❌ Doesn't exist | Speculative/future |
| User overrides | ❌ Not supported | Option B would add |
| **Entitlements system** | ✅ EXISTS | `useFeature()` hook |

---

## Acceptance Criteria Met

**From original rejection:**

1. ✅ **Test utilities align with real contracts**
   - Imports from `src/types/kanji-study.ts`
   - Uses `KanjiStudySessionState`, `StudySessionKanjiItem`, etc.
   - No invented types or fields

2. ✅ **Strategy docs don't contradict implementation**
   - Documents CLEAR behavior for legacy (not upgrade)
   - Acknowledges nested `kanji[].cards[]` structure
   - Marks vocabulary progress as future work

3. ✅ **Rollout tied to existing infrastructure**
   - Documents actual `featureFlags.ts` and `runtimeFeatureFlags.ts`
   - Proposes Option A (uses existing entitlements)
   - Marks Option B as "requires development"

4. ✅ **Summary distinguishes current/proposed/future**
   - Current: verified in codebase
   - 🎯 Proposed: recommendations (not requirements)
   - 🔮 Future: Agent 4-5 work or v2 features

---

## Remaining Open Questions

**For Product Team:**
1. Which rollout option? (A: entitlements vs B: percentage)
2. Free tier restrictions? (N5 only?)
3. When to add vocabulary progress fields? (Agent 4 scope?)

**For Engineering:**
1. Should we add `VOCABULARY_FIRST_KANJI` to both flag systems?
2. Is manual metrics dashboard sufficient? (vs automated alerts)
3. Who has authority to disable feature in production?

**For Agent 4 (If Running):**
1. Add `vocabularySeenCount` to `KanjiProgressData`?
2. Add `readingsExposed: Set<string>` field?
3. Handle migration for existing progress records?

---

## Final Status

**All deliverables revised:** ✅ COMPLETE

**Precision alignment:** ✅ VERIFIED

**Implementation readiness:**
- Test utilities: ✅ Ready for Agents 1-5 to use
- Test strategy: 🎯 Structure ready, tests by Agents 1-5
- Rollout (Option A): ✅ Implementation-ready after Agents 1-5
- Rollout (Option B): ⚠️ Requires 3-4 hours dev work

**Recommendation:** Proceed with Agent 1-5 implementation using corrected test utilities. After completion, execute Option A rollout (entitlements-based, no new infrastructure needed).

---

**Report Version:** 1.0
**Author:** Agent 6 (Testing & Rollout)
**Date:** 2026-03-24
**Status:** ✅ Precision review complete
