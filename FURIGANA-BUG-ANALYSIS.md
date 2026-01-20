# Furigana Bug - Root Cause Analysis

**Date**: 2026-01-20
**Affected Stories**: 18 out of 27 (67%)
**Severity**: High - User-facing display issue

---

## Executive Summary

A significant bug affects 18 out of 27 published stories where the `textWithFurigana` field is missing or incorrectly formatted. This causes the frontend to display parenthetical furigana `陸（りく）` instead of properly formatted HTML ruby tags `<ruby>陸<rt>りく</rt></ruby>`.

---

## The Problem

### Symptoms
1. Missing `textWithFurigana` field in story pages
2. `text` field contains parenthetical furigana `陸（りく）` instead of plain text
3. Frontend displays raw parenthetical format instead of furigana overlays

### Example (Story: story_1768694424281_scheduler-system)
**Page 3 Data:**
```javascript
{
  text: "陸（りく）と愛子（あいこ）は公園（こうえん）で武（たけし）に会（あ）いました。...",
  textWithFurigana: undefined,  // MISSING!
  pageNumber: 3,
  audioUrl: "...",
  imageUrl: "..."
}
```

**Expected:**
```javascript
{
  text: "陸と愛子は公園で武に会いました。...",  // Plain Japanese
  textWithFurigana: "<ruby>陸<rt>りく</rt></ruby>と<ruby>愛子<rt>あいこ</rt></ruby>...",
  pageNumber: 3
}
```

---

## Root Cause Investigation

### 1. Schema Configuration ✅ CORRECT

**File**: `src/lib/ai/schemas/story-schemas.ts:39-53`

```typescript
export const StoryPageSchema = z.object({
  pageNumber: z.number().int().positive(),
  text: z.string().min(1),
  textWithFurigana: z.string().min(1),  // ✅ REQUIRED
  translation: z.string().min(1),
  imagePrompt: z.string(),
  vocabularyNotes: z.array(z.object({
    word: z.string(),
    note: z.string(),
  })),
  grammarNotes: z.array(z.object({
    pattern: z.string(),
    explanation: z.string(),
  })),
});
```

**Status**: Schema is CORRECT. `textWithFurigana` is required (no `.optional()`).

### 2. Validation Function ✅ CORRECT

**File**: `src/lib/ai/schemas/index.ts:290-305`

```typescript
export function validateAIResponse<T>(
  schema: z.ZodSchema<T>,
  response: unknown,
  context?: string
): T {
  const result = schema.safeParse(response);

  if (!result.success) {
    const errors = formatZodErrors(result.error);
    console.error(`[AI Validation] Schema validation failed${context ? ` for ${context}` : ''}:`, errors);
    console.error('[AI Validation] Received:', JSON.stringify(response, null, 2).substring(0, 500));
    throw new Error(`AI response validation failed: ${errors}`);  // ✅ THROWS
  }

  return result.data;
}
```

**Status**: Validation DOES throw errors on failure.

### 3. Structured Outputs Implementation ✅ CORRECT

**File**: `src/lib/ai/processors/BaseProcessor.ts:216-289`

```typescript
protected async callOpenAIWithSchema<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodSchema<T>,
  schemaName: string,
  config?: Partial<AIServiceConfig>
): Promise<{ data: T; usage: TokenUsage; requestId?: string }> {
  // ...
  const completion = await this.openai.chat.completions.create({
    model: this.context.model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: mergedConfig.temperature,
    max_tokens: mergedConfig.maxTokens,
    response_format: zodResponseFormat(schema, schemaName)  // ✅ STRUCTURED OUTPUTS
  });

  const response = completion.choices[0]?.message?.content;
  const parsed = JSON.parse(response);
  const validated = validateAIResponse(schema, parsed, schemaName);  // ✅ VALIDATED

  return { data: validated, usage, requestId: completion.id };
}
```

**Status**: Implementation is CORRECT. Uses OpenAI Structured Outputs + Zod validation.

### 4. Generation Prompt ✅ CORRECT

**File**: `src/lib/ai/processors/MultiStepStoryProcessor.ts:452-467`

```typescript
const userPrompt = `Generate page ${pageNumber} of the Japanese learning story:
...
Response format (JSON only):
{
  "pageNumber": ${pageNumber},
  "text": "Japanese text for the page (plain text, no furigana)",  // ✅ PLAIN
  "textWithFurigana": "Same text but with furigana in HTML ruby tags <ruby>漢字<rt>かんじ</rt></ruby>",  // ✅ RUBY TAGS
  "translation": "Natural English translation",
  "vocabularyNotes": { ... },
  "grammarNotes": { ... },
  "imagePrompt": "..."
}`;
```

**Status**: Prompt is CLEAR and CORRECT.

### 5. Generation Logs ❌ SUSPICIOUS

**Firestore Collection**: `story_generation_logs`

**Log for story_1768694424281_scheduler-system:**
```json
{
  "type": "scheduled",
  "success": true,  // ❌ Logged as SUCCESS despite missing field!
  "storyId": "story_1768694424281_scheduler-system",
  "draftId": "draft_1768694424281_scheduler-system",
  "theme": "Making Friends",
  "jlptLevel": "N5",
  "pageCount": 3,
  "imagesGenerated": 3,
  "imagesFailed": 0,
  "duration": 593711,
  "createdAt": { "_seconds": 1768695000 }
}
```

**Status**: ❌ Generation logged as successful, NO errors recorded. This is the smoking gun.

### 6. Schema Change Timeline

**Git History:**
```
2026-01-11 58f0b0a0 Fix OpenAI Structured Outputs: Replace z.record() with arrays
2026-01-11 3eb52912 Remove .passthrough() from all schemas for OpenAI Structured Outputs compatibility
2026-01-11 405486fd Remove .default() from all schema fields - make all required
```

**Problematic Story Generated**: 2026-01-18 (7 days AFTER schema fixes)

**Status**: ✅ Schema was correct at generation time.

---

## Hypothesis: Why Validation Didn't Catch This

### Theory 1: Deployment Lag ⚠️ LIKELY
The Firebase Cloud Functions might be running an OLDER version of the code that:
- Had `.passthrough()` in schemas (allowing missing fields to pass)
- Or had `.optional()` fields
- Or lacked proper validation

**Evidence**:
- Schema changes on 2026-01-11 (multiple commits)
- Story generated 2026-01-18
- But Cloud Functions may not have been redeployed

### Theory 2: OpenAI Structured Outputs Bug ⚠️ POSSIBLE
OpenAI's Structured Outputs might have a bug where it:
- Silently omits required fields
- Returns malformed data that passes JSON parsing but fails semantic validation
- Especially with complex nested structures (vocabularyNotes, grammarNotes)

### Theory 3: Error Swallowing ⚠️ LESS LIKELY
There might be a try-catch somewhere that:
- Catches validation errors silently
- Falls back to partial data
- Logs success despite failures

**BUT**: The generation API (`/api/admin/generate-story/route.ts:205-207`) DOES throw on error:
```typescript
if (!response.success || !response.data) {
  throw new Error(response.error || 'Failed to generate page')
}
```

---

## Impact Assessment

### Affected Stories
- **Total Stories**: 27
- **Stories with Issues**: 18 (67%)
- **Issue Types**:
  - Missing `textWithFurigana`: 18 stories
  - Parenthetical format in `text`: Varies by page (only later pages)

### User Experience Impact
- ❌ Furigana displays as raw parentheses `陸（りく）`
- ❌ Cannot toggle furigana on/off properly
- ❌ Reading experience degraded for learners
- ✅ Translation still works
- ✅ Audio still works

### SEO/Content Integrity
- ⚠️ No SEO impact (furigana is visual only)
- ⚠️ Content is still readable but not optimal
- ✅ Story progression unaffected

---

## Fix Strategy

### Immediate: Repair Script ✅ CREATED
**File**: `scripts/repair-story-furigana.js`

**What it does**:
1. Scans all 27 stories
2. Identifies pages with missing/malformed furigana
3. Converts parenthetical `陸（りく）` → ruby tags `<ruby>陸<rt>りく</rt></ruby>`
4. Separates plain text from furigana text
5. Updates Firestore with corrected data

**Usage**:
```bash
# Dry run (analyze only)
node scripts/repair-story-furigana.js

# Actually repair
node scripts/repair-story-furigana.js --repair
```

### Short-term: Prevent Future Issues

1. **Add Post-Generation Validation**
   - Verify `textWithFurigana` presence before saving
   - Check for parenthetical format in `text` field
   - Throw clear error if validation fails

2. **Redeploy Firebase Functions**
   - Ensure latest schema version is deployed
   - Verify Cloud Functions are using updated code
   - Add version logging to track deployments

3. **Add Schema Version Tracking**
   - Tag schemas with version numbers
   - Log schema version in generation logs
   - Alert on version mismatches

### Long-term: Systemic Improvements

1. **Stricter Validation in Publish Route**
   - Don't fall back to `page.text` if `textWithFurigana` missing
   - Reject malformed stories before publishing
   - Add validation step before publishing

2. **Enhanced Error Logging**
   - Log validation failures to dedicated collection
   - Alert on schema mismatches
   - Track OpenAI Structured Outputs failures

3. **Automated Testing**
   - Add E2E tests for story generation
   - Validate furigana format in tests
   - Test schema enforcement

4. **Monitoring**
   - Dashboard for generation failures
   - Alert on missing fields
   - Track schema version across environments

---

## Questions for Investigation

1. ❓ **When was the last Firebase Functions deployment?**
   - Check `firebase deploy --only functions:scheduledStoryGeneratorFunction`
   - Verify deployed code matches current codebase

2. ❓ **Did OpenAI Structured Outputs actually return the missing field?**
   - Add logging to capture raw OpenAI response
   - Check if field is stripped during processing

3. ❓ **Are there any other code paths that skip validation?**
   - Audit all places where story pages are created
   - Check for fallback logic that bypasses validation

4. ❓ **Why did the publish-draft route NOT save `textWithFurigana`?**
   - Line 124: `textWithFurigana: page.textWithFurigana || page.textJa || page.text || ''`
   - This should have used `page.text` as fallback
   - But final story has NO `textWithFurigana` field at all
   - Possible: Field was filtered out during Firestore write (undefined values)

---

## Next Steps

### Before Making Changes - Need Approval On:

1. **Run repair script on all 18 affected stories?**
   - Will modify production data
   - Adds `textWithFurigana` field with ruby tags
   - Cleans up `text` field to remove parentheses

2. **Add stricter validation to prevent this?**
   - Will reject stories with missing fields
   - May cause generation failures
   - Requires retry logic

3. **Redeploy Firebase Functions?**
   - Ensures latest schema is used
   - May disrupt ongoing generations
   - Requires coordination

4. **Investigate OpenAI Structured Outputs behavior?**
   - Add debug logging
   - Capture raw responses
   - May require contacting OpenAI support

---

## Files Referenced

### Core Files
- `src/lib/ai/schemas/story-schemas.ts:39-53` - Schema definition
- `src/lib/ai/processors/MultiStepStoryProcessor.ts:414-489` - Page generation
- `src/lib/ai/processors/BaseProcessor.ts:216-289` - Structured outputs
- `src/app/api/admin/generate-story/route.ts:169-229` - API endpoint
- `src/app/api/admin/stories/publish-draft/route.ts:117-135` - Publishing logic

### Repair Tools
- `scripts/repair-story-furigana.js` - Repair script (created)
- `scripts/check-page-content.js` - Diagnostic script (created)
- `scripts/check-generation-errors.js` - Error log checker (created)

### Scheduler
- `functions/src/scheduled/storyScheduler.ts` - Automated generation

---

**Report compiled**: 2026-01-20
**Analyst**: Claude Code
**Status**: Awaiting approval for repairs and preventive measures
