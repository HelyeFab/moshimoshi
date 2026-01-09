# Comics Generation: Scheduled vs Admin Workflow Comparison

## Critical Differences Found

### 1. **JLPT Level Handling**

#### Scheduled Workflow ✅
```typescript
// Dialogue step
{
  step: 'dialogues',
  draftId,
  jlptLevel,  // ← Passes JLPT level
}
```

#### Admin Workflow ❌
```typescript
// Dialogue step
{
  step: 'dialogues',
  draftId,  // ← MISSING jlptLevel!
}
```

**Impact:** Without `jlptLevel`, the API cannot properly instruct the model on vocabulary difficulty, resulting in generic or inappropriate dialogues.

---

### 2. **Character Data Passing**

#### Scheduled Workflow ✅
```typescript
// Outline step
{
  characterSheet,  // Full character info (name, personality, speaking style)
  characterRefs,   // Character references with image URLs
}
```

#### Admin Workflow ⚠️
```typescript
// Outline step
{
  characterIds: selectedCharacters,  // Only IDs
}
```

**Impact:** Admin workflow relies on API to load characters from Firestore, which adds latency and potential failure points. Scheduled workflow passes everything upfront.

---

### 3. **Error Handling**

#### Scheduled Workflow ✅
```typescript
const dialogueResult = await callComicAPI(...)

if (!dialogueResult.success) {
  throw new Error('Failed to generate dialogues')  // ← Stops execution
}
```

#### Admin Workflow ❌
```typescript
if (!dialogueResponse.ok) {
  console.error('Dialogue generation failed')  // ← Only logs, continues!
}
```

**Impact:** Admin workflow silently continues after dialogue failure, leading to default "すごい！" dialogues being used.

---

### 4. **API Response Checking**

#### Scheduled Workflow ✅
```typescript
// Uses custom callComicAPIWithRetry wrapper
// Checks both HTTP status AND result.success field
if (result && typeof result.success === 'boolean' && !result.success) {
  throw new Error(errorMsg)
}
```

#### Admin Workflow ❌
```typescript
// Only checks HTTP status
if (!dialogueResponse.ok) {
  // handle error
}
// Doesn't check if JSON response has success: false
```

**Impact:** Admin workflow might treat a failed generation (HTTP 200 but `success: false`) as successful.

---

## Root Cause Analysis

### Why Episode 10 Failed:

1. **Missing JLPT level** in dialogue generation call
2. **Dialogue generation returned success: false** but admin workflow didn't catch it
3. **Fallback to default dialogues** ("すごい！" repeated 6 times)
4. **Process continued** without stopping or alerting

### Character Duplication Issue:

- Image prompt didn't explicitly prevent character mirroring
- Gemini interpreted "show Moshi with friends" as multiple instances of Moshi
- No validation of unique characters in panel

---

## Fixes Applied

### 1. Enhanced Dialogue Prompt
- Added explicit anti-repetition rules
- Provided story structure guidance (setup → action → resolution)
- Included vocabulary variety requirements
- Added example phrases per category

### 2. Enhanced Image Prompt
- Count unique characters per panel
- Explicit instruction: "DO NOT duplicate or mirror any character"
- Specify exact character count expected
- Emphasize UNIQUE visual features

### 3. Better Error Detection
- Validate dialogue content (check for "すごい！" default)
- Flag generation failures explicitly
- Store error status in draft document
- Return warning in API response

---

## Recommended Fixes for Admin Workflow

### Fix 1: Pass JLPT Level to Dialogue Step
```typescript
const dialogueResponse = await fetch('/api/admin/comics/generate', {
  method: 'POST',
  body: JSON.stringify({
    step: 'dialogues',
    draftId,
    jlptLevel,  // ← ADD THIS
  }),
})
```

### Fix 2: Check API Success Field
```typescript
const dialogueData = await dialogueResponse.json()
if (!dialogueResponse.ok || !dialogueData.success) {
  throw new Error(dialogueData.error || 'Failed to generate dialogues')
}
```

### Fix 3: Stop on Dialogue Failure
```typescript
if (!dialogueResponse.ok || !dialogueData.success) {
  setCurrentStep('setup')
  setIsGenerating(false)
  showToast('Dialogue generation failed. Please try again.', 'error')
  return  // ← Stop execution
}
```

---

## Testing Checklist

- [ ] Generate episode via admin dashboard with N5 level
- [ ] Verify jlptLevel is passed to all steps
- [ ] Check dialogue variety (no repeated phrases)
- [ ] Verify character uniqueness in multi-character panels
- [ ] Test error scenarios (API failures)
- [ ] Confirm generation stops on dialogue failure
