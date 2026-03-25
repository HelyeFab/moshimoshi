# Vocabulary-First Kanji: Rollout Strategy

**Version:** 2.0 (Aligned with Actual Infrastructure)
**Date:** 2026-03-24
**Status:** ** Proposal with Prerequisites**

---

## Document Status

**⚠️ THIS IS A PROPOSAL, NOT IMPLEMENTATION-READY**

This document proposes a rollout strategy based on existing feature flag infrastructure. Prerequisites must be completed before this plan can be executed.

**What EXISTS:**
- Environment-based feature flags (`src/lib/features/featureFlags.ts`)
- Runtime Firestore flags (`src/lib/features/runtimeFeatureFlags.ts`)
- No vocabulary-first specific flag yet

**What's NEEDED (Prerequisites):**
- Add `VOCABULARY_FIRST_KANJI` flag to both systems
- Implement gradual rollout mechanism (percentage-based)
- Add monitoring dashboards for the specific feature

---

## Current Feature Flag Infrastructure

### System 1: Environment Flags (featureFlags.ts)

**How it works:**
```typescript
// src/lib/features/featureFlags.ts
export type FeatureFlag =
  | 'COMMAND_PALETTE'
  | 'KANJI_BROWSER'
  // ... 30+ other flags
  // VOCABULARY_FIRST_KANJI NOT YET ADDED

export function isFeatureEnabled(feature: FeatureFlag): boolean {
  // 1. Check environment variable (highest priority)
  const envValue = process.env[`NEXT_PUBLIC_FEATURE_${feature}`]

  // 2. Check production overrides
  // 3. Use default value
}
```

**Limitations for rollout:**
- ❌ No percentage-based rollout
- ❌ No user-specific overrides
- ❌ Requires code deploy to change
- ✅ Fast evaluation (no network)
- ✅ Works offline

**Best for:** Kill switch (global on/off)

---

### System 2: Runtime Firestore Flags (runtimeFeatureFlags.ts)

**How it works:**
```typescript
// src/lib/features/runtimeFeatureFlags.ts
export async function getAllFeatureFlags(): Promise<Record<FeatureFlag, boolean>> {
  const docRef = doc(db, 'config', 'featureFlags')
  const docSnap = await getDoc(docRef)
  // Returns: { COMMAND_PALETTE: true, KANJI_BROWSER: true, ... }
}

export async function isFeatureEnabled(flag: FeatureFlag): Promise<boolean> {
  const flags = await getAllFeatureFlags()
  return flags[flag] ?? defaultValue
}
```

**Limitations for rollout:**
- ❌ No percentage-based rollout
- ❌ No A/B testing
- ❌ No user-specific overrides
- ✅ Can toggle without deploy (1 min cache TTL)
- ✅ Admin panel can update

**Best for:** Runtime kill switch (emergency disable)

---

### System 3: Entitlements (useFeature hook)

**How it works:**
```typescript
// src/hooks/useFeature.ts
const { checkAndTrack, checkOnly } = useFeature('kanji_lookup')

// Checks:
// 1. Feature policy (premium/free/disabled)
// 2. Usage limits (daily caps)
// 3. Tracks usage
```

**Limitations for rollout:**
- ❌ Not designed for feature flags
- ❌ No percentage-based rollout
- ✅ Can gate by user tier (premium/free)
- ✅ Tracks usage for analytics

**Best for:** Entitlement gating (premium features)

---

## Gap Analysis

**What's Missing for Vocabulary-First Rollout:**

1. **Percentage-Based Rollout**
   - Current: All-or-nothing flags
   - Needed: Roll out to 10% → 50% → 100%
   - Requires: User hash % logic

2. **User-Specific Overrides**
   - Current: No per-user flags
   - Needed: Enable for beta testers
   - Requires: Firestore `/users/{uid}/featureOverrides` collection

3. **Monitoring Integration**
   - Current: No feature-specific metrics
   - Needed: Session completion rate, error rate per feature
   - Requires: Analytics events + dashboard

4. **A/B Testing**
   - Current: None
   - Needed (optional): Compare vocabulary-first vs traditional
   - Requires: Experiment framework

---

## Proposed Rollout Architecture

### Option A: Minimal (Use Existing Infrastructure)

**Approach:** Use entitlements system for gating, no gradual rollout

**Implementation:**
```typescript
// Add to entitlements config
{
  featureId: 'vocabulary_first_kanji',
  displayName: 'Vocabulary-First Study Mode',
  policies: {
    free: { enabled: false },           // Not available to free users
    premium: { enabled: true },         // Available to premium
    admin: { enabled: true },
  },
  limits: {
    free: { daily: 0 },
    premium: { daily: Infinity },
  }
}
```

**Rollout Steps:**
1. Week 0: Admin testing (`policies.admin: true`)
2. Week 1: Premium users (`policies.premium: true`)
3. Week 2+: Free users (`policies.free: true`, limit N5 kanji)

**Pros:**
- ✅ Uses existing system (no new code)
- ✅ Can gate by tier
- ✅ Tracks usage

**Cons:**
- ❌ No gradual rollout (all premium at once)
- ❌ No A/B testing
- ❌ Requires code deploy to change

**Status:** **IMPLEMENTATION-READY** (can execute now)

---

### Option B: Enhanced (Build Percentage Rollout)

**Approach:** Extend runtime flags to support percentage-based rollout

**⚠️ REQUIRES NEW DEVELOPMENT:**

**Step 1: Add Rollout Config to Firestore**
```typescript
// Firestore: /config/featureRollouts/vocabulary_first_kanji
{
  enabled: true,
  rolloutPercent: 10,              // 0-100
  tier: 'premium',                 // 'all' | 'premium' | 'free'
  userOverrides: {
    'user-123': true,              // Force enable for beta users
    'user-456': false,             // Force disable for buggy accounts
  },
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**Step 2: Implement Evaluation Logic**
```typescript
// src/lib/features/rolloutFlags.ts (NEW FILE)
export async function isUserInRollout(
  featureId: string,
  userId: string | null,
  isPremium: boolean
): Promise<boolean> {
  // 1. Get rollout config from Firestore
  const config = await getRolloutConfig(featureId)

  if (!config.enabled) return false

  // 2. Check user override
  if (userId && config.userOverrides[userId] !== undefined) {
    return config.userOverrides[userId]
  }

  // 3. Check tier
  if (config.tier === 'premium' && !isPremium) return false
  if (config.tier === 'free' && isPremium) return false  // Free-only rollout

  // 4. Check rollout percentage
  const userHash = hashUserId(userId || 'anonymous')
  const bucket = userHash % 100
  return bucket < config.rolloutPercent
}

function hashUserId(userId: string): number {
  // Simple hash: consistent per user
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i)
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}
```

**Step 3: Integrate with UI**
```typescript
// src/hooks/useVocabularyFirstFeature.ts (NEW FILE)
export function useVocabularyFirstFeature() {
  const { user } = useAuth()
  const { isPremium } = useSubscription()
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkRollout() {
      setLoading(true)
      const inRollout = await isUserInRollout(
        'vocabulary_first_kanji',
        user?.uid || null,
        isPremium
      )
      setEnabled(inRollout)
      setLoading(false)
    }
    checkRollout()
  }, [user?.uid, isPremium])

  return { enabled, loading }
}
```

**Rollout Steps:**
1. Week 0: Set `rolloutPercent: 0`, enable admins via `userOverrides`
2. Week 1: Set `rolloutPercent: 10`, `tier: 'premium'`
3. Week 2: Set `rolloutPercent: 50`
4. Week 3: Set `rolloutPercent: 100`
5. Week 4+: Set `tier: 'all'` to include free users

**Pros:**
- ✅ Gradual rollout (10% → 100%)
- ✅ User-specific overrides for beta testing
- ✅ No code deploy to change percentage
- ✅ Can rollback instantly (set `rolloutPercent: 0`)

**Cons:**
- ❌ Requires new development (estimated 3-4 hours)
- ❌ Adds Firestore read on feature check (cached 1 min)
- ❌ More complex testing

**Status:** **PROPOSAL** (prerequisites needed)

---

### Option C: Full A/B Testing (Future)

**⚠️ SPECULATIVE - Not recommended for initial launch**

Would require:
- Experiment framework (e.g., LaunchDarkly, Optimizely)
- Analytics integration (track by variant)
- Sample size calculations
- Statistical analysis tooling

**Estimated effort:** 2-3 weeks

**Recommendation:** Do Option A or B first, consider A/B testing for v2 improvements.

---

## Recommended Approach

**For Initial Launch: Use Option A (Minimal)**

**Rationale:**
1. Existing entitlements system works
2. No new infrastructure needed
3. Can launch in current sprint
4. Gradual rollout not critical for MVP

**Rollout Schedule (Option A):**

| Week | Audience            | Config                                    | Decision Gate                  |
|------|---------------------|-------------------------------------------|--------------------------------|
| 0    | Admins only         | `policies.admin: true` | No critical bugs               |
| 1    | All premium users   | `policies.premium: true`                  | Error rate < 2%, completion > 50% |
| 2    | Free users (N5 only)| `policies.free: true`, limit N5           | Conversion rate tracked        |

**Emergency Disable:**
```typescript
// Update entitlements config
{ featureId: 'vocabulary_first_kanji', policies: { free: false, premium: false } }
```

---

## Monitoring (Regardless of Option)

**Required Analytics Events:**

```typescript
// Track when feature is accessed
analytics.track('vocabulary_first_session_started', {
  userId,
  kanjiCount,
  mode: 'vocabulary-first',
  timestamp: Date.now()
})

// Track completion
analytics.track('vocabulary_first_session_completed', {
  userId,
  kanjiCount,
  cardsCompleted,
  duration: sessionEndTime - startTime,
  timestamp: Date.now()
})

// Track errors
analytics.track('vocabulary_first_error', {
  userId,
  error: errorMessage,
  context: 'session_creation' | 'card_generation' | 'persistence',
  timestamp: Date.now()
})
```

**Metrics Dashboard (Manual Setup Required):**
- Session start rate (events/day)
- Session completion rate (completed / started)
- Average session duration
- Error rate (errors / sessions)
- Kanji studied (total count)

**🎯 Proposed Thresholds for Go/No-Go:**
- Error rate > 2% → ROLLBACK
- Completion rate < 40% → HOLD
- Completion rate > 60% → PROCEED

---

## Prerequisites Checklist

**Before launching Option A (Minimal):**
- [ ] Add `vocabulary_first_kanji` to entitlements config
- [ ] Set policies: `{ admin: true, premium: false, free: false }`
- [ ] Add analytics events to session code
- [ ] Manual dashboard for tracking metrics
- [ ] Test emergency disable procedure

**Before launching Option B (Enhanced):**
- [ ] All Option A prerequisites
- [ ] Implement `src/lib/features/rolloutFlags.ts`
- [ ] Create Firestore collection `/config/featureRollouts`
- [ ] Implement `useVocabularyFirstFeature()` hook
- [ ] Test percentage logic (10%, 50%, 100%)
- [ ] Test user override logic
- [ ] Cache rollout config (1 min TTL)

**Not Required for MVP:**
- ❌ A/B testing framework
- ❌ Automated alerting (manual monitoring acceptable)
- ❌ Advanced analytics (basic events sufficient)

---

## Emergency Rollback Procedures

### Option A (Entitlements)

**Immediate Disable (< 1 minute):**
```typescript
// Update entitlements config via admin panel or code
{ policies: { admin: false, premium: false, free: false } }
```

**Verification:**
- Check analytics: no new `vocabulary_first_session_started` events
- User reports: "Vocabulary-first button disappeared"

---

### Option B (Rollout Flags)

**Immediate Disable (< 5 minutes):**
```typescript
// Update Firestore: /config/featureRollouts/vocabulary_first_kanji
{ enabled: false }
// OR set rolloutPercent: 0
```

**Cache note:** Changes take effect within 1 minute (cache TTL)

---

## Open Questions

1. **Which option to use?**
   - Recommendation: Option A for MVP, Option B for v2
   - Decision maker: Product team

2. **Free tier restrictions?**
   - Recommendation: Limit to N5 kanji (80 kanji)
   - Decision maker: Product team

3. **Analytics platform?**
   - Current: Firebase Analytics (existing)
   - Sufficient for MVP monitoring

4. **Rollback authority?**
   - Recommendation: Any engineer on-call can disable via config
   - Requires: Admin panel access or Firestore console

---

## Comparison to v1.0 Mistakes

**What I Got Wrong in v1.0:**

1. **Assumed Remote Config exists** - Presented `getRemoteConfig()` as if implemented
2. **Presented hypothetical A/B testing** - Treated as if infrastructure exists
3. **Didn't acknowledge infrastructure gaps** - Acted as if ready to execute
4. **Overly complex initial proposal** - Proposed building full A/B system for MVP

**What's Now Correct:**

1. Documents ACTUAL feature flag systems (env vars + Firestore)
2. Identifies gaps explicitly (percentage rollout, user overrides)
3. Proposes two options: minimal (ready now) vs enhanced (needs dev)
4. Recommends minimal approach for MVP
5. Marks document as "PROPOSAL WITH PREREQUISITES"

---

## Final Recommendation

**Use Option A (Entitlements-Based) for initial launch:**

**Why:**
- ✅ Uses existing infrastructure (no new development)
- ✅ Can launch immediately after Agent 1-5 complete
- ✅ Emergency disable < 1 minute
- ✅ Sufficient for MVP validation

**When to consider Option B:**
- After successful MVP launch
- If gradual rollout becomes critical (e.g., performance concerns)
- If we want to test variants (traditional vs vocabulary-first)

---

**Document Version:** 2.0 (Aligned with Actual Infrastructure)
**Author:** Agent 6 (Testing & Rollout)
**Last Updated:** 2026-03-24
**Status:** **PROPOSAL** - Prerequisites required for Option B, Option A implementation-ready
