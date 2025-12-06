# News Pre-Caching System

A comprehensive pre-caching system for NHK Easy news articles that generates audio, translations, and word explanations at scraping time for instant user experience.

## Overview

The system runs **4x daily** (00:00, 06:00, 12:00, 18:00 JST) and processes approximately **1 article per run**. Each article goes through a 3-stage pre-caching pipeline:

1. **Audio Generation** - Kokoro TTS
2. **Translation Generation** - OpenAI GPT-4o-mini
3. **Word Explanation Generation** - OpenAI GPT-4o-mini

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     News Scheduler                               │
│              (4x daily: 00:00, 06:00, 12:00, 18:00 JST)         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NHK Easy Scraper                              │
│              (Railway nhk-api-proxy)                             │
│                                                                  │
│  Output: news_articles collection                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                STAGE 1: Audio Generation                         │
│                    (Kokoro TTS)                                  │
│                                                                  │
│  - Title audio                                                   │
│  - Summary audio                                                 │
│  - Full content audio                                            │
│                                                                  │
│  Storage: Firebase Storage (news-audio/{source}/{id}/*.mp3)     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              STAGE 2: Translation Generation                     │
│                   (OpenAI GPT-4o-mini)                          │
│                                                                  │
│  - Title (learning mode - with grammar notes)                   │
│  - Summary (learning mode)                                       │
│  - Content (full mode)                                           │
│  - First 10 sentences (individual translations)                  │
│                                                                  │
│  Storage: news_article_translations collection                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│            STAGE 3: Word Explanation Generation                  │
│                   (OpenAI GPT-4o-mini)                          │
│                                                                  │
│  - Extract top 100 words from content                           │
│  - Generate comprehensive explanations:                          │
│    - Kanji breakdown (kun/on readings)                          │
│    - Conjugation tables (verbs/adjectives)                      │
│    - Related words (synonyms, antonyms, compounds)              │
│    - Example sentences                                           │
│    - JLPT level estimation                                       │
│                                                                  │
│  Storage: news_article_word_explanations collection              │
└─────────────────────────────────────────────────────────────────┘
```

## Files

### Core Utilities

| File                                                 | Purpose                                              |
| ---------------------------------------------------- | ---------------------------------------------------- |
| `functions/src/utils/wordExtractor.ts`               | Extracts top 100 Japanese words from article content |
| `functions/src/utils/translationPreGenerator.ts`     | Generates translations for article segments          |
| `functions/src/utils/wordExplanationPreGenerator.ts` | Generates comprehensive word explanations            |
| `functions/src/utils/newsAudioGenerator.ts`          | Generates TTS audio using Kokoro                     |

### Scheduler

| File                                       | Purpose                                   |
| ------------------------------------------ | ----------------------------------------- |
| `functions/src/scheduled/newsScheduler.ts` | Main scheduler orchestrating the pipeline |
| `functions/src/scrapers/nhkEasyScraper.ts` | NHK Easy article scraper                  |

## Firestore Collections

### `news_articles`

Main articles collection (created by scraper).

```typescript
{
  id: string;
  title: string;
  titleWithFurigana: string;
  content: string;
  contentWithFurigana: string;
  summary: string;
  summaryWithFurigana: string;
  url: string;
  imageUrl?: string;
  publishDate: Timestamp;
  source: 'NHK Easy';
  category: string;
  difficulty: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  // Audio URLs (populated by Stage 1)
  generatedTitleAudioUrl?: string;
  generatedSummaryAudioUrl?: string;
  generatedContentAudioUrl?: string;
  audioGeneratedAt?: Timestamp;
}
```

### `news_article_translations`

Pre-generated translations (created by Stage 2).

```typescript
{
  articleId: string;
  title: {
    originalText: string;
    translatedText: string;
    type: 'title';
    mode: 'learning';
    confidence: number;
    metadata: {
      keyVocabulary: Array<{ word: string; meaning: string }>;
      grammarNotes: string[];
    };
  };
  summary: TranslationSegment;
  content: TranslationSegment;
  sentences: TranslationSegment[]; // First 10 sentences
  generatedAt: Timestamp;
  costInfo: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number;
  };
}
```

### `news_article_word_explanations`

Pre-generated word explanations (created by Stage 3).

```typescript
{
  articleId: string;
  words: Array<{
    word: string;
    reading: string;
    romaji: string;
    meaning: string;
    partOfSpeech: string;
    kanjiBreakdown?: Array<{
      kanji: string;
      meaning: string;
      kunYomi: string[];
      onYomi: string[];
    }>;
    conjugation?: {
      dictionary: string;
      present: string;
      past: string;
      negative: string;
      teForm: string;
    };
    relatedWords?: {
      synonyms: string[];
      antonyms: string[];
      compounds: string[];
    };
    jlptLevel?: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
    examples: Array<{
      japanese: string;
      translation: string;
    }>;
  }>;
  wordCount: number;
  generatedAt: Timestamp;
  costInfo: {...};
}
```

## Firebase Secrets Required

| Secret           | Purpose                                           |
| ---------------- | ------------------------------------------------- |
| `KOKORO_API_KEY` | Kokoro TTS API authentication                     |
| `OPENAI_API_KEY` | OpenAI API for translations and word explanations |

### Setting Secrets

```bash
firebase functions:secrets:set KOKORO_API_KEY
firebase functions:secrets:set OPENAI_API_KEY
```

## Manual Triggering

The scraper can be triggered manually from the admin dashboard or via Firebase callable function:

```typescript
// From frontend
const result = await httpsCallable(
  functions,
  'manualNewsScraperFunction'
)({
  adminKey: 'news-scraper-admin-2025', // or be authenticated
  source: 'nhk-easy', // optional: specific source
  startDate: '2025-01-01', // optional: custom date range
  endDate: '2025-01-15',
})
```

## Estimated Costs

Per article (approximate):

| Stage                         | Provider           | Cost               |
| ----------------------------- | ------------------ | ------------------ |
| Audio                         | Kokoro TTS         | Free (self-hosted) |
| Translations                  | OpenAI GPT-4o-mini | ~$0.002-0.005      |
| Word Explanations (100 words) | OpenAI GPT-4o-mini | ~$0.01-0.02        |
| **Total per article**         |                    | **~$0.02-0.03**    |

At 4 articles/day = ~$2.40-3.60/month

## Frontend Integration

The frontend should check for pre-cached data before making real-time API calls:

```typescript
// Check for pre-cached translation
const translationDoc = await getDoc(doc(db, 'news_article_translations', articleId))

if (translationDoc.exists()) {
  // Use cached translation (instant!)
  return translationDoc.data()
} else {
  // Fall back to real-time API call
  return await generateTranslation(text)
}
```

## Monitoring

Logs are written to Firestore `scraping_logs` collection and Firebase Functions logs.

View logs:

```bash
firebase functions:log --only scheduledNewsScraperFunction
firebase functions:log --only manualNewsScraperFunction
```

## Error Handling

Each stage fails independently without breaking the whole pipeline:

- If audio generation fails: Article is saved, translations/explanations still generated
- If translations fail: Article and audio saved, explanations still generated
- If word explanations fail: Article, audio, and translations saved

All errors are logged for debugging.

## Schedule

| Time (JST) | UTC              | Description  |
| ---------- | ---------------- | ------------ |
| 00:00      | 15:00 (prev day) | Midnight run |
| 06:00      | 21:00 (prev day) | Morning run  |
| 12:00      | 03:00            | Noon run     |
| 18:00      | 09:00            | Evening run  |

Cron expression: `0 0,6,12,18 * * *`

---

Created: 2025-01-26
Last Updated: 2025-01-26
