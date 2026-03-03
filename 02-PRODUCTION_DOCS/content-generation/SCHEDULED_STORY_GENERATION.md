# Scheduled Story Generation - Technical Onboarding Guide

> **Document Version:** 1.4.0
> **Last Updated:** 2026-02-27
> **Author:** Technical Lead
> **Status:** Production System (Verified)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Complete Generation Flow](#3-complete-generation-flow)
   - 3.1 Step-by-Step Pipeline
   - 3.2 Detailed Flow Diagram
   - 3.3 Data Flow Per Step
4. [AI Providers & Services](#4-ai-providers--services)
   - 4.1 OpenAI (GPT-4o-mini)
   - 4.2 Gemini/Imagen
   - 4.3 VOICEVOX (Modal)
   - 4.4 Qwen 2.5 32B (Modal Ollama)
5. [File Reference Map](#5-file-reference-map)
6. [Firestore Collections](#6-firestore-collections)
7. [Modal Services](#7-modal-services)
8. [Scheduler Configuration](#8-scheduler-configuration)
   - 8.1 Schedule
   - 8.2 Resource Allocation
   - 8.3 Theme Selection
   - 8.4 Automation Control (Feature Flag)
9. [Error Handling & Recovery](#9-error-handling--recovery)
10. [Known Issues & Fixes](#10-known-issues--fixes)
    - 10.1 Audio Endpoint Overwrites Pages (FIXED & VERIFIED 2026-01-25)
    - 10.2 Validation Error Messages
    - 10.3 Impact Analysis: Word Prefetch System
11. [Debugging Guide](#11-debugging-guide)
12. [Common Operations](#12-common-operations)
   - 12.1 Manually Trigger Story Generation
   - 12.2 Repair a Failed Draft
   - 12.3 Force Retry Pending Drafts
   - 12.4 Delete a Failed Draft
   - 12.5 Pause/Resume Scheduled Story Automation
13. [Related Systems](#13-related-systems)
    - 13.1 Word Prefetch Integration
    - 13.2 EnhancedArticleReaderFinal
    - 13.3 WordExplanationModal

---

## 1. Executive Summary

The Scheduled Story Generation system automatically creates Japanese learning stories on a weekly basis. It's a **multi-step pipeline** that orchestrates multiple AI services:

- **OpenAI (GPT-4o-mini)**: Text generation (characters, outline, pages, quiz)
- **Gemini/Imagen**: Image generation (model sheets, page illustrations)
- **VOICEVOX (Modal)**: Japanese text-to-speech audio
- **Qwen 2.5 32B (Modal Ollama)**: Post-processing (sentence translations, word explanations)

**Key Architecture Decision:** The system uses a **Cloud Function scheduler** that calls **Next.js API endpoints** on Vercel. This separation allows independent scaling and deployment.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SCHEDULED STORY GENERATION                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐         ┌──────────────────────────────────────────┐ │
│  │  Firebase Cloud  │         │           Vercel (Next.js)               │ │
│  │    Functions     │  HTTP   │                                          │ │
│  │                  │ ──────► │  /api/admin/generate-story               │ │
│  │  storyScheduler  │         │  /api/admin/generate-story-audio         │ │
│  │  (Cron: Sun 00:00)         │  /api/admin/stories/publish-draft        │ │
│  └────────┬─────────┘         └──────────────┬───────────────────────────┘ │
│           │                                  │                             │
│           │                                  ▼                             │
│           │                   ┌──────────────────────────────────────────┐ │
│           │                   │           AI Services                    │ │
│           │                   │                                          │ │
│           │                   │  ┌─────────┐  ┌─────────┐  ┌──────────┐ │ │
│           │                   │  │ OpenAI  │  │ Gemini  │  │  Modal   │ │ │
│           │                   │  │GPT-4o-  │  │ Imagen  │  │(VOICEVOX)│ │ │
│           │                   │  │  mini   │  │         │  │(Qwen2.5) │ │ │
│           │                   │  └─────────┘  └─────────┘  └──────────┘ │ │
│           │                   └──────────────────────────────────────────┘ │
│           │                                                                │
│           ▼                                                                │
│  ┌──────────────────┐                                                      │
│  │    Firestore     │                                                      │
│  │                  │                                                      │
│  │  ai_story_drafts │  ◄── Generation progress & checkpoints               │
│  │  stories         │  ◄── Published stories                               │
│  │  story_word_...  │  ◄── Word explanations (async)                       │
│  └──────────────────┘                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Complete Generation Flow

### 3.1 Step-by-Step Pipeline

| Step | Name | AI Provider | Processor | Output |
|------|------|-------------|-----------|--------|
| 1 | Character Sheet | **OpenAI** (gpt-4o-mini) | MultiStepStoryProcessor | Main character, supporting characters, setting, visual style |
| 2 | Outline | **OpenAI** (gpt-4o-mini) | MultiStepStoryProcessor | Page summaries, vocabulary, grammar points |
| 3 | Pages | **OpenAI** (gpt-4o-mini) | MultiStepStoryProcessor | `text`, `textWithFurigana`, `translation`, `imagePrompt` |
| 4 | Quiz | **OpenAI** (gpt-4o-mini) | MultiStepStoryProcessor | 5-8 comprehension questions (bilingual) |
| 5 | Model Sheet | **OpenAI** → **Gemini** | MultiStepStoryProcessor → GeminiImageProcessor | Character reference image for consistency |
| 6 | Page Images | **OpenAI** → **Gemini** | MultiStepStoryProcessor → GeminiImageProcessor | Illustration for each page |
| 7 | Audio | **VOICEVOX** (Modal) | generate-story-audio endpoint | Full story + per-page MP3 files |
| 8 | Sentence Pre-gen | **Qwen 2.5** (Modal Ollama) | sentencePreGenerator | Individual sentence audio + translations |
| 9 | Word Explanations | **Qwen 2.5** (Modal Ollama) | storyWordExplanationPreGenerator | Vocabulary explanations (async via Pub/Sub) |
| 10 | Publish | N/A | publish-draft endpoint | Validates & moves draft → stories collection |

### 3.2 Detailed Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        STORY GENERATION PIPELINE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SCHEDULER (Firebase Cloud Function)                                        │
│  ════════════════════════════════════                                       │
│                                                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                   │
│  │   Select    │     │   Check     │     │   Create    │                   │
│  │   Theme     │────►│  Incomplete │────►│    Draft    │                   │
│  │  + Level    │     │   Drafts    │     │  Document   │                   │
│  └─────────────┘     └─────────────┘     └──────┬──────┘                   │
│                                                  │                          │
│  ┌───────────────────────────────────────────────┼──────────────────────┐  │
│  │                    API CALLS (via HTTP)       │                      │  │
│  │                                               ▼                      │  │
│  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                │  │
│  │  │   Step 1    │   │   Step 2    │   │   Step 3    │                │  │
│  │  │  Character  │──►│   Outline   │──►│   Pages     │                │  │
│  │  │   Sheet     │   │             │   │  (loop 1-N) │                │  │
│  │  │  [OpenAI]   │   │  [OpenAI]   │   │  [OpenAI]   │                │  │
│  │  └─────────────┘   └─────────────┘   └──────┬──────┘                │  │
│  │                                              │                       │  │
│  │  ┌─────────────┐   ┌─────────────┐   ┌──────▼──────┐                │  │
│  │  │   Step 4    │   │   Step 5    │   │   Step 6    │                │  │
│  │  │    Quiz     │◄──│ Model Sheet │◄──│ Page Images │                │  │
│  │  │  [OpenAI]   │   │[OpenAI+Gem] │   │  (parallel) │                │  │
│  │  │             │   │             │   │  [Gemini]   │                │  │
│  │  └──────┬──────┘   └─────────────┘   └─────────────┘                │  │
│  │         │                                                            │  │
│  │  ┌──────▼──────┐   ┌─────────────┐   ┌─────────────┐                │  │
│  │  │   Step 7    │   │   Step 8    │   │   Step 9    │                │  │
│  │  │   Audio     │──►│  Sentence   │──►│    Word     │                │  │
│  │  │ [VOICEVOX]  │   │  Pre-gen    │   │ Explanations│                │  │
│  │  │             │   │  [Qwen2.5]  │   │  [Qwen2.5]  │                │  │
│  │  └─────────────┘   └─────────────┘   └──────┬──────┘                │  │
│  │                                              │                       │  │
│  └──────────────────────────────────────────────┼───────────────────────┘  │
│                                                  │                          │
│  ┌──────────────────────────────────────────────▼──────────────────────┐   │
│  │                         Step 10: PUBLISH                            │   │
│  │                                                                     │   │
│  │  1. Validate all pages have: text, textWithFurigana, translation   │   │
│  │  2. Validate quiz has bilingual fields                              │   │
│  │  3. Move draft → stories collection                                 │   │
│  │  4. Delete ai_story_drafts document                                 │   │
│  │  5. Trigger async word explanation generation                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Data Flow Per Step

#### Step 3: Page Generation (Critical Step)

```
INPUT:
├── characterSheet (from Step 1)
├── outline (from Step 2)
├── pageNumber (1, 2, 3...)
└── jlptLevel (N5, N4, N3, N2, N1)

PROCESSOR: MultiStepStoryProcessor.generatePage()
├── Uses: callOpenAIWithSchema()
├── Schema: StoryPageSchema (Zod)
└── Structured Outputs: GUARANTEED field presence

OUTPUT (StoryPage):
├── pageNumber: number
├── text: string              ← Japanese text (plain)
├── textWithFurigana: string  ← With <ruby> tags
├── translation: string       ← English translation
├── imagePrompt: string       ← For Gemini
├── vocabularyNotes: array
└── grammarNotes: array
```

#### Step 7: Audio Generation (Where Bug Occurred)

```
INPUT (from scheduler):
├── storyId (draftId)
├── pages: [{ pageNumber, text }]  ← MINIMAL DATA ONLY!
└── voice: '23' (default)

PROCESSOR: /api/admin/generate-story-audio

FLOW:
1. Generate audio via VOICEVOX (Modal)
2. Upload to Firebase Storage
3. Update Firestore with audioUrl

⚠️ BUG (FIXED 2026-01-25):
   Old code overwrote full pages array with minimal data
   New code reads existing pages and only adds audioUrl

OUTPUT:
├── fullAudioUrl: string
└── pages[].audioUrl: string (per page)
```

---

## 4. AI Providers & Services

### 4.1 OpenAI (GPT-4o-mini)

**Used for:** Text generation (Steps 1-6 prompts)

**Configuration:**
```typescript
// src/lib/ai/AIService.ts
model: 'gpt-4o-mini'
temperature: 0.7
maxTokens: 4000
timeout: 30000ms
```

**Key Feature:** OpenAI Structured Outputs via `zodResponseFormat()`
- Guarantees response matches Zod schema
- Used in `BaseProcessor.callOpenAIWithSchema()`

**Files:**
- `src/lib/ai/processors/BaseProcessor.ts` (lines 215-289)
- `src/lib/ai/processors/MultiStepStoryProcessor.ts`

### 4.2 Gemini/Imagen

**Used for:** Image generation (Steps 5-6)

**Configuration:**
```typescript
// src/lib/ai/config/providers.ts
model: 'gemini-2.5-flash-image'
timeout: 60000ms
```

**Features:**
- Free tier: 15 requests/minute, 1500/day
- Character consistency via reference images

**Files:**
- `src/lib/ai/processors/GeminiImageProcessor.ts`

### 4.3 VOICEVOX (Modal)

**Used for:** Japanese TTS audio (Step 7)

**Endpoint:**
```
https://emmanuelfabiani23--voicevox-tts-serve.modal.run/v1/audio/speech
```

**Voices Available:**
| ID | Name | Description |
|----|------|-------------|
| 23 | Energetic Female | Default voice |
| 11 | Nemo (玄野武宏) | Natural female |
| 3 | Zundamon (ずんだもん) | Cute mascot |
| 1 | Metan (四国めたん) | Gentle female |
| 13 | Ryusei (青山龍星) | Male voice |

**Files:**
- `src/app/api/admin/generate-story-audio/route.ts`

### 4.4 Qwen 2.5 32B (Modal Ollama)

**Used for:** Post-processing (Steps 8-9)

**Endpoint:**
```
https://emmanuelfabiani23--ollama-llm-ollamallm-serve.modal.run/v1/chat/completions
```

**Configuration:**
```typescript
// src/lib/ai/config/providers.ts
model: 'qwen2.5:32b'
timeout: 300000ms (5 minutes)
```

**Features:**
- $0 cost (self-hosted on Modal)
- Excellent Japanese language support
- Used for translations and word explanations

**Files:**
- `functions/src/utils/storyWordExplanationPreGenerator.ts`
- `functions/src/utils/sentencePreGenerator.ts`
- `src/lib/ai/utils/transcriptTranslationGenerator.ts`

---

## 5. File Reference Map

### 5.1 Scheduler (Firebase Cloud Functions)

| File | Purpose | Key Lines |
|------|---------|-----------|
| `functions/src/scheduled/storyScheduler.ts` | Main scheduler + orchestration | 1-1403 |
| Line 40 | APP_URL configuration | `const APP_URL = process.env.NEXT_PUBLIC_APP_URL \|\| 'https://moshimoshi.app'` |
| Line 82-98 | Theme rotation (15 themes) | `STORY_THEMES` array |
| Line 100-103 | JLPT level distribution | N5=37.5%, N4=25%, N3/N2/N1=12.5% each |
| Line 1151 | Scheduled function definition | `scheduledStoryGeneratorFunction` |
| Line 1332 | Daily retry scheduler | `dailyStoryRetryScheduler` |

### 5.2 API Routes (Next.js/Vercel)

| File | Purpose | Key Lines |
|------|---------|-----------|
| `src/app/api/admin/generate-story/route.ts` | Multi-step generation endpoint | 1-762 |
| Line 66-110 | Step: character_sheet | |
| Line 113-166 | Step: outline | |
| Line 169-229 | Step: generate_page | |
| Line 232-284 | Step: generate_quiz | |
| Line 287-422 | Step: generate_model_sheet | |
| Line 425-639 | Step: generate_page_image | |
| Line 642-743 | Step: generate_audio | |
| `src/app/api/admin/generate-story-audio/route.ts` | Audio generation | 1-385 |
| `src/app/api/admin/stories/publish-draft/route.ts` | Draft validation & publishing | 1-335 |

### 5.3 AI Processors

| File | Purpose | Key Lines |
|------|---------|-----------|
| `src/lib/ai/AIService.ts` | Main AI orchestrator (singleton) | 1-672 |
| Line 345-347 | Routes to MultiStepStoryProcessor | |
| `src/lib/ai/processors/BaseProcessor.ts` | Base class with OpenAI methods | 1-502 |
| Line 215-289 | `callOpenAIWithSchema()` - structured outputs | |
| `src/lib/ai/processors/MultiStepStoryProcessor.ts` | Multi-step story generation | 1-767 |
| Line 414-489 | `generatePage()` method | |
| `src/lib/ai/processors/GeminiImageProcessor.ts` | Image generation | |

### 5.4 Schemas

| File | Purpose |
|------|---------|
| `src/lib/ai/schemas/story-schemas.ts` | Zod schemas for story generation |
| `StoryPageSchema` | Page validation (text, textWithFurigana, translation required) |
| `CharacterSheetSchema` | Character sheet validation |
| `StoryOutlineSchema` | Outline validation |
| `QuizQuestionsResponseSchema` | Quiz validation |

### 5.5 Configuration

| File | Purpose |
|------|---------|
| `src/lib/ai/config/providers.ts` | AI provider routing configuration |
| `src/lib/ai/types.ts` | TypeScript type definitions |

---

## 6. Firestore Collections

### 6.1 Collection Schema

```
Firestore
├── ai_story_drafts/
│   └── {draftId}
│       ├── characterSheet: object
│       ├── outline: object
│       ├── pages: array<StoryPage>
│       ├── quiz: array<QuizQuestion>
│       ├── theme: string
│       ├── jlptLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
│       ├── pageCount: number
│       ├── status: 'character_created' | 'outline_created' | ... | 'complete'
│       ├── checkpoint: {
│       │   lastCompletedStep: string
│       │   lastCompletedIndex?: number
│       │   failedAttempts: number
│       │   lastAttemptAt: Timestamp
│       │   lastError?: string
│       │ }
│       ├── modelSheet: { prompt, imageUrl, characterId }
│       ├── fullAudioUrl?: string
│       ├── createdAt: Timestamp
│       └── updatedAt: Timestamp
│
├── stories/
│   └── {storyId}
│       ├── title: string
│       ├── titleJa: string
│       ├── description: string
│       ├── pages: array<StoryPage>
│       ├── quiz: array<QuizQuestion>
│       ├── jlptLevel: string
│       ├── status: 'published'
│       ├── fullAudioUrl: string
│       ├── publishedAt: Timestamp
│       └── wordExplanationsProgress: { status, count, total }
│
├── story_word_explanations/
│   └── {storyId}
│       ├── words: array<WordExplanation>
│       ├── wordCount: number
│       ├── generatedAt: Timestamp
│       └── costInfo: { promptTokens, completionTokens, totalTokens, estimatedCost }
│
├── story_sentence_translations/
│   └── {storyId}
│       ├── sentences: array<SentenceTranslation>
│       └── audioUrls: array<string>
│
└── story_generation_logs/
    └── {logId}
        ├── type: 'scheduled' | 'manual'
        ├── success: boolean
        ├── storyId?: string
        ├── draftId?: string
        ├── theme: string
        ├── jlptLevel: string
        ├── error?: string
        ├── duration: number
        └── createdAt: Timestamp
```

### 6.2 Draft Status Flow

```
character_created
    ↓
outline_created
    ↓
pages_generating
    ↓
quiz_generated
    ↓
model_sheet_created
    ↓
page_images_generating
    ↓
audio_generating
    ↓
sentences_generating
    ↓
complete
    ↓
[publish-draft API]
    ↓
published (in stories collection)

Pending States (for retry):
├── pending_images
├── pending_audio
└── pending_sentences
```

---

## 7. Modal Services

### 7.1 Overview

Three services deployed on Modal (modal.com):

| App Name | Service | Endpoint |
|----------|---------|----------|
| `ollama-llm` | Qwen 2.5 32B | `emmanuelfabiani23--ollama-llm-ollamallm-serve.modal.run` |
| `voicevox-tts` | Japanese TTS | `emmanuelfabiani23--voicevox-tts-serve.modal.run` |
| `whisper-transcription` | Audio transcription | `emmanuelfabiani23--whisper-transcription-serve.modal.run` |

### 7.2 Checking Modal Status

```bash
# List all apps
modal app list

# Check specific app
modal app logs ollama-llm

# Check running containers
modal container list
```

### 7.3 Modal Authentication

All Modal endpoints require `X-API-Key` header with `MODAL_API_KEY` environment variable.

```typescript
headers: {
  'Content-Type': 'application/json',
  'X-API-Key': process.env.MODAL_API_KEY,
}
```

### 7.4 Cold Start Considerations

- **Ollama (Qwen 32B):** ~30-60s cold start (large model loading)
- **VOICEVOX:** ~5-10s cold start
- **Whisper:** ~10-20s cold start

The scheduler includes retry logic to handle cold starts.

---

## 8. Scheduler Configuration

### 8.1 Schedule

| Function | Schedule | Purpose |
|----------|----------|---------|
| `scheduledStoryGeneratorFunction` | `0 0 * * 0` (Sunday 00:00 UTC) | Weekly story generation |
| `dailyStoryRetryScheduler` | `0 6 * * *` (Daily 06:00 UTC) | Retry pending drafts |

### 8.2 Resource Allocation

```typescript
// functions/src/scheduled/storyScheduler.ts
{
  memory: '1GiB',
  timeoutSeconds: 540,  // 9 minutes
  maxInstances: 1,
  retryConfig: { maxRetrySeconds: 60 }
}
```

### 8.3 Theme Selection (Seasonal + Smart Rotation)

**Updated 2026-01-25:** Theme selection now uses seasonal awareness and avoids recent themes.

**Theme File:** `functions/src/config/story-themes.json` (edit this file to add/remove themes)

#### Theme Pools (81 total themes)

| Season | Months | Theme Count | Examples |
|--------|--------|-------------|----------|
| **Spring** | Mar-May | 14 | Cherry Blossom Viewing, Golden Week Holiday, Starting a New School Year |
| **Summer** | Jun-Aug | 15 | Summer Festival, Watching Fireworks, Going to the Beach |
| **Autumn** | Sep-Nov | 14 | Autumn Leaves Viewing, Harvest Moon Festival, Halloween Party |
| **Winter** | Dec-Feb | 15 | New Year Celebration, Making Mochi, Christmas Eve in Japan |
| **Year-Round** | Any | 24 | A Day at School, Cooking Japanese Food, At the Library |

#### Selection Algorithm

```typescript
// Configuration
const THEME_CONFIG = {
  RECENT_THEMES_TO_AVOID: 20,  // Don't repeat last 20 themes
  YEAR_ROUND_CHANCE: 0.3,      // 30% chance for year-round theme
}

// Selection priority:
// 1. 30% chance: Try year-round theme (if not recently used)
// 2. Try current season's themes (if not recently used)
// 3. Fallback: Try year-round themes
// 4. Fallback: Try other seasons
// 5. Final fallback: Random from all pools (ignores recent history)
```

#### Season Detection (Northern Hemisphere / Japan)

```typescript
function getCurrentSeason() {
  const month = new Date().getMonth() // 0-11
  if (month >= 2 && month <= 4) return 'spring'   // March, April, May
  if (month >= 5 && month <= 7) return 'summer'   // June, July, August
  if (month >= 8 && month <= 10) return 'autumn'  // September, October, November
  return 'winter'                                  // December, January, February
}
```

#### Recent Theme Tracking

Themes are tracked via `story_generation_logs` collection. The system queries the last 20 generations to avoid repetition, ensuring users see fresh content each week.

### 8.4 Automation Control (Feature Flag)

Scheduled story automation is controlled by:

- Firestore doc: `config/featureFlags`
- Flag: `STORY_AUTOMATION`

Enforcement points:

- `scheduledStoryGeneratorFunction` checks the flag before starting.
- `dailyStoryRetryScheduler` checks the flag before starting.
- `manualStoryGeneratorFunction` is not blocked by this flag.

Implementation files:

- `functions/src/utils/automationFlags.ts`
- `functions/src/scheduled/storyScheduler.ts`

### 8.5 JLPT Level Distribution

```typescript
const JLPT_LEVELS = ['N5', 'N5', 'N5', 'N4', 'N4', 'N3', 'N2', 'N1']
// Distribution: N5=37.5%, N4=25%, N3=12.5%, N2=12.5%, N1=12.5%
```

---

## 9. Error Handling & Recovery

### 9.1 Checkpoint System

Every step updates a checkpoint allowing resume from failure:

```typescript
interface DraftCheckpoint {
  lastCompletedStep: string;
  lastCompletedIndex?: number;  // For loops (e.g., page 3 of 5)
  failedAttempts: number;
  lastAttemptAt: Timestamp;
  lastError?: string;
}
```

### 9.2 Retry Logic

- **Max retries per draft:** 3 attempts
- **Retry backoff:** Exponential (3s, 5s, 10s, 15s)
- **Pending states:** `pending_images`, `pending_audio`, `pending_sentences`

### 9.3 Alert System

Failed generations trigger email alerts via Resend:

```typescript
// functions/src/utils/alertNotifier.ts
sendStoryGenerationFailureAlert()  // Complete failure
sendStoryGenerationWarningAlert()  // Pending state
```

### 9.4 Critical vs Non-Critical Steps

| Step | Critical? | On Failure |
|------|-----------|------------|
| Character Sheet | ✅ Yes | Entire generation fails |
| Outline | ✅ Yes | Entire generation fails |
| Pages | ⚠️ Semi | Logs warning, continues |
| Quiz | ❌ No | Logs warning, continues |
| Model Sheet | ❌ No | Logs warning, continues |
| Images | ✅ Yes | Saves as `pending_images` |
| Audio | ✅ Yes | Saves as `pending_audio` |
| Sentences | ✅ Yes | Saves as `pending_sentences` |

---

## 10. Known Issues & Fixes

### 10.1 Audio Endpoint Overwrites Pages (FIXED & VERIFIED 2026-01-25)

**Issue:** The audio generation endpoint received minimal page data and overwrote the full pages array, destroying `textWithFurigana`, `translation`, and `imagePrompt`.

**Incident Example:**
```json
{
  "draftId": "draft_1769299765109_scheduler-system",
  "error": "API error 400: Story validation failed",
  "validationErrors": [
    "Page 1: Missing translation/textEn",
    "Page 2: Missing translation/textEn",
    "Page 3: Missing translation/textEn"
  ],
  "theme": "New Year Celebration",
  "jlptLevel": "N5"
}
```

**Root Cause:**
```typescript
// OLD CODE (BUGGY)
// /src/app/api/admin/generate-story-audio/route.ts

// Scheduler sends minimal data:
pages: pages.map((p: any) => ({
  pageNumber: p.pageNumber,
  text: p.textJa || p.text,  // ONLY pageNumber and text!
}))

// Audio endpoint overwrote with minimal data:
const pagesWithAudio = pages.map((page: any) => ({
  ...page,  // Only has pageNumber, text
  audioUrl: pageAudioResult?.url,
}))
updateData.pages = pagesWithAudio  // OVERWRITES full pages!
```

**Fix Applied:**
```typescript
// NEW CODE (FIXED)
// /src/app/api/admin/generate-story-audio/route.ts (lines 298-323)

// Read existing pages from Firestore first
const collection = storyId.startsWith('draft_') ? 'ai_story_drafts' : 'stories'
const docSnapshot = await adminFirestore!.collection(collection).doc(storyId).get()
const existingData = docSnapshot.data()
const existingPages = existingData?.pages || []

// SAFEGUARD: Only update pages if we have existing pages to preserve
if (existingPages.length > 0) {
  // Only update audioUrl on existing pages, preserving all other fields
  const pagesWithAudio = existingPages.map((page: any, index: number) => ({
    ...page,  // Keep ALL existing fields (textWithFurigana, translation, etc.)
    audioUrl: pageAudioResult?.url || page.audioUrl,
  }))
  updateData.pages = pagesWithAudio
} else {
  console.warn(`[StoryAudio] No existing pages found, skipping pages update`)
}
```

**File:** `src/app/api/admin/generate-story-audio/route.ts` (lines 298-323)

**Safeguards Added:**
1. Reads existing pages from Firestore before updating
2. Uses spread operator (`...page`) to preserve ALL existing fields
3. Skips page update entirely if no existing pages found (prevents empty array overwrite)
4. Logs warning if safeguard triggered

**Production Verification (2026-01-25):**

Fix verified with production story generation:

| Story ID | `story_1769355057545_scheduler-system` |
|----------|----------------------------------------|
| Theme | New Year Celebration |
| JLPT Level | N5 |
| Title | Akira's New Year Celebration |
| Status | Published |

**Page Field Verification:**

| Field | Page 1 | Page 2 | Page 3 |
|-------|--------|--------|--------|
| `text` | ✅ | ✅ | ✅ |
| `textWithFurigana` | ✅ PRESERVED | ✅ PRESERVED | ✅ PRESERVED |
| `translation` | ✅ PRESERVED | ✅ PRESERVED | ✅ PRESERVED |
| `audioUrl` | ✅ | ✅ | ✅ |

**Result:** All page fields preserved after audio generation. Bug fix confirmed working in production.

### 10.2 Validation Error Messages

When publish fails with validation errors like:
```
"Page 1: Missing translation/textEn"
```

This indicates the pages array was corrupted (likely by the audio endpoint bug above).

### 10.3 Impact Analysis: Word Prefetch System

**Question:** Does the audio endpoint fix affect the Word Prefetch system used in EnhancedArticleReader and WordExplanationModal?

**Answer:** NO - The systems are completely independent.

**Data Flow Separation:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                     AUDIO ENDPOINT FIX                              │
│                                                                     │
│   stories.pages[].audioUrl  ← WRITES (preserves all other fields)  │
│   stories.pages[].text      ← PRESERVED (via ...page spread)        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│               WORD PREFETCH (EnhancedArticleReader)                 │
│                                                                     │
│   1. stories.pages[].text  → READS ONLY (to extract words)         │
│                  ↓                                                  │
│   2. /api/word/precompute → generates explanations                  │
│                  ↓                                                  │
│   3. story_word_explanations.words → WRITES                         │
│                  ↓                                                  │
│   4. useWordExplanation.cacheRef → HYDRATES component cache         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Verification Table:**

| Component | Collection | Field | Operation | Affected by fix? |
|-----------|------------|-------|-----------|------------------|
| Audio fix | `stories` | `pages[].audioUrl` | WRITE | N/A (this IS the fix) |
| Audio fix | `stories` | `pages[].text` | PRESERVE | ✅ Preserved via spread |
| Word precompute | `stories` | `pages[].text` | READ | ❌ No - text preserved |
| Word precompute | `story_word_explanations` | `words` | WRITE | ❌ Different collection |
| Word prefetch hook | `story_word_explanations` | `words` | READ | ❌ Different collection |

**Key Files for Word Prefetch:**
- `src/hooks/useWordExplanation.ts` - Main hook with `prefetch()` function (lines 502-704)
- `src/components/news/EnhancedArticleReaderFinal.tsx` - Uses `prefetchWordExplanations()` (line 1266)
- `src/components/word/WordExplanationModal.tsx` - Displays word explanations
- `src/app/api/word/precompute/route.ts` - Server-side precomputation endpoint

**Collections Used by Word Prefetch:**
```typescript
const collectionMap = {
  article: 'news_article_word_explanations',
  book: 'book_word_explanations',
  story: 'story_word_explanations',      // ← Separate from stories.pages!
  youtube: 'youtube_word_explanations',
  video: 'video_word_explanations',
  comic: 'comic_word_explanations',
  flashcard: 'flashcard_word_explanations',
}
```

**Conclusion:** The audio fix and word prefetch operate on completely different data paths. The fix preserves `pages[].text` which is the only field word precompute reads from `stories`.

---

## 11. Debugging Guide

### 11.1 Check Draft Status

```javascript
// scripts/debug-draft.cjs
const admin = require('firebase-admin');
const draftId = 'draft_XXXXXXX_scheduler-system';

const doc = await db.collection('ai_story_drafts').doc(draftId).get();
const data = doc.data();

console.log('Status:', data.status);
console.log('Checkpoint:', data.checkpoint);
console.log('Pages:', data.pages?.map(p => ({
  pageNumber: p.pageNumber,
  hasText: !!p.text,
  hasTranslation: !!p.translation,
  hasFurigana: !!p.textWithFurigana,
  hasAudio: !!p.audioUrl,
})));
```

### 11.2 Check Modal Services

```bash
# List apps and status
modal app list

# View logs for Ollama
modal app logs ollama-llm --tail 100

# Check if services are responding
curl -X POST https://emmanuelfabiani23--ollama-llm-ollamallm-serve.modal.run/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $MODAL_API_KEY" \
  -d '{"model":"qwen2.5:32b","messages":[{"role":"user","content":"Hello"}]}'
```

### 11.3 Check Generation Logs

```javascript
// Query recent generation logs
const logs = await db.collection('story_generation_logs')
  .orderBy('createdAt', 'desc')
  .limit(10)
  .get();

logs.docs.forEach(doc => {
  const data = doc.data();
  console.log(`${data.createdAt.toDate()} | ${data.success ? '✅' : '❌'} | ${data.theme} | ${data.error || 'OK'}`);
});
```

### 11.4 Trace API Calls

The scheduler logs each API call:
```
[StoryScheduler] Step 1/9: Generating character sheet...
[StoryScheduler] Step 2/9: Generating outline...
[StoryScheduler] Step 3/9: Generating pages...
[StoryScheduler] Generating page 1/3...
```

Check Firebase Functions logs or Vercel logs for detailed traces.

---

## 12. Common Operations

### 12.1 Manually Trigger Story Generation

```bash
# Via Firebase CLI
firebase functions:call manualStoryGeneratorFunction --data '{"adminKey":"your-admin-key"}'

# Via HTTP (if you have admin access)
curl -X POST https://moshimoshi.app/api/admin/generate-story \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: story-scheduler-2025" \
  -d '{"step":"character_sheet","theme":"Cherry Blossom Viewing","jlptLevel":"N5","pageCount":3}'
```

### 12.2 Repair a Failed Draft

```javascript
// Step 1: Identify damaged pages
const draft = await db.collection('ai_story_drafts').doc(draftId).get();
const pages = draft.data().pages;
const damagedPages = pages.filter(p => !p.translation || !p.textWithFurigana);

// Step 2: Regenerate each damaged page
for (const page of damagedPages) {
  await fetch('https://moshimoshi.app/api/admin/generate-story', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': 'story-scheduler-2025',
    },
    body: JSON.stringify({
      step: 'generate_page',
      jlptLevel: draft.data().jlptLevel,
      pageNumber: page.pageNumber,
      draftId: draftId,
    }),
  });
}

// Step 3: Publish the repaired draft
await fetch('https://moshimoshi.app/api/admin/stories/publish-draft', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Admin-Key': 'story-scheduler-2025',
  },
  body: JSON.stringify({ draftId }),
});
```

### 12.3 Force Retry Pending Drafts

```javascript
// Mark a draft for retry
await db.collection('ai_story_drafts').doc(draftId).update({
  status: 'pending_images',  // or pending_audio, pending_sentences
  'checkpoint.failedAttempts': 0,  // Reset retry counter
});

// The daily retry scheduler (06:00 UTC) will pick it up
// Or manually trigger:
firebase functions:call dailyStoryRetryScheduler
```

### 12.4 Delete a Failed Draft

```javascript
// Only if you want to completely start over
await db.collection('ai_story_drafts').doc(draftId).delete();

// Clean up any uploaded assets
const storage = getStorage();
await storage.bucket().deleteFiles({
  prefix: `ai-stories/${draftId}/`,
});
```

### 12.5 Pause/Resume Scheduled Story Automation

```javascript
// Pause scheduled story automation (weekly generation + daily retry)
await db.collection('config').doc('featureFlags').set(
  { STORY_AUTOMATION: false },
  { merge: true }
);

// Resume scheduled story automation
await db.collection('config').doc('featureFlags').set(
  { STORY_AUTOMATION: true },
  { merge: true }
);
```

You can also toggle this in Admin Dashboard at `/admin/feature-flags`.

---

## 13. Related Systems

This section documents systems that interact with story generation but operate independently.

### 13.1 Word Prefetch Integration

The Word Prefetch system provides instant word explanations in the UI by pre-generating and caching explanations.

**How it works:**
1. When content loads, `useWordExplanation.prefetch()` is called
2. It checks if `{contentType}_word_explanations` doc exists in Firestore
3. If not, it triggers `/api/word/precompute` to generate explanations
4. Explanations are stored in separate collections (not in `stories.pages`)
5. UI components read from local cache (`cacheRef`)

**Key Files:**
| File | Purpose |
|------|---------|
| `src/hooks/useWordExplanation.ts` | Main hook with `prefetch()` and `explainWord()` |
| `src/app/api/word/precompute/route.ts` | Server-side precomputation |
| `src/app/api/word/explain/route.ts` | On-demand word lookup |
| `src/lib/ai/precompute/wordPrecompute.ts` | Core precomputation logic |
| `src/lib/ai/cache/WordExplanationCache.ts` | Global Firestore cache |

**Prefetch Flow:**
```
EnhancedArticleReaderFinal
    ↓
useWordExplanation.prefetch({ contentId, contentType, text })
    ↓
Check Firestore: story_word_explanations/{contentId}
    ↓
If missing → POST /api/word/precompute
    ↓
precomputeWordExplanations() using Qwen 2.5 / OpenAI
    ↓
Store in story_word_explanations collection
    ↓
Hydrate cacheRef for instant UI lookups
```

**Collections (separate from stories.pages):**
```typescript
const collectionMap = {
  article: 'news_article_word_explanations',
  book: 'book_word_explanations',
  story: 'story_word_explanations',
  youtube: 'youtube_word_explanations',
  video: 'video_word_explanations',
  comic: 'comic_word_explanations',
  flashcard: 'flashcard_word_explanations',
}
```

### 13.2 EnhancedArticleReaderFinal

The main reading component that supports stories, articles, and books.

**File:** `src/components/news/EnhancedArticleReaderFinal.tsx`

**Word Integration (lines 1266-1371):**
```typescript
const {
  explainWord,
  loading: wordLoading,
  error: wordError,
  explanation: wordExplanation,
  prefetch: prefetchWordExplanations,
} = useWordExplanation({
  contentId,
  contentType,
})

// Prefetch on content load
useEffect(() => {
  if (contentType === 'story') {
    prefetchWordExplanations({
      contentId,
      contentType: 'story',
      text: pages.map(p => p.text).join(' '),
      background: true,
    })
  }
}, [contentId, contentType])
```

**Key Features:**
- Tokenizes Japanese text via Kuromoji
- Click-to-lookup word explanations
- Background prefetch for instant lookups
- Supports stories, articles, books, comics

### 13.3 WordExplanationModal

Displays AI-generated word explanations with examples and conjugations.

**File:** `src/components/word/WordExplanationModal.tsx`

**Props:**
```typescript
interface WordExplanationModalProps {
  isOpen: boolean
  onClose: () => void
  word: string | null
  explanation: WordExplanation | null
  loading: boolean
  error: string | null
  translationContext?: { sentence?: string; userLevel?: JLPTLevel }
  onWordLookup?: (word: string) => void
  ttsVoice?: string  // VOICEVOX voice ID
}
```

**Features:**
- Word meaning, reading, romaji
- Kanji breakdown (if applicable)
- Conjugation tables
- Tatoeba example sentences
- TTS pronunciation (VOICEVOX)
- Add to vocabulary list

**Data Source:** Receives `explanation` prop from `useWordExplanation.explainWord()` which reads from:
1. Local cache (`cacheRef`)
2. Firestore (`story_word_explanations`)
3. API fallback (`/api/word/explain`)

---

## Appendix A: Environment Variables

### Next.js (Vercel)

```env
# OpenAI
OPENAI_API_KEY=sk-...
OPEN_AI_API_KEY=sk-...  # Alternative

# Gemini
GEMINI_API_KEY=...

# Modal
MODAL_API_KEY=...

# Firebase
FIREBASE_ADMIN_PROJECT_ID=moshimoshi-de237
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-...
FIREBASE_ADMIN_PRIVATE_KEY=...

# App
NEXT_PUBLIC_APP_URL=https://moshimoshi.app
STORY_SCHEDULER_ADMIN_KEY=story-scheduler-2025
```

### Firebase Cloud Functions

```env
# Set via Firebase CLI
firebase functions:secrets:set OPENAI_API_KEY
firebase functions:secrets:set MODAL_API_KEY
firebase functions:secrets:set GEMINI_API_KEY
firebase functions:secrets:set RESEND_API_KEY
```

---

## Appendix B: Zod Schemas Reference

### StoryPageSchema

```typescript
const StoryPageSchema = z.object({
  pageNumber: z.number().int().positive(),
  text: z.string().min(1),
  textWithFurigana: z.string().min(1),
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

### QuizQuestionSchema

```typescript
const QuizQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  questionJa: z.string(),
  options: z.array(z.string()),
  optionsJa: z.array(z.string()),
  correctIndex: z.number().int().min(0),
  explanation: z.string(),
  explanationJa: z.string(),
});
```

---

## Appendix C: Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────┐
│              STORY GENERATION QUICK REFERENCE                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SCHEDULE:     Sunday 00:00 UTC (weekly)                        │
│  RETRY:        Daily 06:00 UTC (pending drafts)                 │
│                                                                 │
│  THEMES:       81 total (seasonal + year-round)                 │
│  ├── Spring: 14  │  Summer: 15  │  Autumn: 14  │  Winter: 15   │
│  └── Year-round: 24  │  Avoids last 20 used themes              │
│                                                                 │
│  AI PROVIDERS:                                                  │
│  ├── OpenAI (gpt-4o-mini)  → Text generation (Steps 1-6)       │
│  ├── Gemini/Imagen         → Image generation (Steps 5-6)       │
│  ├── VOICEVOX (Modal)      → Japanese TTS (Step 7)              │
│  └── Qwen 2.5 (Modal)      → Post-processing (Steps 8-9)        │
│                                                                 │
│  KEY FILES:                                                     │
│  ├── functions/src/config/story-themes.json  ← EDIT THEMES HERE │
│  ├── functions/src/scheduled/storyScheduler.ts                  │
│  ├── src/app/api/admin/generate-story/route.ts                  │
│  ├── src/app/api/admin/generate-story-audio/route.ts            │
│  ├── src/lib/ai/processors/MultiStepStoryProcessor.ts           │
│  └── src/lib/ai/schemas/story-schemas.ts                        │
│                                                                 │
│  MODAL CHECK:  modal app list                                   │
│  DRAFT CHECK:  Firestore → ai_story_drafts                      │
│  LOGS CHECK:   Firestore → story_generation_logs                │
│                                                                 │
│  ADMIN KEY:    X-Admin-Key: story-scheduler-2025                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

**Document End**
