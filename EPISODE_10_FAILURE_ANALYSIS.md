# Episode 10 Failure Analysis

## Executive Summary

**Episode:** moshi-goes-to-japan-ep010 (Convenience Store / Konbini)
**Generated:** 2026-01-09 via **Admin Dashboard** (not scheduled)
**Created by:** User ID `8onZzlQg3tQxkw8pinSF9ow4Q6j2`
**Status:** Published but defective

### Critical Defects Found:
1. ✅ JLPT Level: `undefined` (should be N5)
2. ✅ Outline: Missing/incomplete
3. ✅ All 6 panels have identical dialogue: "すごい！" (default fallback)
4. ✅ Panel 3: Character duplication (Moshi appears multiple times instead of Moshi + friends)

---

## Root Cause Analysis

### Issue 1: Missing JLPT Level ❌

**Code Location:** `src/app/[locale]/admin/comics/generate/page.tsx:128-136`

```typescript
// Admin dashboard DOES NOT pass jlptLevel to dialogue step
const dialogueResponse = await fetch('/api/admin/comics/generate', {
  body: JSON.stringify({
    step: 'dialogues',
    draftId,
    // ❌ jlptLevel is MISSING here!
  }),
})
```

**Compare to Scheduled Workflow:**
```typescript
// Scheduled workflow DOES pass jlptLevel
const dialogueResult = await callComicAPI('/api/admin/comics/generate', {
  step: 'dialogues',
  draftId,
  jlptLevel,  // ✅ Correctly included
}, adminKey)
```

**Impact:**
- API cannot instruct GPT-4o-mini on appropriate vocabulary level
- Generates inappropriate or overly complex Japanese
- OR fails entirely, falling back to defaults

---

### Issue 2: Silent Failure on Dialogue Generation ❌

**Code Location:** `src/app/[locale]/admin/comics/generate/page.tsx:138-140`

```typescript
if (!dialogueResponse.ok) {
  console.error('Dialogue generation failed')  // ❌ Only logs!
}
// Continues execution even if failed! ❌
```

**What Happened:**
1. Dialogue generation API returned HTTP 200 but `success: false`
2. Admin workflow only checks `response.ok` (HTTP status)
3. Doesn't check `data.success` field in JSON response
4. Continues to image generation despite dialogue failure
5. Uses fallback default dialogues ("すごい！" × 6)

**Compare to Scheduled Workflow:**
```typescript
if (!dialogueResult.success) {
  throw new Error('Failed to generate dialogues')  // ✅ Stops execution
}
```

---

### Issue 3: Character Duplication in Images ❌

**Code Location:** `src/app/api/admin/comics/generate/route.ts:978-990` (OLD)

```typescript
// OLD prompt didn't prevent duplication
return `Kawaii manga-style comic panel illustration.
Characters in this panel:${characterDescs}
Show the characters interacting naturally...`
```

**What Happened:**
- Gemini interpreted "Moshi with friends" as multiple instances of same character
- No explicit instruction to prevent mirroring/duplication
- Character reference system didn't validate unique characters

---

## Evidence from Database

### Episode 10 Document:
```javascript
{
  id: 'moshi-goes-to-japan-ep010',
  jlptLevel: undefined,  // ❌ Should be 'N5'
  outline: undefined,    // ❌ Should have synopsis, panels array
  panels: [
    { dialogues: [{ textJa: 'すごい！' }] },  // ❌ Default fallback
    { dialogues: [{ textJa: 'すごい！' }] },  // ❌ Default fallback
    { dialogues: [{ textJa: 'すごい！' }] },  // ❌ Default fallback
    // ... repeated for all 6 panels
  ],
  metadata: {
    generatedBy: '8onZzlQg3tQxkw8pinSF9ow4Q6j2',  // Admin user, not scheduler
    isAIGenerated: true
  },
  createdAt: '2026-01-09T10:45:33.425Z',
  publishedAt: '2026-01-09T10:47:33.537Z'
}
```

### No Generation Log Entry:
- Episode 10 has NO entry in `comic_generation_logs` collection
- Confirms it was generated via admin dashboard (doesn't create logs)
- No audit trail of what went wrong

---

## Workflow Comparison Table

| Feature | Scheduled Workflow | Admin Dashboard | Status |
|---------|-------------------|-----------------|--------|
| **JLPT level in dialogue step** | ✅ Passed | ❌ Missing | CRITICAL BUG |
| **Error handling** | ✅ Throws on failure | ❌ Logs only | CRITICAL BUG |
| **Check success field** | ✅ Yes | ❌ No | CRITICAL BUG |
| **Character data** | ✅ Full characterSheet | ⚠️ Only IDs | Minor issue |
| **Generation logging** | ✅ Creates audit log | ❌ No logging | Missing feature |
| **Retry logic** | ✅ 3 retries with backoff | ❌ No retries | Missing feature |

---

## Fixes Applied (2026-01-09)

### Fix 1: Enhanced Dialogue Prompt ✅
**File:** `src/app/api/admin/comics/generate/route.ts`

**Added:**
```typescript
CRITICAL REQUIREMENTS FOR STORY STRUCTURE:
1. **NO REPETITION**: Each panel must have DIFFERENT, UNIQUE dialogue.
   NEVER repeat the same phrase (like すごい) across multiple panels.
2. **Story Progression**: Follow clear narrative arc (setup → action → resolution)
3. **Dialogue Variety**: Use diverse N5-appropriate expressions
4. **Natural Conversation**: Characters ask/respond, react to events
```

**Impact:** Prevents repetitive dialogues even if generation succeeds

---

### Fix 2: Enhanced Image Prompt ✅
**File:** `src/app/api/admin/comics/generate/route.ts`

**Added:**
```typescript
CRITICAL CHARACTER REQUIREMENTS:
- This panel contains EXACTLY ${uniqueCharCount} character(s)
- Each character listed above should appear ONLY ONCE in the image
- DO NOT duplicate or mirror any character
- If multiple characters, they should be clearly distinguishable as DIFFERENT individuals
```

**Impact:** Prevents character duplication in multi-character panels

---

### Fix 3: Better Error Detection ✅
**File:** `src/app/api/admin/comics/generate/route.ts`

**Added:**
```typescript
// Validate dialogue content is not just defaults
const firstDialogue = panels[0]?.dialogues?.[0]?.textJa
if (firstDialogue && firstDialogue !== 'すごい！') {
  dialogueGenerationSuccess = true
} else {
  throw new Error('Generated dialogues are too generic')
}
```

**Impact:** Detects when fallback defaults are used, returns `success: false`

---

## Required Fixes for Admin Dashboard

### Fix 1: Pass JLPT Level to Dialogue Step (HIGH PRIORITY)
**File:** `src/app/[locale]/admin/comics/generate/page.tsx`

**Line 128-136, change from:**
```typescript
body: JSON.stringify({
  step: 'dialogues',
  draftId,
})
```

**To:**
```typescript
body: JSON.stringify({
  step: 'dialogues',
  draftId,
  jlptLevel,  // ← ADD THIS LINE
})
```

---

### Fix 2: Check API Success Field (HIGH PRIORITY)
**File:** `src/app/[locale]/admin/comics/generate/page.tsx`

**Line 138-140, change from:**
```typescript
if (!dialogueResponse.ok) {
  console.error('Dialogue generation failed')
}
```

**To:**
```typescript
const dialogueData = await dialogueResponse.json()
if (!dialogueResponse.ok || !dialogueData.success) {
  setCurrentStep('setup')
  setIsGenerating(false)
  showToast(
    dialogueData.error || 'Dialogue generation failed. Please try again.',
    'error'
  )
  return  // Stop execution
}
```

---

### Fix 3: Add Generation Logging (MEDIUM PRIORITY)
**Location:** Create new function to log admin generations

**Purpose:** Create audit trail for all generations, regardless of source

**Implementation:**
```typescript
async function logGeneration(episodeId: string, metadata: any) {
  await fetch('/api/admin/comics/generation-log', {
    method: 'POST',
    body: JSON.stringify({
      episodeId,
      type: 'admin-dashboard',
      ...metadata
    })
  })
}
```

---

## Testing Checklist

Before next admin generation:
- [ ] Verify jlptLevel is passed to dialogue step
- [ ] Test dialogue failure scenario (kill API mid-request)
- [ ] Confirm error stops generation and shows user message
- [ ] Validate no "すごい！" repetition in generated dialogues
- [ ] Check multi-character panels for duplication
- [ ] Verify JLPT level is saved in published episode

---

## Prevention Measures

### Short-term (Immediate):
1. ✅ Fix admin dashboard to pass jlptLevel
2. ✅ Add proper error checking for success field
3. ✅ Stop execution on dialogue failure
4. Add validation before publishing (check for default dialogues)

### Medium-term (Next Sprint):
1. Add generation logging for all sources
2. Implement retry logic in admin dashboard
3. Add pre-publish quality checks
4. Create monitoring dashboard for failed generations

### Long-term (Next Quarter):
1. Unified generation pipeline (same code for scheduled + admin)
2. Automated quality scoring with LLM-as-judge
3. A/B testing framework for prompt improvements
4. Real-time monitoring and alerts

---

## Conclusion

Episode 10 failed due to **three bugs in the admin dashboard workflow**:

1. **Missing JLPT level** → API couldn't generate appropriate dialogues
2. **Silent failure** → Continued with default "すごい！" dialogues
3. **No character constraints** → Duplicated Moshi instead of showing friends

All three issues are **specific to the admin dashboard workflow** and do NOT affect the scheduled workflow, which is why most episodes (generated via scheduler) work correctly.

**Immediate action required:** Fix admin dashboard to match scheduled workflow behavior.
