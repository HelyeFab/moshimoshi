# Sentence-Level Pre-Generation System

## Overview

This document details the sentence-level audio and translation pre-generation system implemented to eliminate user wait times when playing individual sentences or viewing translations.

## What Was Implemented

### 1. Backend (Cloud Functions)

**File:** `functions/src/utils/sentencePreGenerator.ts`
- Splits Japanese text into sentences by `。` delimiter
- Generates VOICEVOX audio for each sentence (stored in Firebase Storage)
- Generates Qwen 2.5 translations with grammar notes and vocabulary
- Stores data in Firestore collections

**Integration Points:**
- `functions/src/scheduled/newsScheduler.ts` - Step 4 added for article sentence generation
- `functions/src/scheduled/storyScheduler.ts` - Step 8/9 added for story sentence generation
- `src/app/api/admin/books/generate/route.ts` - Step 5 added for book sentence generation

### 2. Frontend Hooks

**File:** `src/hooks/useSentenceData.ts`
- `useArticleSentenceData(articleId)` - Fetches pre-cached article sentences
- `useStorySentenceData(storyId)` - Fetches pre-cached story sentences
- `useBookSentenceData(bookId)` - Fetches pre-cached book sentences

**File:** `src/hooks/useContentTranslation.ts`
- Updated to check for pre-cached translations before making API calls

### 3. Frontend Integration

**File:** `src/components/news/EnhancedArticleReaderFinal.tsx`
- Added `useArticleSentenceData` hook
- Updated `handlePlaySentence` with new priority flow:
  - Priority 0: Pre-cached audio URL (instant, no API call)
  - Priority 1: VOICEVOX via API (on-demand generation)
  - Priority 2: App TTS fallback

### 4. Firestore Collections

| Collection | Document ID | Structure |
|------------|-------------|-----------|
| `news_article_translations` | `{articleId}` | `{ sentences: SentenceData[], sentencesGeneratedAt }` |
| `story_sentence_data` | `{storyId}` | `{ pages: [{ pageNumber, sentences: SentenceData[] }] }` |
| `book_sentence_data` | `{bookId}` | `{ sentences: SentenceData[], generatedAt }` |

**SentenceData Structure:**
```typescript
{
  index: number
  text: string
  audioUrl: string  // Firebase Storage URL
  translation: {
    originalText: string
    translatedText: string
    grammarNotes: [{ pattern, explanation, example }]
    keyVocabulary: [{ word, reading, meaning, jlptLevel, partOfSpeech }]
    confidence: number
  }
}
```

### 5. Backfill Script

**File:** `scripts/run-sentence-backfill.mjs`

A Node.js script for bulk processing existing content.

---

## Current Status (2024-12-12)

### Completed
- [x] All infrastructure code implemented
- [x] Initial backfill completed for all content types
- [x] Repair script created for fixing failed sentences

### In Progress
- [ ] Repair pass running (fixing 504 timeout failures)
  - Stories: 3/15 repaired
  - Books: 0/4 repaired

### Needs Attention
- [ ] 24 articles have corrupted sentence data (no text field) - need re-backfill
- [ ] Some sentences may still have missing audio after repair

---

## How to Run the Backfill Script

### Prerequisites
```bash
# Ensure you have the Modal API key
export MODAL_API_KEY="your-modal-api-key"

# Or check .env.local for the key
grep MODAL_API_KEY .env.local
```

### Commands

#### Dry Run (Count what needs processing)
```bash
# Count all content needing backfill
MODAL_API_KEY="xxx" node scripts/run-sentence-backfill.mjs all --dry-run

# Count only articles
MODAL_API_KEY="xxx" node scripts/run-sentence-backfill.mjs articles --dry-run
```

#### Full Backfill (New content)
```bash
# Backfill everything (skips existing)
MODAL_API_KEY="xxx" node scripts/run-sentence-backfill.mjs all

# Backfill specific content type
MODAL_API_KEY="xxx" node scripts/run-sentence-backfill.mjs articles
MODAL_API_KEY="xxx" node scripts/run-sentence-backfill.mjs stories
MODAL_API_KEY="xxx" node scripts/run-sentence-backfill.mjs books
```

#### Repair Mode (Fix missing audio/translations)
```bash
# Dry run to see what needs repair
MODAL_API_KEY="xxx" node scripts/run-sentence-backfill.mjs all --repair --dry-run

# Run repairs
MODAL_API_KEY="xxx" node scripts/run-sentence-backfill.mjs all --repair
```

---

## Checking Progress

### Check if backfill/repair is running
```bash
ps aux | grep -E 'node.*backfill' | grep -v grep
```

### View live output
```bash
# If running in foreground, output shows directly
# If running in background, check the output file:
tail -50 /tmp/claude/tasks/*.output

# Follow live updates
tail -f /tmp/claude/tasks/*.output
```

### Count completed items
```bash
# Count repaired/processed items
grep -c "Repaired story" /tmp/claude/tasks/*.output
grep -c "Repaired book" /tmp/claude/tasks/*.output
grep -c "Repaired article" /tmp/claude/tasks/*.output
grep -c "\[Success\]" /tmp/claude/tasks/*.output
```

### Check for errors
```bash
# Count errors
grep -c "\[Error\]" /tmp/claude/tasks/*.output
grep -c "Failed" /tmp/claude/tasks/*.output

# View error details
grep -E "\[Error\]|Failed" /tmp/claude/tasks/*.output | tail -20
```

### Quick status summary
```bash
echo "Stories: $(grep -c 'Repaired story' /tmp/claude/tasks/*.output 2>/dev/null || echo 0)/15"
echo "Books: $(grep -c 'Repaired book' /tmp/claude/tasks/*.output 2>/dev/null || echo 0)/4"
echo "Errors: $(grep -c '\[Error\]' /tmp/claude/tasks/*.output 2>/dev/null || echo 0)"
```

### Kill a running backfill
```bash
pkill -f 'node scripts/run-sentence-backfill'
```

---

## Troubleshooting

### VOICEVOX 504 Timeouts
The Modal VOICEVOX endpoint can timeout if:
1. Container is cold (not used recently)
2. Too many concurrent requests

**Fix:** Redeploy VOICEVOX on Modal
```bash
cd /home/beano/NextCloud/GitEmma/modal-services/voicevox-tts
modal deploy deploy_voicevox.py
```

### Articles with Corrupted Data
Some articles may have sentence data without the `text` field (from failed backfills).

**Fix:** Delete and re-backfill
```javascript
// In Firebase Console or via script:
// 1. Delete the corrupted document from news_article_translations
// 2. Re-run backfill for articles (it will regenerate)
```

### Check Modal Status
```bash
modal app list
modal app logs voicevox-tts
modal app logs ollama-llm
```

---

## Daily Operations

After the backfill is complete, the system will automatically pre-generate sentences for:
- **Articles:** 4 new articles/day (via newsScheduler)
- **Stories:** 1 new story/day (via storyScheduler)
- **Books:** On-demand when created via admin

No manual intervention needed for new content.

---

## File Locations

| Purpose | Path |
|---------|------|
| Cloud Functions sentence generator | `functions/src/utils/sentencePreGenerator.ts` |
| Backfill script | `scripts/run-sentence-backfill.mjs` |
| Frontend hooks | `src/hooks/useSentenceData.ts` |
| Translation hook | `src/hooks/useContentTranslation.ts` |
| Article reader integration | `src/components/news/EnhancedArticleReaderFinal.tsx` |
| Cloud Functions backfill export | `functions/src/admin/backfillSentenceData.ts` |

---

## Resuming Work

### If repair was interrupted:
```bash
# Check what still needs repair
MODAL_API_KEY="xxx" node scripts/run-sentence-backfill.mjs all --repair --dry-run

# Resume repair
MODAL_API_KEY="xxx" node scripts/run-sentence-backfill.mjs all --repair
```

### If you need to start fresh:
1. Delete sentence data from Firestore collections
2. Run full backfill:
```bash
MODAL_API_KEY="xxx" node scripts/run-sentence-backfill.mjs all
```

### To fix specific corrupted articles:
```bash
# List of articles needing re-backfill (from repair failures):
# 036a0bd2e696e2841aa1d7d1620dfbe3
# 056857e6e815c960922012e96b755ff3
# 061ba990fb53364ac3ba81aff66cc09d
# ... (see repair log for full list)

# Delete their entries from news_article_translations collection
# Then run: MODAL_API_KEY="xxx" node scripts/run-sentence-backfill.mjs articles
```

---

## Architecture Diagram

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  News Scheduler │────▶│ sentencePreGen   │────▶│ Firebase Storage│
│  Story Scheduler│     │ (Cloud Function) │     │ (Audio Files)   │
│  Book API       │     └────────┬─────────┘     └─────────────────┘
└─────────────────┘              │
                                 ▼
                        ┌──────────────────┐
                        │    Firestore     │
                        │ (Sentence Data)  │
                        └────────┬─────────┘
                                 │
                                 ▼
┌─────────────────┐     ┌──────────────────┐
│  Frontend App   │◀────│ useSentenceData  │
│  (Article Reader│     │ (React Hook)     │
│   Story Reader) │     └──────────────────┘
└─────────────────┘
```

---

*Last Updated: 2024-12-12*
