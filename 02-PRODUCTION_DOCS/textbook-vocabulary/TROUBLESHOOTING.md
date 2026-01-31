# Textbook Vocabulary Troubleshooting Guide

**Status:** ACTIVE
**Last Updated:** 2026-01-31
**Target Audience:** Developers debugging textbook vocabulary issues

---

## Table of Contents

1. [Common User Issues](#common-user-issues)
2. [Data Loading Problems](#data-loading-problems)
3. [Progress Tracking Issues](#progress-tracking-issues)
4. [Review Session Errors](#review-session-errors)
5. [Audio Playback Problems](#audio-playback-problems)
6. [Performance Issues](#performance-issues)
7. [Entitlement & Gating Issues](#entitlement--gating-issues)
8. [Development & Debugging](#development--debugging)

---

## Common User Issues

### Issue: Textbook doesn't appear in grid

**Symptoms:**
- Textbook not visible on selection screen
- Card count shows 0
- Empty grid space where card should be

**Possible Causes & Solutions:**

**Cause 1:** Not added to `index.json`
```typescript
// Check: src/data/textbooks/index.json
{
  "textbooks": {
    "missing-textbook": {  // ← Is your textbook here?
      "title": "...",
      "cardCount": 850
    }
  }
}
```
**Solution:** Add textbook to registry (see [DATA_PIPELINE_GUIDE.md](./DATA_PIPELINE_GUIDE.md#step-3-update-textbook-registry))

**Cause 2:** Missing UI configuration
```typescript
// Check: TextbookSelector.tsx ~line 11
const textbookInfo = {
  'missing-textbook': {  // ← Is config defined?
    icon: '📖',
    color: 'from-blue-400 to-cyan-500',
    // ...
  }
}
```
**Solution:** Add `textbookInfo` configuration

**Cause 3:** Typo in textbook ID
```bash
# Folder name: genki-1
# index.json:   genki-1  ← Must match exactly
# UI config:    genki1   ← Mismatch!
```
**Solution:** Ensure consistent IDs across all files

---

### Issue: "No vocabulary found" when selecting lesson

**Symptoms:**
- Empty vocabulary display after selecting lesson
- Message: "No vocabulary items match your filters"

**Debug Steps:**

1. **Check if vocabulary loaded:**
   ```typescript
   // In VocabularyDisplay.tsx, add console log:
   useEffect(() => {
     console.log('[Debug] Loaded vocabulary:', vocabulary.length)
     console.log('[Debug] Filtered:', filteredVocab.length)
   }, [vocabulary, filteredVocab])
   ```

2. **Check lesson numbers in data:**
   ```bash
   # Verify lesson field exists
   cat src/data/textbooks/genki-1/all.json | grep '"lesson"' | head -5
   ```

3. **Check filter logic:**
   ```typescript
   // VocabularyDisplay.tsx ~line 127
   if (selectedLesson !== 'all') {
     filtered = filtered.filter(item => item.lesson === selectedLesson)
   }
   ```

**Common Fixes:**

- **Missing lesson numbers:** Add lesson field to vocabulary items
- **Type mismatch:** Ensure `selectedLesson` is a number, not string
- **Search query active:** Clear search input to see all lesson items

---

### Issue: Progress not saving

**Symptoms:**
- Vocabulary shows as "not started" after studying
- Progress resets on page reload
- Checkmarks don't appear on vocabulary cards

**Diagnostic Checklist:**

1. **Check if user is signed in:**
   ```typescript
   const { user } = useAuth()
   console.log('[Debug] User:', user?.uid)  // Should not be null
   ```

2. **Check IndexedDB:**
   ```javascript
   // Open DevTools → Application → IndexedDB → moshimoshi-universal-progress
   // Look for progress entries
   ```

3. **Check progress manager calls:**
   ```typescript
   // In TextbookVocabularyStudyMode.tsx
   const trackView = async () => {
     console.log('[Debug] Tracking view for:', vocabulary.id)
     await textbookVocabularyProgressManager.trackVocabView(/*...*/)
     console.log('[Debug] View tracked successfully')
   }
   ```

**Common Fixes:**

**Issue:** User not authenticated
```typescript
// Solution: Redirect to sign-in
if (!user) {
  router.push('/signin')
  return
}
```

**Issue:** IndexedDB initialization failed
```typescript
// Check browser console for errors
// Common error: "QuotaExceededError"
// Solution: Clear IndexedDB storage or increase quota
```

**Issue:** Premium sync failing
```typescript
// Check network tab for failed /api/progress/track calls
// Solution: Verify Firebase admin credentials, check API route logs
```

---

## Data Loading Problems

### Issue: JSON import error

**Error Message:**
```
Error: Cannot find module '@/data/textbooks/genki-1/all.json'
```

**Cause:** File doesn't exist or path is wrong

**Solution:**
```bash
# Verify file exists
ls -la src/data/textbooks/genki-1/all.json

# Check file permissions
chmod 644 src/data/textbooks/genki-1/all.json

# Rebuild (Next.js caches imports)
rm -rf .next
npm run dev
```

---

### Issue: HTML tags in vocabulary display

**Symptoms:**
- Vocabulary shows: "hot spring<br>"
- Meaning contains: "&lt;b&gt;onsen&lt;/b&gt;"

**Cause:** Data contains unescaped HTML

**Temporary Fix (Runtime):**
Already implemented in `VocabularyDisplay.tsx:48-55`:
```typescript
function sanitizeVocabularyItem(item: VocabularyItem): VocabularyItem {
  return {
    ...item,
    japanese: stripHtmlTags(item.japanese),
    reading: stripHtmlTags(item.reading),
    meaning: stripHtmlTags(item.meaning)
  }
}
```

**Permanent Fix (Data Source):**
```bash
# Re-convert Anki deck with latest converter
node scripts/anki-deck-to-json.mjs \
  ~/Downloads/deck.apkg \
  textbook-id \
  "Textbook Title"

# Converter already includes HTML stripping
```

---

### Issue: Duplicate vocabulary items

**Symptoms:**
- Same word appears multiple times
- Inconsistent progress between duplicates

**Diagnostic:**
```bash
# Find duplicates
cat src/data/textbooks/genki-1/all.json | \
  jq -r '.[] | .japanese' | \
  sort | uniq -d
```

**Solution:**
```typescript
// Deduplicate during import (add to converter or VocabularyDisplay)
const uniqueVocab = vocabulary.reduce((acc, item) => {
  const key = `${item.japanese}:${item.meaning}`
  if (!acc.has(key)) {
    acc.set(key, item)
  }
  return acc
}, new Map())

setVocabulary(Array.from(uniqueVocab.values()))
```

---

## Progress Tracking Issues

### Issue: Progress stuck at "learning", never "learned"

**Cause:** Thresholds not met

**Requirements for "learned" status:**
```typescript
// Option 1: 6+ views in study mode
const LEARNED_VIEW_THRESHOLD = 6

// Option 2: 90% accuracy over 3+ review attempts
const attempts = (correctCount + incorrectCount) >= 3
const accuracy = (correctCount / attempts) >= 0.9
```

**Debug:**
```typescript
// Check progress data
const progress = await textbookVocabularyProgressManager.getProgressItem(
  user.uid,
  'textbook_vocabulary',
  vocabId
)
console.log('[Debug] Progress:', {
  viewCount: progress.viewCount,
  correctCount: progress.correctCount,
  incorrectCount: progress.incorrectCount,
  status: progress.status
})
```

**Solution:**
If thresholds seem correct but status not updating, force refresh:
```typescript
await textbookVocabularyProgressManager.markVocabLearned(
  vocabId,
  user,
  isPremium,
  { textbook, lesson }
)
```

---

### Issue: Progress not syncing to Firebase (Premium)

**Symptoms:**
- Progress works on one device but not others
- IndexedDB has data, but Firebase doesn't

**Debug Steps:**

1. **Check sync queue:**
   ```typescript
   const queue = await textbookVocabularyProgressManager.getSyncQueue()
   console.log('[Debug] Pending syncs:', queue.length)
   ```

2. **Check API route:**
   ```bash
   # Network tab: Look for POST /api/progress/track
   # Response should be 200 OK
   ```

3. **Check Firebase rules:**
   ```javascript
   // Firestore rules should allow premium users to write
   match /progress/{userId}/{document=**} {
     allow write: if request.auth.uid == userId && isPremium(userId);
   }
   ```

**Common Fixes:**

**Issue:** Circuit breaker open (too many failures)
```typescript
// Force retry
await textbookVocabularyProgressManager.forceSyncAll()
```

**Issue:** Invalid Firebase token
```typescript
// Re-authenticate user
await signOut()
await signInWithPopup(auth, provider)
```

**Issue:** Network offline
```typescript
// Check connectivity
if (!navigator.onLine) {
  console.log('[Debug] Offline - syncs will retry automatically')
}
```

---

## Review Session Errors

### Issue: "No options available" error in review

**Cause:** Distractor pool too small

**Requirements:**
- Need at least 4 items in `reviewContentPool` (for 4-option multiple choice)
- Current item + 3 distractors

**Solution:**
```typescript
// Ensure pool has enough items
const handleStartReview = () => {
  const vocabToReview = vocabulary.filter(v => selectedVocab.has(v.id))

  if (vocabToReview.length === 0) {
    showToast('Please select vocabulary items', 'warning')
    return
  }

  // Pool should include MORE than just selected items
  // Use all items from same lesson for better distractors
  const poolItems = filteredVocabulary.map(v => vocabAdapter.transform(v))

  if (poolItems.length < 4) {
    showToast('Need at least 4 vocabulary items in lesson for review', 'warning')
    return
  }

  setReviewContent(vocabToReview.map(v => vocabAdapter.transform(v)))
  setReviewContentPool(poolItems)
  setViewMode('review')
}
```

---

### Issue: Review session crashes with "Maximum call stack exceeded"

**Cause:** Infinite loop in distractor generation

**Location:** `TextbookVocabularyAdapter.ts:generateOptions()`

**Debug:**
```typescript
generateOptions(content, pool, count) {
  console.log('[Debug] Generating options:', {
    correctAnswer: content.primaryAnswer,
    poolSize: pool.length,
    requestedCount: count
  })

  // Add safety check
  if (pool.length < count - 1) {
    console.warn('[Warning] Pool too small, using all available')
    return pool.slice(0, count).map(v => this.transform(v))
  }

  // ... rest of implementation
}
```

**Solution:**
Ensure pool filtering doesn't eliminate all candidates:
```typescript
// Before: Might filter out everything
const sameLesson = pool.filter(v => v.lesson === metadata.lesson)

// After: Always have fallback
const sameLesson = pool.filter(v => v.lesson === metadata.lesson)
if (sameLesson.length < count - 1) {
  // Fall back to all pool items
  return this.addDistractors(selected, pool, count)
}
```

---

### Issue: XP not awarded after session

**For Study Mode:**

**Expected Behavior:** XP awarded when user completes all items

**Debug:**
```typescript
// In handleStudyNext (TextbookVocabularyPage.tsx ~line 286)
const handleStudyNext = () => {
  if (currentStudyIndex < selectedVocabData.length - 1) {
    setCurrentStudyIndex(prev => prev + 1)
  } else {
    // Check Event Hub initialization
    const hub = getEventHub()
    console.log('[Debug] Event Hub:', hub ? 'initialized' : 'NOT initialized')

    // Emit event
    hub.emit(ReviewEventType.SESSION_COMPLETED, { data: {...} })
    console.log('[Debug] SESSION_COMPLETED emitted')
  }
}
```

**Common Issue:** Event Hub not initialized
```typescript
// Solution: Ensure initialization in useEffect
useEffect(() => {
  if (user?.uid) {
    initializeEventHub(user.uid)
    console.log('[Textbook Vocabulary] Event Hub initialized')
  }
}, [user?.uid])
```

**For Review Mode:**

**Expected Behavior:** URE emits SESSION_COMPLETED automatically

**Debug:**
```typescript
const handleReviewComplete = (statistics) => {
  console.log('[Debug] Review complete called:', statistics)
  // URE should have emitted SESSION_COMPLETED already
  // Check gamification system logs for XP award
}
```

**Common Issue:** URE not configured properly
```typescript
// Ensure ReviewSessionUI has userId
<ReviewSessionUI
  content={reviewContent}
  userId={user.uid}  // ← Must be present
  // ...
/>
```

---

## Audio Playback Problems

### Issue: Audio not playing

**Symptoms:**
- Click audio button, nothing happens
- Console error: "TTS generation failed"

**Debug Steps:**

1. **Check TTS hook:**
   ```typescript
   const { play, loading, playing, error } = useTTS({ cacheFirst: true })
   console.log('[Debug] TTS state:', { loading, playing, error })
   ```

2. **Check API response:**
   ```bash
   # Network tab: /api/tts/generate
   # Should return 200 with audio URL or base64 data
   ```

3. **Try fallback:**
   ```javascript
   // Should fall back to Web Speech API
   if (window.speechSynthesis) {
     console.log('[Debug] Web Speech API available')
     const voices = window.speechSynthesis.getVoices()
     console.log('[Debug] Available voices:', voices)
   }
   ```

**Common Fixes:**

**Issue:** VOICEVOX server offline
```bash
# Check environment variable
echo $VOICEVOX_API_URL

# Start VOICEVOX locally (if using)
docker run -p 50021:50021 voicevox/voicevox_engine:cpu-ubuntu20.04-latest
```

**Issue:** ElevenLabs API key missing
```bash
# Check .env.local
grep ELEVENLABS_API_KEY .env.local
```

**Issue:** iOS audio playback blocked
```typescript
// Solution: User interaction required
const handlePlayAudio = async (text) => {
  try {
    await play(text)
  } catch (error) {
    showToast('Tap again to play audio (iOS requirement)', 'info')
  }
}
```

---

### Issue: Audio cuts off or glitches

**Cause:** Multiple audio instances playing simultaneously

**Solution:**
```typescript
// Ensure previous audio stops before playing new
const handlePlayAudio = async (text: string) => {
  // Stop current playback
  if (playing) {
    stop()  // Implement stop function in useTTS
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  await play(text)
}
```

---

## Performance Issues

### Issue: Slow rendering with large textbooks

**Symptoms:**
- Page freezes when selecting Kanji in Context (9,279 items)
- Browser becomes unresponsive
- "Page Unresponsive" dialog

**Cause:** Rendering all 9K+ DOM nodes at once

**Solution 1: Virtual Scrolling (Recommended)**
```bash
npm install react-window

# See FEATURE_GUIDE.md#virtual-scrolling for implementation
```

**Solution 2: Pagination**
```typescript
const ITEMS_PER_PAGE = 50

const [currentPage, setCurrentPage] = useState(1)
const paginatedVocab = filteredVocab.slice(
  (currentPage - 1) * ITEMS_PER_PAGE,
  currentPage * ITEMS_PER_PAGE
)

// Render only paginatedVocab
```

**Solution 3: Lazy Loading**
```typescript
const [displayedItems, setDisplayedItems] = useState(50)

useEffect(() => {
  const handleScroll = () => {
    if (window.scrollY + window.innerHeight >= document.body.scrollHeight - 500) {
      setDisplayedItems(prev => Math.min(prev + 50, filteredVocab.length))
    }
  }

  window.addEventListener('scroll', handleScroll)
  return () => window.removeEventListener('scroll', handleScroll)
}, [filteredVocab.length])
```

---

### Issue: Slow search performance

**Cause:** Client-side linear search on large datasets

**Solution 1: Debouncing (Already Implemented)**
```typescript
// VocabularyDisplay.tsx uses immediate state update
// Consider adding debounce:

import { useMemo } from 'react'
import debounce from 'lodash/debounce'

const debouncedSearch = useMemo(
  () => debounce((query: string) => {
    setSearchQuery(query)
  }, 300),
  []
)

<input onChange={(e) => debouncedSearch(e.target.value)} />
```

**Solution 2: Fuzzy Search with Index**
```bash
npm install fuse.js

# See FEATURE_GUIDE.md#add-custom-filtering for implementation
```

---

### Issue: Audio preload consuming too much bandwidth

**Symptoms:**
- Slow page load
- Network tab shows many concurrent TTS requests
- Mobile data usage high

**Cause:** Aggressive preloading (20 items × 2 texts = 40 requests)

**Solution: Adaptive Preloading**
```typescript
// Detect network speed
const connection = (navigator as any).connection
const isSlowConnection = connection?.effectiveType === '2g' ||
                        connection?.effectiveType === 'slow-2g'

// Adjust preload count
const preloadCount = isSlowConnection ? 5 : 20

// Increase stagger delay on slow connections
const staggerDelay = isSlowConnection ? 2000 : 1000
```

---

## Entitlement & Gating Issues

### Issue: Free users can't access "All Lessons"

**Expected Behavior:** This is correct - premium feature

**User Report:** "All Lessons option is disabled"

**Response:**
```typescript
// This is intentional
if (lesson === 'all' && !isPremium) {
  showToast('All Lessons view is a Premium feature', 'info')
  return false
}

// Free users get 3 lessons per day
```

---

### Issue: Premium users hitting lesson limit

**Symptoms:**
- Premium user sees "Limit reached" message
- Should have unlimited access

**Debug:**
```typescript
// Check subscription status
const { isPremium } = useSubscription()
console.log('[Debug] isPremium:', isPremium)

// Check feature config
const config = await fetch('/api/usage/textbook_vocabulary/check')
const data = await config.json()
console.log('[Debug] Entitlement:', data)
```

**Common Causes:**

**Cause 1:** Subscription not synced
```typescript
// Solution: Refresh subscription status
await refreshSubscription()  // Implement in useSubscription
```

**Cause 2:** Feature config incorrect
```json
// config/features.v1.json
{
  "textbook_vocabulary": {
    "limits": {
      "premium": {
        "daily": -1,    // ← Should be -1 (unlimited)
        "monthly": -1
      }
    }
  }
}
```

**Cause 3:** Stripe webhook not processed
```bash
# Check Firebase Functions logs
firebase functions:log --only=stripeWebhook

# Manually trigger subscription sync
curl -X POST https://your-domain.com/api/stripe/webhook \
  -H "Content-Type: application/json" \
  -d '{"type": "customer.subscription.updated", ...}'
```

---

### Issue: "Usage indicator shows wrong count"

**Cause:** Client-server sync delay

**Solution:**
```typescript
// Force refresh after lesson access
const handleLessonChange = async (lesson: number) => {
  const allowed = await checkAndTrack({ showUI: true })
  if (allowed) {
    setCurrentLesson(lesson)

    // Refresh usage data
    const usageData = await fetch('/api/usage/textbook_vocabulary/check')
    const { remaining } = await usageData.json()
    // Update UI with fresh data
  }
}
```

---

## Development & Debugging

### Enable Debug Logging

```typescript
// Add to TextbookVocabularyPage.tsx
useEffect(() => {
  if (process.env.NODE_ENV === 'development') {
    (window as any).debugTextbookVocab = {
      vocabulary,
      filteredVocabulary,
      selectedVocab,
      viewMode,
      progress: vocabProgress,
      stats
    }
  }
}, [vocabulary, filteredVocabulary, selectedVocab, viewMode, vocabProgress, stats])

// Then in browser console:
console.log(window.debugTextbookVocab)
```

---

### Inspect Progress Database

```javascript
// Browser DevTools console
const db = await window.indexedDB.open('moshimoshi-universal-progress', 3)

db.onsuccess = (event) => {
  const database = event.target.result
  const transaction = database.transaction(['progress'], 'readonly')
  const store = transaction.objectStore('progress')
  const request = store.getAll()

  request.onsuccess = () => {
    console.log('All progress data:', request.result)
  }
}
```

---

### Clear Progress (Reset for Testing)

```typescript
// Add to development tools
if (process.env.NODE_ENV === 'development') {
  (window as any).clearTextbookProgress = async () => {
    await textbookVocabularyProgressManager.clearAllProgress()
    window.location.reload()
  }
}

// Usage: window.clearTextbookProgress()
```

---

### Test Entitlement Limits

```typescript
// Temporarily override limits for testing
if (process.env.NODE_ENV === 'development') {
  // Force free tier limits
  (window as any).testFreeLimit = () => {
    localStorage.setItem('test:override-premium', 'false')
    window.location.reload()
  }

  // Force premium unlimited
  (window as any).testPremium = () => {
    localStorage.setItem('test:override-premium', 'true')
    window.location.reload()
  }
}
```

---

## Error Messages Reference

| Error Message | Location | Cause | Solution |
|--------------|----------|-------|----------|
| "Please select vocabulary items" | TextbookVocabularyPage.tsx:243 | No items selected | Select at least one item before clicking Study/Review |
| "Need at least 4 items for review" | TextbookVocabularyPage.tsx:256 | Pool too small | Add more vocabulary to lesson or select more items |
| "Cannot find module '@/data/textbooks/...'" | VocabularyDisplay.tsx:101 | Missing JSON file | Run converter or check file path |
| "QuotaExceededError" | IndexedDB operations | Storage full | Clear IndexedDB or increase browser quota |
| "Network request failed" | Progress sync | Offline or API down | Check network, verify API endpoint |
| "Invalid session" | Review mode | URE initialization failed | Ensure `userId` passed to ReviewSessionUI |

---

## Quick Diagnostic Checklist

When a user reports an issue, ask/check:

- [ ] Are they signed in? (Progress requires authentication)
- [ ] What browser? (IndexedDB support varies)
- [ ] What textbook? (Some are larger and slower)
- [ ] Free or Premium? (Entitlements differ)
- [ ] Can they reproduce it? (Intermittent vs consistent)
- [ ] Any console errors? (Check DevTools)
- [ ] Network tab clean? (API failures)
- [ ] IndexedDB populated? (Storage working)

---

## Related Documentation

- [README.md](./README.md) - Feature overview
- [FEATURE_GUIDE.md](./FEATURE_GUIDE.md) - Implementation details
- [DATA_PIPELINE_GUIDE.md](./DATA_PIPELINE_GUIDE.md) - Data creation process
- [Universal Review Engine Troubleshooting](../../docs/REVIEW_ENGINE_TROUBLESHOOTING.md)
- [Entitlements Troubleshooting](../entitlements/TROUBLESHOOTING.md)
- [TTS System Troubleshooting](../tts/TTS_SYSTEM_GUIDE.md#troubleshooting)

---

**Last Updated:** 2026-01-31
**Maintainer:** Development Team

**Need More Help?**
- GitHub Issues: https://github.com/your-org/moshimoshi/issues
- Discord: #dev-support channel
- Email: dev@moshimoshi.app
