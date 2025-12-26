# Feature Quota Implementation Guide

**Last Updated:** 2025-12-26
**Author:** Implementation based on drawing_practice migration
**Related Docs:** [ENTITLEMENTGATE.md](./ENTITLEMENTGATE.md)

---

## Overview

This guide walks you through implementing quota-based feature restrictions for free vs premium users. It includes two real-world examples:
1. **Drawing Practice** - Migrating from EntitlementGate to useFeature (0→5 for free tier)
2. **YouTube Shadowing** - Fair quota tracking (consume only after success)

## Table of Contents

1. [When to Add Quotas](#when-to-add-quotas)
2. [Architecture Decision: EntitlementGate vs useFeature](#architecture-decision)
3. [Step-by-Step Implementation](#step-by-step-implementation)
4. [Critical Gotchas](#critical-gotchas)
5. [Testing Checklist](#testing-checklist)
6. [Troubleshooting](#troubleshooting)

---

## When to Add Quotas

### Use Cases for Quota Restrictions

✅ **Good candidates for quotas:**
- Features that consume resources (AI API calls, storage, processing)
- Premium features you want free users to "taste" before upgrading
- Actions that should be rate-limited for abuse prevention
- Features where unlimited access is a clear premium benefit

❌ **Bad candidates for quotas:**
- Basic navigation or reading features
- Features essential for app functionality
- One-time setup actions
- Features that don't differentiate free vs premium value

### Example Quota Structures

| Feature Type | Free Tier | Premium Tier | Rationale |
|--------------|-----------|--------------|-----------|
| Drawing Practice | 5/day | Unlimited | Allows taste, encourages practice routine |
| YouTube Shadowing | 3/day | 20/day | Resource lookup, quota only on success |
| AI Story Generation | 2/day | 10/day | Resource-intensive, clear value upgrade |
| Word Lookups | 5/day | Unlimited | Core learning, limited to encourage subscription |
| News Articles | 2/day | Unlimited | Content access monetization |
| File Uploads | 2/day | Unlimited | Storage costs, abuse prevention |

---

## Architecture Decision

### Pattern 1: `EntitlementGate` Component

**When to use:**
- Feature with `limit = 0` (completely blocked for free users)
- Page-level restriction (entire page is premium-only)
- No preview or trial needed

**Example:**
```typescript
// comics/page.tsx
<EntitlementGate featureId="comics">
  <ComicsContent />
</EntitlementGate>
```

**Behavior:**
- Shows loading spinner during check
- Displays "Feature Unavailable" modal if denied
- Renders children if allowed
- ⚠️ **Redirects to dashboard when modal closed** (can break nested modals)

---

### Pattern 2: `useFeature` Hook

**When to use:**
- Feature with `limit > 0` (quota-based access)
- Action-level restriction (button clicks, not entire pages)
- Users can browse but actions are limited
- Need to show remaining count in UI

**Example:**
```typescript
// Component with quota tracking
const { checkAndTrack, remaining } = useFeature('drawing_practice');

const handleAction = async () => {
  const allowed = await checkAndTrack({ showUI: true });
  if (allowed) {
    performAction();
  }
  // If denied, toast shown automatically
};
```

**Behavior:**
- Shows toast notifications (running low, limit reached)
- NO automatic redirect
- Returns boolean for programmatic control
- Displays remaining count

---

## Step-by-Step Implementation

### Example: Migrating `drawing_practice` from 0 → 5 for Free Tier

This real example shows migrating from `EntitlementGate` (page-level block) to `useFeature` (action-level quota).

---

### Step 1: Update Feature Configuration

**File:** `config/features.v1.json`

**Change the limit:**
```json
{
  "limits": {
    "free": {
      "daily": {
        "drawing_practice": 5  // Changed from 0
      }
    }
  }
}
```

**Verify limits for all tiers:**
```json
{
  "guest": { "daily": { "drawing_practice": 0 } },      // Blocked
  "free": { "daily": { "drawing_practice": 5 } },       // 5 per day
  "premium_monthly": { "daily": { "drawing_practice": -1 } },  // Unlimited
  "premium_yearly": { "daily": { "drawing_practice": -1 } }    // Unlimited
}
```

---

### Step 2: Generate Entitlements

**CRITICAL:** Run this after config changes:

```bash
npm run gen:entitlements
```

**What this does:**
1. Reads `config/features.v1.json`
2. Generates `src/types/FeatureId.ts` (TypeScript types)
3. Generates `src/lib/entitlements/policy.ts` (runtime limits)

**Verify the output:**
```bash
# Check that the limit updated correctly
grep -A 5 "drawing_practice" src/lib/entitlements/policy.ts
```

Expected:
```typescript
"free": {
  "daily": {
    "drawing_practice": 5  // ✅ Should show 5, not 0
  }
}
```

---

### Step 3: Refactor Components

#### A. Remove `EntitlementGate` Wrapper

**Before:**
```typescript
// KanjiDetailsModal.tsx
import { EntitlementGate } from '@/components/review-engine/EntitlementGate'

{showDrawingPractice && kanji && (
  <EntitlementGate featureId="drawing_practice">
    <DrawingPracticeModal
      character={kanji.kanji}
      isOpen={showDrawingPractice}
      onClose={() => setShowDrawingPractice(false)}
      characterType="kanji"
    />
  </EntitlementGate>
)}
```

**After:**
```typescript
{showDrawingPractice && kanji && (
  <DrawingPracticeModal
    character={kanji.kanji}
    isOpen={showDrawingPractice}
    onClose={() => setShowDrawingPractice(false)}
    characterType="kanji"
  />
)}
```

---

#### B. Add `useFeature` Hook

**Update imports:**
```typescript
// REMOVE
import { EntitlementGate } from '@/components/review-engine/EntitlementGate'

// ADD
import { useFeature } from '@/hooks/useFeature'
```

**Add hook initialization:**
```typescript
export default function KanjiDetailsModal({ kanji, isOpen, onClose }) {
  // ... other hooks
  const { checkAndTrack } = useFeature('drawing_practice')
  // ...
}
```

---

#### C. Update Button Handler

**Before (opens directly):**
```typescript
<button onClick={() => setShowDrawingPractice(true)}>
  Practice Writing
</button>
```

**After (checks quota first):**
```typescript
<button
  onClick={async () => {
    console.log('[Component] Checking drawing_practice entitlement...')
    const allowed = await checkAndTrack({ showUI: true })
    console.log('[Component] checkAndTrack result:', allowed)

    if (allowed) {
      setShowDrawingPractice(true)
    } else {
      console.log('[Component] Access denied, modal should NOT open')
    }
  }}
>
  Practice Writing
</button>
```

**Key points:**
- `showUI: true` → Shows toast notifications automatically
- `allowed` → Boolean indicating if action is permitted
- Console logs → Helpful for debugging (remove in production)

---

### Step 4: Handle "Try Again" / Retry Buttons

**CRITICAL:** Every retry must also check quota!

**Example:** DrawingPracticeModal's "Try Again" button

**Before (bypasses quota):**
```typescript
const handleRetry = () => {
  setShowFeedback(false)
  setFeedback(null)
}
```

**After (checks quota):**
```typescript
const { checkAndTrack } = useFeature('drawing_practice')

const handleRetry = async () => {
  console.log('[Modal] Checking quota for retry...')
  const allowed = await checkAndTrack({ showUI: true })
  console.log('[Modal] Retry allowed:', allowed)

  if (allowed) {
    setShowFeedback(false)
    setFeedback(null)
  } else {
    // Quota exceeded - close modal
    console.log('[Modal] Quota exceeded, closing modal')
    onClose()
  }
}
```

**Why this matters:**
- Without this, users can bypass quota by clicking "Try Again" repeatedly
- Each retry = 1 practice session consumed
- When quota exhausted, modal closes with toast message

---

### Step 5: Add to All Entry Points

**Find ALL places users can access the feature:**

```bash
# Search for all instances
grep -r "setShowDrawingPractice\(true\)" src/
```

**Our example had 4 entry points:**
1. ✅ `KanjiDetailsModal.tsx` (kanji details modal)
2. ✅ `KanaDetailsModal.tsx` (kana details modal)
3. ✅ `KanjiStudyMode.tsx` (kanji study cards)
4. ✅ `KanaStudyMode.tsx` (kana study cards)

**Template for study mode cards:**
```typescript
// KanjiStudyMode.tsx
import { useFeature } from '@/hooks/useFeature'
import DrawingPracticeModal from '@/components/drawing-practice/DrawingPracticeModal'

export default function KanjiStudyMode({ kanji }) {
  const [showDrawingPractice, setShowDrawingPractice] = useState(false)
  const { checkAndTrack } = useFeature('drawing_practice')

  return (
    <>
      {/* Practice button on card */}
      <button
        onClick={async (e) => {
          e.stopPropagation()
          const allowed = await checkAndTrack({ showUI: true })
          if (allowed) {
            setShowDrawingPractice(true)
          }
        }}
        className="absolute top-4 right-16 p-2.5 rounded-full bg-green-50 ..."
        title="Practice writing"
      >
        <svg>...</svg> {/* Pencil icon */}
      </button>

      {/* Modal */}
      {showDrawingPractice && (
        <DrawingPracticeModal
          character={kanji.kanji}
          isOpen={showDrawingPractice}
          onClose={() => setShowDrawingPractice(false)}
          characterType="kanji"
        />
      )}
    </>
  )
}
```

---

### Step 6: Enable Toast Notifications (Optional)

**Context:** Some features may have toast notifications disabled in `useFeature.ts`.

**Check if your feature has a special case:**
```typescript
// src/hooks/useFeature.ts line 176
if (featureId !== 'your_feature' && showUI && !silent) {
  // Toasts shown
}
```

**If you find your feature excluded, remove the exclusion:**

```typescript
// BEFORE
if (featureId !== 'drawing_practice' && showUI && !silent) {

// AFTER
if (showUI && !silent) {
```

**Why?** The comment says "EntitlementGate handles UI" but we're removing EntitlementGate, so `useFeature` needs to show toasts.

---

### Step 7: Build and Verify

```bash
# Check for TypeScript errors
npx tsc --noEmit

# If errors, fix them
# Common issues:
# - Forgot to import useFeature
# - Button onClick not async
# - Missing DrawingPracticeModal import
```

---

## Critical Gotchas

### 1. **Forgetting to Call `gen:entitlements`**

**Symptom:** Free users still blocked even after changing config

**Why:** Runtime code uses `src/lib/entitlements/policy.ts`, not `config/features.v1.json`

**Fix:**
```bash
npm run gen:entitlements
```

---

### 2. **Quota Check on Wrong Action**

**Bad Example:**
```typescript
// ❌ Checks quota when modal CLOSES (too late)
<Modal onClose={async () => {
  await checkAndTrack()
  onClose()
}}>
```

**Good Example:**
```typescript
// ✅ Checks quota BEFORE opening modal
<button onClick={async () => {
  const allowed = await checkAndTrack()
  if (allowed) setShowModal(true)
}}>
```

---

### 3. **Forgetting Retry/Try Again Buttons**

**Common mistake:** Only adding quota check to initial open, not to retry buttons inside the modal.

**Result:** User can:
1. Open modal (uses 1/5 quota)
2. Click "Try Again" 100 times (bypasses quota!)

**Fix:** Add `checkAndTrack()` to ALL retry buttons.

---

### 4. **Multiple Entry Points**

**Problem:** Feature accessible from multiple places, but you only add quota to one.

**Example:** Drawing practice accessible from:
- Kanji details modal ✅ (added quota)
- Kana details modal ✅ (added quota)
- Kanji study mode ❌ (forgot to add!)
- Kana study mode ❌ (forgot to add!)

**How to find all entry points:**
```bash
grep -r "YourFeatureModal" src/
grep -r "setShowYourFeature" src/
```

---

### 5. **Shared vs Separate Quotas**

**Decision:** Should kana and kanji practice share the same quota?

**Shared (our approach):**
```typescript
// Both use same featureId
const { checkAndTrack } = useFeature('drawing_practice')
```
- Result: 5 total practices (mix of kana and kanji)

**Separate:**
```typescript
// Kanji
const { checkAndTrack } = useFeature('kanji_drawing_practice')
// Kana
const { checkAndTrack } = useFeature('kana_drawing_practice')
```
- Result: 5 kanji + 5 kana = 10 total

**Choose based on:**
- User experience (simpler = shared)
- Resource costs (expensive = separate limits)
- Premium differentiation (more limits = more upgrade incentive)

---

### 6. **Consuming Quota BEFORE Feature Succeeds**

**⚠️ CRITICAL:** This is unfair to users and causes support issues in production!

**Bad Example (YouTube Shadowing - Initial Implementation):**
```typescript
const loadVideo = async (url: string) => {
  // ❌ Check quota FIRST
  const allowed = await checkAndTrack({ showUI: true })
  if (!allowed) return

  // Then try to fetch transcript
  const response = await fetch(`/api/transcript?videoId=${videoId}`)
  if (!response.ok) {
    // ERROR: No transcript available, but user already lost 1 quota!
    throw new Error('No transcript available')
  }
  // ...load video
}
```

**Why this is bad:**
- User tries video with no transcript → **loses 1 quota**
- User tries 3 videos with no transcripts → **quota exhausted, got nothing**
- Support tickets: "I didn't even use the feature!"

**Good Example (YouTube Shadowing - Fixed):**
```typescript
const loadVideo = async (url: string, checkQuota = true) => {
  // ✅ Fetch transcript FIRST
  const response = await fetch(`/api/transcript?videoId=${videoId}`)
  if (!response.ok) {
    throw new Error('No transcript available')
    // User quota NOT consumed - fair!
  }

  const data = await response.json()

  // ✅ Only check quota if transcript exists
  if (checkQuota) {
    const allowed = await checkAndTrack({ showUI: true })
    if (!allowed) {
      setError('Daily limit reached')
      return // Don't load video, but transcript fetch already succeeded
    }
  }

  // Load video with transcript
  setSegments(data.segments)
}
```

**When to check quota AFTER:**
- Features that can fail (no transcript, API error, invalid input)
- Resource lookups that might not exist
- Operations with validation that could reject
- Any feature where "attempt" ≠ "successful use"

**When to check quota BEFORE:**
- Features that always succeed (drawing practice modal)
- Actions with no failure mode
- Simple UI state changes
- Features where opening the UI = consuming the resource

**Rule of thumb:** If the feature can fail to deliver value, check quota AFTER confirming it will succeed.

---

### 7. **Cache Confusion**

**Issue:** `useFeature` caches decisions for 1 minute.

**Impact:**
- First call: Hits API, gets fresh data
- Calls within 60s: Returns cached result
- Cache cleared: On increment, subscription change

**When it matters:**
- Testing (may need to wait 60s or clear cache)
- Rapid successive calls (expected behavior)

**Not an issue for:**
- Normal usage (each session >> 60s apart)
- "Try Again" buttons (increment clears cache)

---

## Testing Checklist

### Pre-Deployment Testing

#### Test 1: Guest User (Unauthenticated)
- [ ] Click feature button
- [ ] See "requires account" toast
- [ ] Modal does NOT open
- [ ] No redirect to dashboard
- [ ] Console: No errors

---

#### Test 2: Free User - First Use (0/5 used)
- [ ] Click feature button
- [ ] Modal opens immediately
- [ ] NO toast message
- [ ] Can complete action
- [ ] Usage: 1/5

---

#### Test 3: Free User - Running Low (4/5 used)
- [ ] Click feature button
- [ ] Modal opens
- [ ] Info toast: "You have 1 [feature] session(s) left today" (3 second duration)
- [ ] Can complete action normally
- [ ] Usage: 5/5

---

#### Test 4: Free User - Limit Reached (5/5 used)
- [ ] Click feature button
- [ ] Modal does NOT open
- [ ] Warning toast: "Daily limit reached for [feature]. Resets in X hours"
- [ ] Toast includes "Upgrade" button
- [ ] Clicking "Upgrade" → goes to /pricing
- [ ] User stays on current page (NO redirect to dashboard)
- [ ] Other features still work

---

#### Test 5: Free User - Retry Button
- [ ] Open modal (uses 1/5)
- [ ] Click "Try Again" 4 more times (uses 5/5 total)
- [ ] 5th retry: Info toast "You have 1 session left"
- [ ] 6th retry: Modal closes + warning toast
- [ ] Each retry increments usage

---

#### Test 6: Premium User
- [ ] Click feature button 10+ times
- [ ] Modal always opens
- [ ] NO toast messages
- [ ] NO limits
- [ ] Smooth experience

---

#### Test 7: Quota Reset (Next Day)
- [ ] User hit limit yesterday
- [ ] Wait until UTC midnight (or simulate)
- [ ] Click feature button
- [ ] Modal opens (quota reset to 0/5)
- [ ] Fresh quota works

---

#### Test 8: Subscription Upgrade Mid-Session
**Setup:** Free user with active session
- [ ] As free user, use 3/5 quota
- [ ] In another tab, complete premium subscription
- [ ] Wait ~30s for webhook
- [ ] Return to original tab
- [ ] Click feature button
- [ ] Should have unlimited access (no toast, no limits)

---

#### Test 9: Network Failure
**Setup:** DevTools → Network → Offline
- [ ] Click feature button
- [ ] Error toast: "Failed to check feature entitlement"
- [ ] Modal does NOT open (fail-safe)
- [ ] No JavaScript errors
- [ ] No redirect

---

#### Test 10: Shared Quota (if applicable)
- [ ] Use feature from location A: 3 times
- [ ] Use feature from location B: 2 times
- [ ] Total usage: 5/5
- [ ] Next attempt from either location: blocked

---

### API Testing

#### Test 11: Check Endpoint
```bash
# As free user with 2/5 used
curl -H "Cookie: session=..." \
  http://localhost:3000/api/usage/your_feature/check
```

**Expected Response:**
```json
{
  "allow": true,
  "remaining": 3,
  "reason": "ok",
  "policyVersion": 1,
  "resetAtUtc": "2025-12-27T00:00:00.000Z",
  "limit": 5,
  "usageBefore": 2
}
```

---

#### Test 12: Increment Endpoint
```bash
# As free user with 4/5 used
curl -X POST \
  -H "Cookie: session=..." \
  -H "Content-Type: application/json" \
  -d '{"idempotencyKey": "test-123"}' \
  http://localhost:3000/api/usage/your_feature/increment
```

**Expected Response:**
```json
{
  "allow": true,
  "remaining": 0,
  "reason": "ok",
  "policyVersion": 1,
  "resetAtUtc": "2025-12-27T00:00:00.000Z",
  "limit": 5,
  "usageBefore": 4
}
```

**Verify:**
- `usageBefore: 4` (before increment)
- `remaining: 0` (after increment, 5/5 used)

---

### Console Verification

**Check browser console for:**
```
[Component] Checking your_feature entitlement...
POST /api/usage/your_feature/increment
[Component] checkAndTrack result: true
```

**Red flags:**
- No API call (quota check bypassed)
- Multiple API calls for one click (double-counting)
- Errors in console
- Unexpected redirects

---

## Troubleshooting

### Issue: Free users still blocked after config change

**Diagnosis:**
```bash
# Check if gen:entitlements was run
grep "your_feature" src/lib/entitlements/policy.ts
```

**Fix:**
```bash
npm run gen:entitlements
# Verify output shows correct limit
```

---

### Issue: Modal opens without quota check

**Diagnosis:**
Look for direct calls to `setShowModal(true)` without `checkAndTrack()`

**Fix:**
```typescript
// BEFORE
onClick={() => setShowModal(true)}

// AFTER
onClick={async () => {
  const allowed = await checkAndTrack({ showUI: true })
  if (allowed) setShowModal(true)
}}
```

---

### Issue: User can bypass quota with retry

**Diagnosis:**
```typescript
// Check retry button handler
const handleRetry = () => {
  setShowFeedback(false) // ❌ No quota check!
}
```

**Fix:**
```typescript
const handleRetry = async () => {
  const allowed = await checkAndTrack({ showUI: true })
  if (allowed) {
    setShowFeedback(false)
  } else {
    onClose()
  }
}
```

---

### Issue: Toast not showing

**Diagnosis:**
1. Check if feature is excluded in `useFeature.ts`:
   ```typescript
   if (featureId !== 'your_feature' && showUI && !silent) {
   ```

2. Check if `showUI: true` is passed:
   ```typescript
   checkAndTrack({ showUI: true }) // ✅
   checkAndTrack() // ❌ Defaults to true, but be explicit
   ```

**Fix:**
Remove special case or ensure `showUI: true`

---

### Issue: Quota not shared across entry points

**Diagnosis:**
Different `featureId` used:
```typescript
// Location A
useFeature('drawing_practice')

// Location B
useFeature('kana_practice') // ❌ Different feature!
```

**Fix:**
Use same `featureId` everywhere:
```typescript
// All locations
useFeature('drawing_practice')
```

---

### Issue: Need to manually reset quota for testing

**IMPORTANT:** Understand Firestore structure before resetting!

**Firestore Path Structure:**
```
users/
  {userId}/
    usage/
      {featureId}_{date}/        ← Daily features
        {featureId}: number      ← Usage count
        lastUpdated: timestamp

      {featureId}_{year}-{month}/ ← Monthly features
        {featureId}: number
        lastUpdated: timestamp
```

**Bucket Key Format (from evaluator.ts:222-238):**
- **Daily features:** `{featureId}_{YYYY-MM-DD}`
  - Example: `youtube_shadowing_2025-12-26`
- **Monthly features:** `{featureId}_{YYYY-MM}`
  - Example: `custom_lists_2025-12`

**Reset Script Template:**
```javascript
const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function resetQuota() {
  const userId = 'YOUR_USER_ID';
  const featureId = 'youtube_shadowing'; // Your feature
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Construct bucket key (daily features)
  const bucketKey = `${featureId}_${today}`;

  // Correct path: users/{userId}/usage/{bucketKey}
  const usageRef = db.collection('users')
    .doc(userId)
    .collection('usage')
    .doc(bucketKey);

  // Delete entire document to reset to 0
  await usageRef.delete();
  console.log(`✅ Reset ${featureId} for user ${userId}`);

  process.exit(0);
}

resetQuota();
```

**Common Mistakes:**
```javascript
// ❌ WRONG PATH - This is NOT where usage is stored
db.collection('usage').doc(userId)

// ❌ WRONG BUCKET KEY - Missing featureId prefix
const bucketKey = `daily_${today}`

// ❌ WRONG BUCKET KEY - Missing date
const bucketKey = featureId

// ✅ CORRECT PATH
db.collection('users').doc(userId).collection('usage').doc(`${featureId}_${today}`)
```

**Verification:**
```javascript
// Check current usage
const doc = await usageRef.get();
if (doc.exists) {
  const data = doc.data();
  console.log(`Current ${featureId}:`, data[featureId] || 0);
} else {
  console.log('No usage document (0/limit)');
}
```

---

### Issue: Premium users seeing limits

**Diagnosis:**
1. Check user's subscription status:
   ```bash
   # In Firestore console
   users/{userId}/subscription/status
   ```

2. Check API response:
   ```bash
   # Network tab → /api/usage/increment response
   # Should show: "remaining": -1
   ```

**Fix:**
- User's subscription not active in Firestore
- Webhook not processed (wait 30s)
- Wrong plan mapping in config

---

## Quick Reference Card

### Decision Tree

```
Need to restrict a feature?
│
├─ Is it limit=0 (completely blocked for free)?
│  └─ Use EntitlementGate (page-level)
│
└─ Is it limit>0 (quota-based)?
   └─ Use useFeature (action-level)
      │
      ├─ Add to config
      ├─ Run gen:entitlements
      ├─ Import useFeature
      ├─ Add checkAndTrack to button
      ├─ Remove EntitlementGate wrapper
      ├─ Add to ALL entry points
      └─ Add to retry buttons
```

### File Checklist

- [ ] `config/features.v1.json` - Update limit
- [ ] Run `npm run gen:entitlements`
- [ ] `ComponentA.tsx` - Add useFeature hook
- [ ] `ComponentB.tsx` - Add useFeature hook
- [ ] `ComponentN.tsx` - Add to ALL entry points
- [ ] `ModalWithRetry.tsx` - Add to retry buttons
- [ ] `src/hooks/useFeature.ts` - Remove special case (if exists)
- [ ] Test all scenarios
- [ ] Deploy

---

## Real-World Example: Drawing Practice Migration

**Pull Request Summary:**

```
feat: Enable drawing practice for free tier (5/day)

Changes:
- config/features.v1.json: drawing_practice 0→5 for free tier
- Generated: policy.ts with new limits
- KanjiDetailsModal.tsx: EntitlementGate → useFeature
- KanaDetailsModal.tsx: EntitlementGate → useFeature
- KanjiStudyMode.tsx: Added practice button with quota check
- KanaStudyMode.tsx: Added practice button with quota check
- DrawingPracticeModal.tsx: Added quota check to retry button
- useFeature.ts: Removed drawing_practice toast exclusion

Result:
- Free users: 5 practices/day (shared kana + kanji)
- Premium users: Unlimited
- Modal dismissal: No redirect (stays on page)
- Toast notifications: Running low, limit reached, upgrade CTA

Files modified: 8
Lines changed: ~50
Test coverage: All 12 test scenarios passed
```

---

## Real-World Example: YouTube Shadowing (Quota After Success)

**Pull Request Summary:**

```
feat: Add quota enforcement to YouTube shadowing (3/day, fair tracking)

Changes:
- youtube-shadowing/page.tsx: Added useFeature hook
- loadTranscript(): Moved quota check AFTER successful transcript fetch
- Added checkQuota parameter (default: true)
- Added detailed console logging for debugging

Critical Fix:
- Quota consumed ONLY when transcript exists (not on failed attempts)
- Users don't lose quota on "No transcript available" errors
- Fair user experience: attempt ≠ consumption

Result:
- Free users: 3 videos/day (only successful loads count)
- Premium users: 20 videos/day
- Failed attempts: Don't consume quota
- Toast notifications: Running low (2 left), limit reached

Files modified: 1
Lines changed: ~25
User fairness: 100% (no quota loss on failures)
```

**Key Implementation Pattern:**

```typescript
const loadTranscript = async (input: string, checkQuota = true) => {
  // ✅ Step 1: Try to fetch resource FIRST
  const response = await fetch(`/api/transcript?videoId=${videoId}`)
  if (!response.ok) {
    throw new Error('No transcript available')
    // User quota NOT consumed - fair!
  }
  const data = await response.json()

  // ✅ Step 2: Only check quota if resource exists
  if (checkQuota) {
    const allowed = await checkAndTrack({ showUI: true })
    if (!allowed) {
      setError('Daily limit reached')
      return // Don't load, but quota wasn't consumed on failed fetch
    }
  }

  // ✅ Step 3: Load the resource
  setSegments(data.segments)
}
```

**Why This Matters:**

Without this pattern:
- User tries 3 videos with no transcript → 3/3 quota used, got 0 videos
- Support tickets: "The feature didn't work but I lost all my tries!"
- Unfair to users, damages trust

With this pattern:
- User tries 3 videos with no transcript → 0/3 quota used, got 0 videos
- User tries 3 videos with transcripts → 3/3 quota used, got 3 videos
- Fair: Only successful usage counts

---

## Additional Resources

- [ENTITLEMENTGATE.md](./ENTITLEMENTGATE.md) - Detailed entitlement system docs
- [URE Architecture](../1-URE-Architecture/) - Universal Review Engine docs
- [Stripe Integration](./STRIPE_ARCHITECTURE_EXPERT_REPORT.md) - Payment flow

---

**Questions?** Check console logs, Network tab, and Firestore usage data.

**Last Resort:** Clear Firestore usage document for user and test from fresh state.
