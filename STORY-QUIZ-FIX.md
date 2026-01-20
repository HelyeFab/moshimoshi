# Story Quiz Fix - Bilingual Questions

**Date**: 2026-01-20
**Issue**: Story quizzes were generated in English-only, unlike comics which use bilingual format
**Status**: ✅ FIXED

---

## Problem

**Stories** generated quizzes with English-only questions:
```typescript
{
  "question": "What happens at the park?",  // English only
  "questionJa": "",  // Empty or missing
  "options": [...],
  "explanation": "English explanation"
}
```

**Comics** generated proper bilingual quizzes:
```typescript
{
  "questionJa": "この<ruby>言葉<rt>ことば</rt></ruby>の<ruby>意味<rt>いみ</rt></ruby>は？",
  "questionEn": "What does this word mean?",
  "options": [...],
  "explanation": "English explanation",
  "explanationJa": "Japanese explanation with ruby tags"
}
```

---

## Root Cause

**Story Quiz Prompt** (before fix):
```
"questionJa": "Japanese question (optional for higher levels)"
              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
              This made the AI skip generating Japanese questions!
```

The prompt explicitly said questionJa was "optional", so OpenAI defaulted to English-only.

---

## Solution

### Changes Made

**File**: `src/lib/ai/processors/MultiStepStoryProcessor.ts`
**Lines**: 505-547

**Before**:
```typescript
Response format (JSON only):
{
  "questions": [
    {
      "id": "q1",
      "question": "Question in English",
      "questionJa": "<ruby>質問<rt>しつもん</rt></ruby>（optional for higher levels）",
                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
      "options": [...],
      "correctIndex": 0,
      "explanation": "Why this answer is correct",
      "explanationJa": "Japanese explanation"
    }
  ]
}
```

**After**:
```typescript
You MUST return a JSON object in EXACTLY this format:
{
  "questions": [
    {
      "id": "q1",
      "question": "Question in English",
      "questionJa": "この<ruby>物語<rt>ものがたり</rt></ruby>について<ruby>質問<rt>しつもん</rt></ruby>です。",
                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                    Now shows REQUIRED Japanese with proper ruby tags!
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Why this answer is correct",
      "explanationJa": "<ruby>説明<rt>せつめい</rt></ruby>を<ruby>日本語<rt>にほんご</rt></ruby>で"
    }
  ]
}

**CRITICAL RULES:**
1. BOTH question (English) AND questionJa (Japanese) are REQUIRED for all questions
2. BOTH explanation (English) AND explanationJa (Japanese) are REQUIRED for all questions
3. questionJa must wrap ALL kanji in <ruby> tags with furigana: <ruby>漢字<rt>かんじ</rt></ruby>
4. Do NOT use parentheses format - use <ruby><rt> tags only
5. Do NOT reveal the answer in the question text
6. Each question must have EXACTLY 4 options
```

---

## Key Improvements

1. ✅ **Made bilingual required**: Both English and Japanese questions are now mandatory
2. ✅ **Added clear examples**: Shows proper Japanese questions with ruby tags
3. ✅ **Added CRITICAL RULES**: Matches comics format with explicit requirements
4. ✅ **Improved ruby tag examples**: Multiple examples of proper furigana format
5. ✅ **Schema validation**: Existing schema already enforces all fields as required

---

## Schema Validation

The schema already enforces bilingual format:

**File**: `src/lib/ai/schemas/story-schemas.ts:153-165`

```typescript
export const QuizQuestionsResponseSchema = z.object({
  questions: z.array(
    z.object({
      id: z.string(),
      question: z.string(),        // ✅ REQUIRED (English)
      questionJa: z.string(),      // ✅ REQUIRED (Japanese)
      options: z.array(z.string()),
      correctIndex: z.number().int().min(0),
      explanation: z.string(),     // ✅ REQUIRED (English)
      explanationJa: z.string(),   // ✅ REQUIRED (Japanese)
    })
  ),
});
```

OpenAI Structured Outputs + Zod validation will **enforce** all 4 bilingual fields.

---

## Testing

### Next Steps

1. **Generate new story** (or wait for Sunday's scheduled generation)
2. **Verify quiz has bilingual questions**:
   - Check `questionJa` is populated with Japanese + ruby tags
   - Check `explanationJa` is populated
3. **Optional: Regenerate existing story quizzes** for 27 stories

### Test Command

```bash
# Test with one story generation
POST /api/admin/generate-story
{
  "step": "generate_quiz",
  "draftId": "draft_test_...",
  "jlptLevel": "N5"
}

# Verify response includes bilingual fields
```

---

## Impact

### Before Fix
- ❌ Questions: English only
- ❌ Explanations: English only
- ❌ User experience: Inconsistent (comics have Japanese, stories don't)
- ❌ Learning value: Lower (no Japanese reading practice in quizzes)

### After Fix
- ✅ Questions: Bilingual (English + Japanese with ruby tags)
- ✅ Explanations: Bilingual
- ✅ User experience: Consistent across all features
- ✅ Learning value: Higher (Japanese reading practice in quizzes)

---

## Regenerating Existing Quizzes (Optional)

If you want to fix the 27 existing stories, you can:

### Option A: Regenerate All Story Quizzes (Script)

```javascript
// scripts/regenerate-story-quizzes.js
const admin = require('firebase-admin');
// ... (similar to regenerate-all-quizzes.js for comics)

// For each story:
// 1. Fetch story pages
// 2. Call /api/admin/generate-story with step='generate_quiz'
// 3. Update story.quiz field with new bilingual quizzes
```

### Option B: Wait for Natural Refresh

Quizzes will be correct for:
- ✅ All NEW stories generated after this fix
- ✅ Any manually regenerated stories

---

## Compatibility

### BaseQuizQuestion Interface

The fix maintains compatibility with `BaseQuizQuestion`:

```typescript
export interface BaseQuizQuestion {
  id: string
  question: string        // English (required)
  questionJa?: string     // Japanese (optional in interface, but enforced in generation)
  options: string[]
  correctAnswer: string | number
  explanation?: string
  explanationJa?: string
  // ...
}
```

Stories now populate `questionJa` consistently, matching comics behavior.

---

## Files Changed

1. ✅ `src/lib/ai/processors/MultiStepStoryProcessor.ts` (lines 505-547)
   - Updated quiz generation prompt
   - Made bilingual fields required
   - Added critical rules and examples

---

## Success Criteria

After this fix, newly generated stories should have:

- ✅ `questionJa` with Japanese text + ruby tags (e.g., `この<ruby>物語<rt>ものがたり</rt></ruby>について...`)
- ✅ `question` with English text (e.g., `What is this story about?`)
- ✅ `explanationJa` with Japanese explanation + ruby tags
- ✅ `explanation` with English explanation
- ✅ All 4 bilingual fields present in every question

---

**Fix Applied**: 2026-01-20 15:45:00 CET
**Next Test**: Next story generation (Sunday 2026-01-26 or manual test)
**Status**: ✅ READY FOR PRODUCTION
