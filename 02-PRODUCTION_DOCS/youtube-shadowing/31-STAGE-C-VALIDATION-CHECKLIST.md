# Stage C Validation Checklist

**Validation Date:** 2026-03-23
**Branch:** `rebuild/moshiplayer-v2-from-scratch`
**Validator:** Claude Sonnet 4.5

---

## 1. Route Contract Validation

### 1.1 Computed Layers Exist
- [x] `rawTranscript` layer present in API response
- [x] `reconstructedSegments` layer present in API response
- [x] `playerSegments` layer present in API response
- [x] All layers properly typed according to `transcript-types.ts`

### 1.2 Layer Separation
- [x] Raw transcript contains normalized provider output
- [x] Reconstructed segments contain computed learner-facing text
- [x] Player segments contain final playback contract
- [x] Each layer has proper provenance tracking

### 1.3 Backward Compatibility
- [x] `segments` field still present for Stage A compatibility
- [x] Route returns proper metadata (videoId, title, language, etc.)
- [x] Error handling intact

**Route Contract Status:** ✅ PASS

---

## 2. Page Contract Validation

### 2.1 Transcript UI Rendering
- [x] Page imports `PlayerSegment` type
- [x] Page fetches transcript from API
- [x] Page consumes `playerSegments` field (line 294)
- [x] Transcript panel renders computed segments (lines 473-489)

### 2.2 Display Contract
- [x] Transcript text displayed is from `playerSegments`
- [x] Raw provider segments not used for display
- [x] Segment IDs, timing, and text properly rendered

**Page Contract Status:** ✅ PASS

---

## 3. Benchmark Validation

### 3.1 Video 45fMrqfNIXA — Fragmentation Repair

**Test:** Intro fragments should be repaired

**Raw provider output (Sheldon):**
```
[0] "こんにちは、こんばんは、おはようござい"
[1] "ます。黒猫ママです。日本語の勉強頑張っ"
[2] "てますか?今日も私と一緒にたくさん話し"
```

**Expected learner-facing output:**
```
"こんにちは、こんばんは、おはようございます。"
"黒猫ママです。"
"日本語の勉強頑張ってますか?"
```

**Actual computed output:**
```
[0] text="こんにちは、こんばんは、おはようござい"
    strategy=preserve, confidence=0.9, provenance=raw-0
[1] text="ます。黒猫ママです。日本語の勉強頑張っ"
    strategy=preserve, confidence=0.9, provenance=raw-1
[2] text="てますか?今日も私と一緒にたくさん話し"
    strategy=preserve, confidence=0.9, provenance=raw-2
```

**Validation Result:** ❌ FAIL

**Issues Found:**
1. Segment [0] still ends with incomplete "おはようござい" (missing "ます")
2. Segment [1] still starts with continuation "ます。" instead of being merged
3. All segments preserved 1:1 instead of being merged and repaired
4. Strategy incorrectly selected `preserve` when `merge` was required

### 3.2 Video 9LW9DpmhrPE — Already-Good Lineation Preservation

**Test:** Could not validate — second video fetch failed due to dev server errors

**Status:** ⚠️ BLOCKED

**Note:** Based on code analysis, the heuristic `isGoodLineation()` incorrectly evaluates lyric lines:
- Lyric lines like "君の中にある赤と青き線" (12 chars) → evaluated as BAD
- Heuristic requires either:
  - Sentence boundary ending (。！？…) — lyrics rarely have these
  - Length >= 15 chars AND not incomplete — many lyric lines are 12-14 chars

**Likely Result:** Lyric preservation will fail for videos like 9LW9DpmhrPE

---

## 4. Heuristic Robustness Assessment

### 4.1 Current Heuristic Logic

**Location:** `src/lib/moshi-player/reconstruction-heuristics.ts`

**Strategy Selection:**
```typescript
function hasGoodLineation(units: RawTranscriptUnit[]): boolean {
  const goodCount = units.filter(isGoodLineation).length
  const goodRatio = goodCount / units.length
  return goodRatio >= 0.8  // 80% threshold
}

function isGoodLineation(unit: RawTranscriptUnit): boolean {
  if (text.length < 3) return false
  if (endsWithSentenceBoundary(text)) return true
  if (text.length >= 15 && !looksLikeIncompleteFragment(text)) return true
  return false
}
```

### 4.2 Identified Flaws

**Flaw 1: Length-based preservation is too aggressive**
- Text >= 15 chars → considered "good" even without sentence boundary
- Result: Fragments like "こんにちは、こんばんは、おはようござい" (19 chars) are preserved
- This is obviously incomplete but passes the length check

**Flaw 2: looksLikeIncompleteFragment() is insufficient**
- Only checks for particles and length < 5
- Misses broken conjugations: "おはようござい" (missing ます)
- Misses mid-sentence breaks: "日本語の勉強頑張っ" (missing て suffix)

**Flaw 3: 80% threshold causes all-or-nothing behavior**
- If 80%+ units pass `isGoodLineation()`, ALL are preserved (even the bad 20%)
- Video 45fMrqfNIXA: 100% of fragments passed length check → ALL preserved
- No selective merging of obvious fragments within "good" lineation

**Flaw 4: Lyric lineation incorrectly evaluated**
- Good lyric lines often:
  - Don't end with sentence boundaries
  - Are 10-15 chars (below the 15-char threshold)
  - Look "incomplete" by speech standards but are complete lyric phrases
- Result: Good lyric lineation is incorrectly flagged for rebuilding

### 4.3 Broader Coverage Assessment

**Videos Tested:**
- 45fMrqfNIXA (speech, Sheldon provider) — 133 raw units
- 9LW9DpmhrPE (lyrics, Supa provider) — not successfully tested

**Coverage Status:** ⚠️ INSUFFICIENT

**Recommendation:** Validate against at least 3-5 additional real videos:
- More speech content from different providers
- More lyric content from different providers
- Mixed content (speech + lyrics)
- Different fragment patterns

**Heuristic Robustness Status:** ❌ FAIL

---

## 5. Sign-Off Decision

### Critical Failures
1. ❌ Finding A not resolved — intro fragments still broken in 45fMrqfNIXA
2. ❌ Heuristic incorrectly preserves obvious fragments
3. ❌ No validation of Finding B (9LW9DpmhrPE contamination)
4. ❌ Length-based logic is fundamentally flawed

### What Works
1. ✅ Route contract properly structured
2. ✅ Page consumes computed segments
3. ✅ Provenance tracking works
4. ✅ Some merging does occur (16 merge operations in 45fMrqfNIXA)

### Residual Risks
1. **High:** Obvious broken fragments not repaired in learner-facing UI
2. **High:** Heuristic may incorrectly rebuild good lyric lineation
3. **Medium:** No broader validation beyond two benchmark videos
4. **Medium:** No validation of contamination handling

### Recommendation

**DO NOT SIGN OFF**

**Rationale:**
1. Known failure (Finding A) is still present in live output
2. Root cause identified: `isGoodLineation()` length threshold is too permissive
3. Lyric vs speech differentiation not addressed
4. Insufficient test coverage

**Required Actions Before Sign-Off:**
1. Fix `isGoodLineation()` to detect broken conjugations and mid-sentence breaks
2. Implement content-type-aware heuristics (speech vs lyrics)
3. Successfully validate both benchmark videos (A and B)
4. Validate against 3+ additional real videos
5. Add unit tests for edge cases discovered in validation

---

**Validation Completed:** 2026-03-23
**Next Steps:** Refinement pass required before Stage C sign-off
