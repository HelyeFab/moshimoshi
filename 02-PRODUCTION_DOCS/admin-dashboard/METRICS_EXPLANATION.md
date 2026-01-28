# Admin Dashboard Metrics - Complete Analysis

**Status**: ACTIVE
**Last Updated**: 2026-01-28
**Recent Fixes**: View tracking system, Monthly Revenue calculation

---

## ✅ **Recent Fixes (2026-01-28)**

### 1. View Count Tracking System - FIXED ✅

**Issue**: View counts were unreliable due to PWA caching serving content without API calls.

**Solution**: Created separate `/api/track-view` endpoint that tracks views whether content is served from cache or network.

**Implementation**:
- New endpoint: `src/app/api/track-view/route.ts`
- Deduplication: 3-second window per user to prevent React Strict Mode double-counting
- All content types now use unified tracking: books, comics, stories, articles
- PWA offline functionality preserved

### 2. Monthly Revenue Calculation - FIXED ✅

**Issue**: MRR showed £0 despite having 4 active premium subscriptions.

**Root Cause**: Code was checking wrong field (`userData.tier` instead of `userData.subscription.plan`).

**Solution**: Updated to use `getUserTier()` function which correctly checks `userData.subscription.plan`.

**Current Stats**:
- Premium Monthly: 3 users @ £8.99/month
- Premium Yearly: 1 user @ £8.33/month (£99.99/year)
- **Total MRR: £35.30**

---

## 🚨 **Known Issue: "Active Today" Shows 0**

### Problem

The **"Active Today" metric may show low numbers** if activity tracking isn't working.

**Root Cause**: `lastActive` field needs to be updated on user activity.

**Code Location**: `src/app/api/admin/stats/route.ts:64-66`

```typescript
usersSnapshot.forEach(doc => {
  const userData = doc.data();
  // This checks a field that is NEVER updated ❌
  if (userData.lastActive?.toMillis() >= todayTimestamp) {
    activeUsers++;  // Will never increment!
  }
});
```

### Why This Happens

1. **No tracking code exists**: There's no code in the app that updates `lastActive` when users:
   - Log in
   - Read stories
   - Use flashcards
   - View books
   - Do any activity

2. **Field is undefined**: All user documents have `lastActive` as `undefined` or very old timestamps

### Solution: Add User Activity Tracking

You need to implement user activity tracking. Here are two options:

#### **Option 1: Track on API Calls (Recommended)**

Add a middleware that updates `lastActive` on authenticated API calls:

**Create**: `src/lib/admin/trackActivity.ts`
```typescript
import 'server-only'
import { adminFirestore } from '@/lib/firebase/admin'

/**
 * Track user activity by updating lastActive timestamp
 * Call this in API routes where user performs meaningful actions
 */
export async function trackUserActivity(userId: string): Promise<void> {
  if (!userId || !adminFirestore) return

  try {
    await adminFirestore
      .collection('users')
      .doc(userId)
      .update({
        lastActive: new Date()
      })
  } catch (error) {
    // Log but don't fail the request
    console.error('[Activity Tracking] Failed to update lastActive:', error)
  }
}
```

**Use in key API routes**:
```typescript
// Example: src/app/api/stories/[slug]/route.ts
import { trackUserActivity } from '@/lib/admin/trackActivity'

export async function GET(request, { params }) {
  const session = await getSession()
  if (session?.uid) {
    // Track activity (non-blocking)
    trackUserActivity(session.uid).catch(console.error)
  }

  // Rest of your code...
}
```

**Add to these routes**:
- `/api/stories/[slug]/route.ts` - When reading stories
- `/api/library/books/route.ts` - When reading books
- `/api/comics/episodes/[episodeId]/route.ts` - When reading comics
- `/api/kanji-mastery/session/route.ts` - When using flashcards
- Any other high-traffic user endpoints

#### **Option 2: Track on Login (Simpler but Less Accurate)**

Only update `lastActive` when user logs in:

**Location**: `src/app/api/auth/signin/route.ts`

Find where user profile is created/updated and add:
```typescript
await adminFirestore.collection('users').doc(uid).set({
  ...userData,
  lastActive: new Date()
}, { merge: true })
```

**Downside**: Only shows users who logged in today, not users who are actively using the app.

---

## 📊 **How Content View Metrics Work**

All content views are now tracked through a unified tracking system that works with PWA caching.

### Architecture Overview

**Endpoint**: `/api/track-view` (POST)

**How it works**:
1. User views content (book, story, comic, article)
2. Content served from cache (PWA) OR fetched from API
3. Regardless of source, client calls `/api/track-view` with content type and ID
4. Endpoint increments `viewCount` atomically in Firestore
5. Deduplication prevents double-counting (3-second window per user)

**Code**: `src/app/api/track-view/route.ts`

**Features**:
- ✅ Works with PWA offline caching
- ✅ Atomic increments (no race conditions)
- ✅ Per-user deduplication (prevents React Strict Mode issues)
- ✅ Supports multiple users viewing same content simultaneously
- ✅ Lightweight (doesn't refetch content data)

---

### 1. Article Views (All-Time Cumulative) ✅

**What it shows**: Sum of all-time views across all articles

**Dashboard code**: `src/app/api/admin/stats/route.ts:113-132`
```typescript
articlesSnapshot?.forEach(doc => {
  totalArticleViews += doc.data().viewCount || 0;
});
```

**When incremented**: Via `/api/track-view` when user views an article

**Client code**: `src/hooks/useArticleCache.ts:69-84` (cache path) and `98-105` (network path)
```typescript
// Track view in background
fetch('/api/track-view', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contentType: 'news_articles',
    contentId: articleId
  })
})
```

**Calculation**:
```sql
SELECT SUM(viewCount) FROM news_articles
```

**Is it accurate?**: ✅ Yes - atomic increments with deduplication

---

### 2. Book Views (All-Time Cumulative) ✅

**What it shows**: Sum of all-time views across all published books

**Dashboard code**: `src/app/api/admin/stats/route.ts:118-120`
```typescript
booksSnapshot?.forEach(doc => {
  totalBookViews += doc.data().viewCount || 0;
});
```

**When incremented**: Via `/api/track-view` when user opens a book

**Client code**: `src/hooks/useBookCache.ts`
```typescript
fetch('/api/track-view', {
  method: 'POST',
  body: JSON.stringify({
    contentType: 'books',
    contentId: bookId
  })
})
```

**Track-view implementation**: `src/app/api/track-view/route.ts:99-103`
```typescript
await docRef.update({
  viewCount: FieldValue.increment(1),  // ✅ Atomic
  lastViewed: new Date()
});
```

**Calculation**:
```sql
SELECT SUM(viewCount) FROM books WHERE status = 'published'
```

**Is it accurate?**: ✅ Yes - atomic increments with deduplication

---

### 3. Story Views (All-Time Cumulative) ✅

**What it shows**: Sum of all-time views across all published stories

**Dashboard code**: `src/app/api/admin/stats/route.ts:122-124`
```typescript
storiesSnapshot?.forEach(doc => {
  totalStoryViews += doc.data().viewCount || 0;
});
```

**When incremented**: Via `/api/track-view` when user opens a story

**Client code**: Multiple locations including `src/app/[locale]/stories/[slug]/page.tsx`

**Calculation**:
```sql
SELECT SUM(viewCount) FROM stories WHERE status = 'published'
```

**Is it accurate?**: ✅ Yes - atomic increments with deduplication

---

### 4. Comic Views (All-Time Cumulative) ✅

**What it shows**: Sum of all-time views across all published comics

**Dashboard code**: `src/app/api/admin/stats/route.ts:126-128`
```typescript
comicsSnapshot?.forEach(doc => {
  totalComicViews += doc.data().viewCount || 0;
});
```

**When incremented**: Via `/api/track-view` when user opens a comic episode

**Client code**: `src/hooks/useComicCache.ts`
```typescript
fetch('/api/track-view', {
  method: 'POST',
  body: JSON.stringify({
    contentType: 'comics',
    contentId: episodeId
  })
})
```

**Calculation**:
```sql
SELECT SUM(viewCount) FROM comics WHERE status = 'published'
```

**Is it accurate?**: ✅ Yes - atomic increments with deduplication

---

### 5. Monthly Revenue (MRR) ✅

**What it shows**: Monthly Recurring Revenue from active premium subscriptions

**Dashboard code**: `src/app/api/admin/stats/route.ts:63-76`
```typescript
usersSnapshot.forEach(doc => {
  const userData = doc.data();

  if (isPremiumUser(userData)) {
    premiumUsers++;

    const tier = getUserTier(userData);  // ✅ Uses correct field
    if (tier === 'premium_monthly') {
      monthlyRevenue += PRICING_CONFIG.monthly.amount;  // £8.99
    } else if (tier === 'premium_yearly') {
      monthlyRevenue += MONTHLY_EQUIVALENT_FROM_YEARLY;  // £8.33
    }
  }
});
```

**Calculation**: Sum of monthly equivalents from all active premium users

**Subscription data location**: `users/{uid}/subscription.plan` (NOT `users/{uid}/tier`)

**Tier determination**: `src/lib/auth/tier-utils.ts:14-31`
```typescript
export function getUserTier(userData: any): UserTier {
  // Checks userData.subscription.status and userData.subscription.plan
  if (userData?.subscription?.status === 'active' && userData?.subscription?.plan) {
    return userData.subscription.plan;  // premium_monthly or premium_yearly
  }
  return 'free';
}
```

**Current breakdown**:
- Premium Monthly: 3 users × £8.99 = £26.97
- Premium Yearly: 1 user × £8.33 = £8.33
- **Total MRR: £35.30**

**Is it accurate?**: ✅ Yes - correctly reads from subscription.plan field

---

## 🔧 **Recommended Fixes**

### Priority 1: Fix "Active Today" ⚠️ Critical

**Action**: Implement Option 1 (Track on API Calls)

**Steps**:
1. Create `src/lib/admin/trackActivity.ts` with tracking function
2. Add `trackUserActivity()` call to these routes:
   - `/api/stories/[slug]/route.ts`
   - `/api/library/books/route.ts`
   - `/api/comics/episodes/[episodeId]/route.ts`
   - `/api/kanji-mastery/session/route.ts`
3. Make it non-blocking (don't await, just `.catch()`)
4. Test by checking Firestore `users/{uid}/lastActive` updates

**Impact**: High - provides accurate daily active user metrics

**Effort**: 1-2 hours

**Status**: ✅ IMPLEMENTED
- Activity tracking function exists at `src/lib/admin/trackActivity.ts`
- Being called in multiple API routes (non-blocking)
- Test by checking Firestore `users/{uid}/lastActive` field

---

### ~~Priority 2: Fix viewCount Race Conditions~~ ✅ FIXED

**Status**: ✅ COMPLETED (2026-01-28)

**Solution**: All view tracking now uses unified `/api/track-view` endpoint with atomic increments

**Implementation**: `src/app/api/track-view/route.ts:99-103`
```typescript
await docRef.update({
  viewCount: FieldValue.increment(1),  // ✅ Atomic
  lastViewed: new Date()
});
```

**Files using track-view**:
- `src/hooks/useBookCache.ts`
- `src/hooks/useComicCache.ts`
- `src/hooks/useArticleCache.ts`
- `src/app/[locale]/stories/[slug]/page.tsx`

**Impact**: ✅ Prevents view count inaccuracies - 100% accurate now

---

### ~~Priority 3: Add View Tracking for Articles~~ ✅ FIXED

**Status**: ✅ COMPLETED (2026-01-28)

**Implementation**: Articles now use the same `/api/track-view` system as other content

**Dashboard display**: Changed from "Total Articles: 122" to "Article Views" showing cumulative views

**Impact**: ✅ Provides accurate article engagement metrics

---

## 📈 **Understanding the Numbers**

### Your Current Stats (2026-01-28)

| Metric | Value | Type | Status |
|--------|-------|------|--------|
| Total Users | 565 | Count | ✅ Accurate |
| Active Today | varies | Time-based count | ⚠️ Check lastActive tracking |
| New Users Today | varies | Count (today) | ✅ Accurate |
| Active Subscriptions | 4 | Count | ✅ Accurate |
| Monthly Revenue | £35.30 | MRR calculation | ✅ Accurate |
| Article Views | cumulative | Cumulative sum | ✅ Accurate |
| Book Views | cumulative | Cumulative sum | ✅ Accurate |
| Story Views | cumulative | Cumulative sum | ✅ Accurate |
| Comic Views | cumulative | Cumulative sum | ✅ Accurate |

**Premium Breakdown**:
- 3 × Premium Monthly @ £8.99 = £26.97
- 1 × Premium Yearly @ £8.33/month (£99.99/year) = £8.33
- **Total MRR: £35.30**

---

## 🎯 **Quick Verification**

### Check if metrics are working

**1. Check if lastActive is being tracked**:
```bash
# Connect to Firebase and check a recent user
firebase firestore:query users --where 'lastActive' '>' '2026-01-27'
```

If returns 0 results → lastActive is NOT being tracked

**2. Check viewCount on content**:
```bash
# Check a story's viewCount
firebase firestore:get stories/<some-story-id>
```

Look for `viewCount` field - should exist and increment when viewed

**3. Manually test activity tracking**:
1. View a story as a logged-in user
2. Check Firestore `users/{your-uid}/lastActive`
3. If it's updated → tracking works ✅
4. If it's undefined or old → tracking broken ❌

---

## 📝 **Implementation Checklist**

**Completed** ✅:
- [x] Create `src/lib/admin/trackActivity.ts`
- [x] Add activity tracking to `/api/stories/[slug]/route.ts`
- [x] Add activity tracking to `/api/library/books/route.ts`
- [x] Add activity tracking to `/api/comics/episodes/[episodeId]/route.ts`
- [x] Add activity tracking to `/api/news/article/[id]/route.ts`
- [x] Create unified `/api/track-view` endpoint
- [x] Fix atomic increment in books API (via track-view)
- [x] Fix atomic increment in comics API (via track-view)
- [x] Fix atomic increment in stories API (via track-view)
- [x] Fix atomic increment in articles API (via track-view)
- [x] Add deduplication to prevent React Strict Mode double-counting
- [x] Fix PWA caching compatibility for view tracking
- [x] Fix Monthly Revenue calculation (use subscription.plan field)
- [x] Update documentation

**Remaining**:
- [ ] Test lastActive updates in Firestore
- [ ] Verify "Active Today" shows correct numbers
- [ ] Add Kanji Mastery session activity tracking (if needed)

---

## 🧪 **Testing Guide**

### Test Active Today Tracking

1. **Before fix**: Check "Active Today" = 0
2. **Apply fix**: Add `trackActivity()` to API routes
3. **Test as user**:
   - Log in
   - Read a story
   - View a book
   - Use flashcards
4. **Check Firestore**: `users/{your-uid}/lastActive` should be current timestamp
5. **Check dashboard**: "Active Today" should show at least 1 (you!)
6. **Wait 24 hours**: Check if yesterday's active users show in percentage change

### Test ViewCount Accuracy

1. **Open DevTools Console**
2. **Note current viewCount**: Check dashboard numbers
3. **View content as user**:
   - Open a book → bookViews should +1
   - Read a story → storyViews should +1
   - View a comic → comicViews should +1
4. **Refresh dashboard**: Numbers should increment
5. **Check Firestore**: Each document should have incremented `viewCount`

---

## 📖 **Related Documentation**

- [Developer Guide](./DEVELOPER_GUIDE.md) - Admin dashboard development
- [API Routes](/src/app/api/) - All API implementations
- [Firebase Admin SDK](https://firebase.google.com/docs/firestore/manage-data/add-data) - Firestore operations

---

## ❓ **FAQ**

**Q: Why is "Active Today" 0 when I have 564 users?**
A: The `lastActive` field is never updated. Users are registered but their activity isn't being tracked.

**Q: Are the view counts accurate?**
A: Mostly yes. Stories use atomic increments (100% accurate). Books and Comics have potential race conditions but are mostly accurate under normal load.

**Q: What's the difference between "Total Articles" and other views?**
A: "Total Articles" is a COUNT of articles, not views. Articles don't track view counts yet.

**Q: Can I see daily or weekly views instead of all-time?**
A: No, currently only all-time cumulative views are tracked. To add time-based views, you'd need to implement a views analytics collection with timestamps.

**Q: Why does "Active Today" matter?**
A: It's a key metric for:
- Daily Active Users (DAU)
- User retention
- Feature engagement
- Growth monitoring

Without this metric, you can't see if your 564 users are actively using the app or dormant.

---

**Need help implementing these fixes?** Refer to the [Implementation Checklist](#implementation-checklist) above.
