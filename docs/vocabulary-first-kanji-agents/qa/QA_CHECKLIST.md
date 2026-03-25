# Vocabulary-First Kanji: QA Checklist

**Version:** 1.0
**Date:** 2026-03-24
**Purpose:** Human verification checklist for pre-launch validation

---

## Pre-Flight Checklist

Before beginning QA:
- [ ] Feature flag `vocabulary_first_kanji` is enabled
- [ ] Test user account is premium (for progress sync testing)
- [ ] Test device matrix ready (iOS, Android, Desktop Chrome/Firefox/Safari)
- [ ] Dev tools console open (monitor errors)
- [ ] Network throttling available (test offline scenarios)

---

## Section 1: Core Study Flow

### 1.1 Single Kanji Session

**Test Case:** Study single kanji "日" with vocabulary-first mode

**Steps:**
1. Navigate to Kanji Browser
2. Select JLPT N5 → "日" (sun/day)
3. Click "Study Selected"
4. **Verify:** Session starts with meaning card (not vocabulary)
5. Click "Next" → **Verify:** Vocabulary card 1 appears
   - [ ] Word displayed with furigana on "日" only
   - [ ] Reading shown (e.g., "ひ" in "今日")
   - [ ] Meaning shown (e.g., "today")
   - [ ] Audio button present and functional
   - [ ] Pattern hint shown (e.g., "This reading appears at the start of words")
6. Click "Next" → **Verify:** Vocabulary card 2 appears (different reading)
   - [ ] Different word from card 1
   - [ ] Teaches different reading (e.g., "にち" in "毎日")
7. Click "Next" → **Verify:** Reading summary card appears
   - [ ] Shows curated onyomi (top 2)
   - [ ] Shows curated kunyomi (top 3)
   - [ ] Audio buttons for each reading
   - [ ] "Show More" button if additional readings exist
8. Click "Next" → **Verify:** Session completes
   - [ ] Confetti animation (if applicable)
   - [ ] Returns to browse mode
   - [ ] Progress badge shows kanji as "learning" or "learned"

**Pass Criteria:** All cards display correctly, progress updates, session completes cleanly

---

### 1.2 Multi-Kanji Session

**Test Case:** Study 3 kanji in sequence

**Steps:**
1. Select 3 kanji: "日", "月", "火"
2. Click "Study Selected"
3. **Verify:** Session shows total card count (e.g., "1 / 15")
4. Complete all cards for "日" (5 cards)
5. **Verify:** Next card is meaning card for "月"
6. Complete all cards for "月"
7. **Verify:** Next card is meaning card for "火"
8. Complete session
9. **Verify:** All 3 kanji marked as learned/learning

**Pass Criteria:** Session transitions smoothly between kanji, card count accurate

---

### 1.3 Session Persistence

**Test Case:** Interrupt and resume session

**Steps:**
1. Start session with 3 kanji
2. Advance to card 7 (middle of second kanji)
3. **Refresh page** (Ctrl+R / Cmd+R)
4. **Verify:** Session restores at card 7
   - [ ] Correct card displayed
   - [ ] Correct kanji
   - [ ] Correct card type (vocabulary/reading/etc)
   - [ ] Progress bar shows "7 / 15"
5. Click "Previous" → **Verify:** Goes to card 6
6. Click "Next" twice → **Verify:** Goes to card 8
7. Complete session normally

**Pass Criteria:** Session restores exactly, navigation works after restore

---

### 1.4 Session Abandonment

**Test Case:** Exit session mid-study

**Steps:**
1. Start session with 2 kanji
2. Advance to card 3
3. Click "Exit" or "Back" button
4. **Verify:** Confirmation dialog appears ("Are you sure?")
5. Click "Cancel" → **Verify:** Session continues
6. Click "Exit" again → Click "Confirm"
7. **Verify:** Returns to browse mode
8. **Verify:** Progress saved for viewed cards only
9. Refresh page
10. **Verify:** No session auto-restores (localStorage cleared)

**Pass Criteria:** Exit flow works, partial progress saved, no ghost sessions

---

## Section 2: Progress Tracking

### 2.1 Vocabulary Exposure Tracking

**Test Case:** Verify vocabulary views tracked separately

**Steps:**
1. Open browser DevTools → IndexedDB → `moshimoshi-universal-progress`
2. Start session for "日"
3. View meaning card → Check IndexedDB
   - [ ] `viewCount` = 1
   - [ ] `vocabularySeenCount` = 0
4. View vocabulary card 1 → Check IndexedDB
   - [ ] `viewCount` = 1 (unchanged)
   - [ ] `vocabularySeenCount` = 1
5. View vocabulary card 2 → Check IndexedDB
   - [ ] `vocabularySeenCount` = 2
6. View reading summary → Check IndexedDB
   - [ ] `vocabularySeenCount` = 2 (unchanged)

**Pass Criteria:** Vocabulary views tracked separately from kanji views

---

### 2.2 Reading Exposure Tracking

**Test Case:** Verify exposed readings tracked

**Steps:**
1. View vocabulary card for "日" teaching "ひ"
2. Check IndexedDB progress for "日"
   - [ ] `readingsExposed` includes "ひ"
3. View vocabulary card teaching "にち"
4. Check IndexedDB
   - [ ] `readingsExposed` includes both "ひ" and "にち"
5. Enter review mode for "日"
6. **Verify:** Review card shows "ひ" and "にち" prominently

**Pass Criteria:** Exposed readings tracked and influence review mode

---

### 2.3 Premium Sync

**Test Case:** Firebase sync for premium users

**Prerequisites:** Premium account

**Steps:**
1. Complete vocabulary-first session on **Device A** (desktop)
2. Check Firestore: `/users/{uid}/progress/kanji`
   - [ ] Document exists
   - [ ] Contains progress for studied kanji
   - [ ] Includes `vocabularySeenCount` field
   - [ ] Includes `readingsExposed` array
3. Open Kanji Browser on **Device B** (mobile, same account)
4. **Verify:** Progress badge shows same status as Device A
5. View kanji details → **Verify:** Vocabulary count matches

**Pass Criteria:** Progress syncs across devices within 5 seconds

---

### 2.4 Free User (No Sync)

**Test Case:** Verify free users work offline-only

**Prerequisites:** Free account (no subscription)

**Steps:**
1. Complete session
2. Check IndexedDB → **Verify:** Progress saved locally
3. Check Firestore → **Verify:** No writes to `/progress/` collection
4. Open incognito window (same account)
5. **Verify:** Progress NOT synced (browser storage isolated)

**Pass Criteria:** Free users don't trigger Firebase writes

---

## Section 3: UI/UX Testing

### 3.1 Mobile Layout (375px width)

**Device:** iPhone SE / Galaxy S8

**Test Case:** Vocabulary card responsive design

**Steps:**
1. Start session on mobile
2. View vocabulary card
3. **Verify:**
   - [ ] Word + furigana fits on screen (no horizontal scroll)
   - [ ] Meaning text wraps properly
   - [ ] Audio button large enough to tap (44x44px minimum)
   - [ ] Pattern hint readable (font size ≥ 14px)
   - [ ] Navigation buttons don't overlap content
4. Rotate to landscape
5. **Verify:** Layout adapts (no broken overflow)

**Pass Criteria:** All text readable, no layout breaks, touch targets ≥44px

---

### 3.2 Dark Mode

**Test Case:** Vocabulary cards in dark theme

**Steps:**
1. Toggle dark mode (system settings or app toggle)
2. Start session
3. **Verify:**
   - [ ] Vocabulary card background contrasts with text (WCAG AA)
   - [ ] Furigana readable (not too faint)
   - [ ] Pattern hint box visible
   - [ ] Audio button icon visible

**Pass Criteria:** All elements visible and readable in dark mode

---

### 3.3 Accessibility

**Test Case:** Screen reader compatibility

**Tools:** VoiceOver (iOS/Mac) or TalkBack (Android)

**Steps:**
1. Enable screen reader
2. Navigate to vocabulary card
3. **Verify:**
   - [ ] Kanji word announced
   - [ ] Reading announced
   - [ ] Meaning announced
   - [ ] Audio button labeled ("Play pronunciation of...")
   - [ ] Navigation buttons labeled ("Next card", "Previous card")
4. Use keyboard only (Tab navigation)
5. **Verify:**
   - [ ] Can reach all interactive elements
   - [ ] Focus indicator visible
   - [ ] Enter/Space activates buttons

**Pass Criteria:** Full keyboard navigation, clear labels, focus visible

---

### 3.4 Audio Playback

**Test Case:** TTS audio for vocabulary

**Steps:**
1. View vocabulary card for "日本" (nihon)
2. Click audio button
3. **Verify:**
   - [ ] Audio plays full word "nihon" (not just "ni")
   - [ ] Voice is Japanese (ja-JP)
   - [ ] Playback speed ~0.85x (natural pace)
4. Click audio button again while playing
5. **Verify:** Restarts from beginning (or queues)
6. Test with slow internet (Network throttle: Slow 3G)
7. **Verify:**
   - [ ] Loading indicator appears
   - [ ] Audio plays after load
   - [ ] No broken audio

**Pass Criteria:** Audio plays correctly, handles errors gracefully

---

## Section 4: Edge Cases

### 4.1 Kanji with No Vocabulary

**Test Case:** Rare kanji with no JMdict matches

**Steps:**
1. Manually select a rare kanji (e.g., "㐂")
2. Start session
3. **Verify:**
   - [ ] Meaning card appears
   - [ ] Reading summary appears (fallback to all readings)
   - [ ] NO vocabulary cards (or shows "No vocabulary examples found")
4. Complete session
5. **Verify:** Progress still saved

**Pass Criteria:** Graceful fallback, no crashes

---

### 4.2 Kanji with Single Reading

**Test Case:** Kanji with only 1 onyomi or 1 kunyomi

**Steps:**
1. Select kanji with minimal readings (e.g., "々")
2. Start session
3. **Verify:**
   - [ ] Shows 1 vocabulary card (or reading summary only)
   - [ ] Session completes successfully

**Pass Criteria:** No crashes, adapts card count dynamically

---

### 4.3 Long Words

**Test Case:** Vocabulary with 4+ characters

**Steps:**
1. Find vocabulary card with long word (e.g., "一生懸命")
2. **Verify:**
   - [ ] Word doesn't overflow container
   - [ ] Furigana aligned correctly
   - [ ] Readable on mobile (320px width)

**Pass Criteria:** Long words handled gracefully

---

### 4.4 Offline Mode

**Test Case:** Session works offline

**Steps:**
1. Start session (online)
2. Advance to card 3
3. **Disable network** (DevTools: Offline mode)
4. Click "Next"
5. **Verify:**
   - [ ] Card 4 loads (local data)
   - [ ] No network errors in console
6. Complete session offline
7. **Re-enable network**
8. Wait 10 seconds
9. Check Firestore (premium only)
10. **Verify:** Progress synced after reconnect

**Pass Criteria:** Offline study works, sync resumes when online

---

## Section 5: Backward Compatibility

### 5.1 Legacy Session Resume

**Test Case:** Old session format still works

**Setup:**
1. Manually create old session in localStorage:
   ```json
   {
     "items": [{ "kanji": "日", ... }],
     "currentIndex": 0,
     "startedAt": 1234567890,
     "source": "manual-selection"
   }
   ```
2. Refresh page
3. **Verify:** Session restores OR migrates to new format

**Pass Criteria:** No crash, session usable

---

### 5.2 Pre-Vocabulary Progress

**Test Case:** Kanji learned before vocabulary-first

**Setup:**
1. Load old progress record (no `vocabularySeenCount` field)
2. View kanji in browse mode
3. **Verify:** Badge shows correct status
4. Enter review mode
5. **Verify:** Review card works (fallback readings)

**Pass Criteria:** Old progress still valid

---

## Section 6: Review Mode Integration

### 6.1 Curated Readings in Review

**Test Case:** Review uses vocabulary-exposed readings

**Steps:**
1. Complete vocabulary-first session for "日" (exposed "ひ" and "にち")
2. Add "日" to review queue
3. Start review session
4. **Verify:** Review card for "日" shows:
   - [ ] "ひ" listed first (exposed via vocab)
   - [ ] "にち" listed second
   - [ ] Other readings shown after or hidden

**Pass Criteria:** Review prioritizes exposed readings

---

### 6.2 Review Mode for Legacy Kanji

**Test Case:** Review mode for kanji never studied with vocab-first

**Steps:**
1. Add kanji to review queue (not studied with vocab-first)
2. Start review
3. **Verify:**
   - [ ] Shows default prioritized readings (JMdict fallback)
   - [ ] Review card works normally
   - [ ] No errors about missing vocabulary data

**Pass Criteria:** Review mode backward compatible

---

## Section 7: Performance

### 7.1 Session Load Time

**Test Case:** 50-kanji session generation

**Steps:**
1. Select 50 kanji from N5+N4 levels
2. Click "Study Selected"
3. Start timer
4. **Verify:** Study mode opens within 2 seconds
5. Check DevTools Performance tab
6. **Verify:** No blocking tasks > 500ms

**Pass Criteria:** Large sessions load quickly (<2s for 50 kanji)

---

### 7.2 Vocabulary Lookup Performance

**Test Case:** Uncached lookup speed

**Steps:**
1. Clear browser cache
2. Start session for new kanji (not previously studied)
3. **Verify:** First vocabulary card appears within 1 second
4. Check Network tab
5. **Verify:** JMdict query completes < 500ms

**Pass Criteria:** Vocabulary lookup fast enough for smooth UX

---

## Section 8: Analytics & Monitoring

### 8.1 Event Tracking

**Test Case:** Analytics events fire correctly

**Tools:** DevTools → Network → Filter: `analytics` or check console logs

**Steps:**
1. Start session → **Verify:** `vocabulary_first_session_started` event
2. View vocabulary card → **Verify:** `vocabulary_card_viewed` event
3. Play audio → **Verify:** `vocabulary_audio_played` event
4. Complete session → **Verify:** `vocabulary_first_session_completed` event

**Pass Criteria:** All events tracked with correct parameters

---

### 8.2 Error Monitoring

**Test Case:** Errors reported to monitoring service

**Steps:**
1. Manually trigger error (e.g., corrupt localStorage data)
2. Check Sentry/error monitoring dashboard
3. **Verify:**
   - [ ] Error captured
   - [ ] Stack trace available
   - [ ] User context included (user ID, session ID)

**Pass Criteria:** Errors captured and actionable

---

## Section 9: Feature Flag Testing

### 9.1 Flag Disabled

**Test Case:** Feature hidden when flag off

**Steps:**
1. Disable `vocabulary_first_kanji` flag (settings or remote config)
2. Navigate to Kanji Browser
3. **Verify:**
   - [ ] "Study with Vocabulary" button hidden (or grayed out)
   - [ ] Default study mode still works
4. Manually access URL: `/kanji-browser?mode=vocabulary-first`
5. **Verify:** Redirects to default mode or shows error

**Pass Criteria:** Feature fully disabled when flag off

---

### 9.2 Flag Enabled for Premium Only

**Test Case:** Free users see upgrade prompt

**Steps:**
1. Set flag to `premium_only`
2. Log in with free account
3. Click "Study with Vocabulary"
4. **Verify:** Upgrade modal appears
5. Log in with premium account
6. **Verify:** Feature works

**Pass Criteria:** Entitlement check enforced

---

## Completion Summary

**Total Test Cases:** 39
**Sections:** 9

### Sign-Off

- [ ] All critical tests passed (Sections 1-4)
- [ ] All edge cases handled (Section 5)
- [ ] Mobile + accessibility verified (Section 3)
- [ ] Performance benchmarks met (Section 7)
- [ ] Analytics working (Section 8)
- [ ] Feature flag tested (Section 9)

**QA Lead:** ___________________
**Date:** ___________________
**Build Version:** ___________________

---

**Notes:**
- Failed tests should be documented with screenshots/recordings
- Blockers must be fixed before launch
- Minor issues can be backlog items post-launch

---

**Document Version:** 1.0
**Author:** Agent 6 (Testing & Rollout)
**Last Updated:** 2026-03-24
