# Word Explanation Feature - Testing Guide

## Overview

This guide provides comprehensive testing procedures for the word explanation feature.

## Manual Testing Checklist

### 1. Basic Functionality

#### Nouns
- [ ] Test: 猫 (ねこ - neko - cat)
  - **Expected**: Kanji breakdown, meaning, JLPT level (N5), example sentences
  - **Cache**: First call ~2-3s, subsequent <100ms

- [ ] Test: 学校 (がっこう - gakkou - school)
  - **Expected**: Two kanji breakdown (学 + 校), compounds, example sentences
  - **Cache**: Should cache after first lookup

- [ ] Test: 図書館 (としょかん - toshokan - library)
  - **Expected**: Three kanji breakdown, formal usage notes
  - **Cache**: Instant on repeat

#### Verbs (u-verbs)
- [ ] Test: 食べる (たべる - taberu - to eat)
  - **Expected**:
    - Full conjugation table (dictionary, present, past, negative, te-form, potential, etc.)
    - Kanji breakdown (食)
    - JLPT level (N5)
    - Example sentences in different forms
  - **Cache**: Multi-level caching active

- [ ] Test: 書く (かく - kaku - to write)
  - **Expected**:
    - Complete conjugation (書く, 書きます, 書いた, 書かない, 書いて, etc.)
    - Kanji meaning
    - Related compounds (書類, 書店, etc.)

#### Verbs (ru-verbs)
- [ ] Test: 見る (みる - miru - to see)
  - **Expected**:
    - Ru-verb conjugation pattern
    - Kanji breakdown
    - Compounds and related expressions

#### Adjectives (i-adjectives)
- [ ] Test: 美しい (うつくしい - utsukushii - beautiful)
  - **Expected**:
    - Adjective conjugation (美しい, 美しくない, 美しかった, 美しくて, etc.)
    - Kanji breakdown (美)
    - Formality level
    - Example sentences

- [ ] Test: 大きい (おおきい - ookii - big)
  - **Expected**:
    - I-adjective conjugations
    - Antonyms (小さい)
    - JLPT level (N5)

#### Adjectives (na-adjectives)
- [ ] Test: 静か (しずか - shizuka - quiet)
  - **Expected**:
    - Na-adjective conjugation (静かだ, 静かな, 静かに, etc.)
    - Kanji breakdown
    - Usage in different contexts

- [ ] Test: 便利 (べんり - benri - convenient)
  - **Expected**:
    - Na-adjective patterns
    - Antonyms (不便)
    - Example sentences

#### Particles
- [ ] Test: は (wa - topic marker)
  - **Expected**:
    - Grammar explanation
    - Comparison with が
    - Multiple example sentences
    - Usage notes

- [ ] Test: で (de - at/with/by)
  - **Expected**:
    - Multiple meanings explained
    - Different use cases
    - Example sentences for each meaning

#### Adverbs
- [ ] Test: とても (totemo - very)
  - **Expected**:
    - Part of speech: adverb
    - Usage with adjectives and verbs
    - Formality level
    - Examples

### 2. Advanced Features

#### Kanji Breakdown
- [ ] Test word with multiple kanji: 日本語 (にほんご - nihongo - Japanese language)
  - **Expected**:
    - Three kanji broken down (日, 本, 語)
    - Each with kun/on readings
    - Individual meanings explained

- [ ] Test complex kanji: 携帯電話 (けいたいでんわ - keitaidenwa - mobile phone)
  - **Expected**:
    - Four kanji breakdown
    - Modern compound usage explanation

#### Conjugation Tables
- [ ] Test irregular verb: する (suru - to do)
  - **Expected**:
    - Complete irregular conjugation
    - する-verb compounds (勉強する, etc.)

- [ ] Test irregular verb: 来る (くる - kuru - to come)
  - **Expected**:
    - Irregular conjugation patterns
    - Related expressions

#### Pitch Accent
- [ ] Verify pitch accent notation is provided
  - **Expected**: Pattern (LHL, HLL, etc.) and notation (こ↑んば↓んは style)

#### Related Words
- [ ] Test: 走る (はしる - hashiru - to run)
  - **Expected**:
    - Synonyms (駆ける, etc.)
    - Related expressions (走り出す, etc.)
    - Compounds (走者, 走行, etc.)

### 3. Caching Tests

#### Component-Level Cache
```typescript
// Test sequence:
1. Click word "猫"
2. Close modal
3. Click word "猫" again
Expected: Instant load (<50ms)
```

#### Firestore Cache
```typescript
// Test sequence:
1. Click word "学校" (not in cache)
2. Wait for AI response
3. Refresh page/restart app
4. Click word "学校" again
Expected: Load from Firestore (~100ms)
```

#### Cache Verification
```bash
# Check Firestore
# Collection: wordExplanationCache
# Should see documents with:
# - wordHash (SHA-256)
# - word (original)
# - explanation (full WordExplanation object)
# - createdAt, lastAccessedAt, accessCount
```

### 4. Entitlement Tests

#### Guest User (0 limit)
```typescript
Test: Tap any word while not logged in
Expected: Error "UNAUTHENTICATED"
```

#### Free User (3/day limit)
```typescript
Test sequence:
1. Explain word 1 → Success, remaining: 2
2. Explain word 2 → Success, remaining: 1
3. Explain word 3 → Success, remaining: 0
4. Explain word 4 → Error "LIMIT_REACHED"
Expected: Proper quota tracking
```

#### Premium User (unlimited)
```typescript
Test: Explain 10+ words in succession
Expected: All succeed, remaining: -1 (unlimited)
```

### 5. Error Handling Tests

#### Network Error
```typescript
Test: Disconnect internet, tap word
Expected: Error message "Network error"
```

#### Invalid Word
```typescript
Test: Click on punctuation or symbol
Expected: Graceful handling or no trigger
```

#### API Error
```typescript
Test: Simulate 500 error from API
Expected: Error message displayed in modal
```

#### Long Word
```typescript
Test: Word longer than 100 characters
Expected: "WORD_TOO_LONG" error
```

### 6. UI/UX Tests

#### Modal Appearance
- [ ] Modal opens smoothly with animation
- [ ] Modal is centered and responsive
- [ ] Scroll works properly for long content
- [ ] Close button works (X and overlay click)
- [ ] ESC key closes modal

#### Loading State
- [ ] Loading spinner shows while fetching
- [ ] Loading message is clear
- [ ] No flash of content before loading

#### Error Display
- [ ] Error messages are user-friendly
- [ ] Error styling (red background) is clear
- [ ] Errors can be dismissed

#### Content Display
- [ ] All sections render properly:
  - Basic info (word, reading, meaning)
  - Tags (part of speech, JLPT, formality)
  - Kanji breakdown (if applicable)
  - Conjugation table (if applicable)
  - Pitch accent (if available)
  - Related words (if available)
  - Usage notes (if available)
  - Example sentences

#### Mobile Tests
- [ ] Tap detection works on mobile
- [ ] Modal is responsive on mobile
- [ ] Scrolling works in modal
- [ ] No horizontal overflow
- [ ] Font sizes readable on small screens

### 7. Performance Tests

#### Timing Benchmarks
```typescript
// Component cache (same session)
Expected: <50ms

// Firestore cache (cached)
Expected: <200ms

// AI generation (cache miss)
Expected: 2000-4000ms

// Multiple rapid taps
Expected: Debounced or queued properly
```

#### Memory Usage
```typescript
Test: Explain 50+ different words
Expected: Component cache size manageable (<5MB)
Monitor: Browser DevTools → Memory profiler
```

### 8. Integration Tests

#### ArticleReader
- [ ] Tap words in article content
- [ ] Modal doesn't interfere with reading flow
- [ ] Grammar highlighting still works
- [ ] Furigana toggle doesn't break tapping

#### StoryReader
- [ ] Tap words in story pages
- [ ] Navigation still works while modal open
- [ ] Image display not affected

#### YouTube Shadowing
- [ ] Tap words in transcript
- [ ] Video playback not interrupted
- [ ] Transcript sync still works

### 9. Data Validation Tests

#### Response Structure
```typescript
// Verify API response matches:
{
  success: true,
  explanation: {
    word: string,
    reading: string,
    romaji: string,
    meaning: string,
    partOfSpeech: string,
    kanjiBreakdown?: [...],
    conjugation?: {...},
    pitchAccent?: {...},
    relatedWords?: {...},
    jlptLevel?: string,
    formality: string,
    usageNotes?: string,
    examples: [...]
  },
  cached: boolean,
  usage: {...},
  decision: {...}
}
```

#### Kanji Breakdown Validation
```typescript
// For word "食べる":
kanjiBreakdown: [{
  kanji: "食",
  meaning: "eat, food",
  kunYomi: ["た.べる", "く.う"],
  onYomi: ["ショク", "ジキ"]
}]
```

#### Conjugation Validation
```typescript
// For verb "食べる":
conjugation: {
  dictionary: "食べる",
  present: "食べます",
  past: "食べた",
  negative: "食べない",
  teForm: "食べて",
  potential: "食べられる",
  passive: "食べられる",
  causative: "食べさせる",
  imperative: "食べろ",
  volitional: "食べよう"
}
```

## Automated Testing

### Unit Tests

Create test file: `src/hooks/__tests__/useWordExplanation.test.ts`

```typescript
import { renderHook, act } from '@testing-library/react';
import { useWordExplanation } from '../useWordExplanation';

describe('useWordExplanation', () => {
  it('should explain word successfully', async () => {
    const { result } = renderHook(() => useWordExplanation());

    await act(async () => {
      await result.current.explainWord('猫');
    });

    expect(result.current.explanation).toBeTruthy();
    expect(result.current.explanation?.word).toBe('猫');
  });

  it('should cache explanations', async () => {
    const { result } = renderHook(() => useWordExplanation());

    // First call
    await act(async () => {
      await result.current.explainWord('猫');
    });
    const firstLoad = Date.now();

    // Second call
    await act(async () => {
      await result.current.explainWord('猫');
    });
    const secondLoad = Date.now();

    expect(secondLoad - firstLoad).toBeLessThan(100);
  });
});
```

### API Tests

Create test file: `src/app/api/word/explain/__tests__/route.test.ts`

```typescript
import { POST } from '../route';
import { NextRequest } from 'next/server';

describe('/api/word/explain', () => {
  it('should require authentication', async () => {
    const request = new NextRequest('http://localhost/api/word/explain', {
      method: 'POST',
      body: JSON.stringify({ word: '猫' })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('UNAUTHENTICATED');
  });

  it('should validate word length', async () => {
    const longWord = 'a'.repeat(101);
    const request = new NextRequest('http://localhost/api/word/explain', {
      method: 'POST',
      body: JSON.stringify({ word: longWord })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('WORD_TOO_LONG');
  });
});
```

## Production Verification

### Pre-Launch Checklist
- [ ] Firebase Admin credentials configured
- [ ] Firestore collection `wordExplanationCache` has proper indexes
- [ ] OpenAI API key set in environment
- [ ] Entitlement limits configured correctly
- [ ] Rate limiting enabled
- [ ] Error logging to Sentry configured
- [ ] Analytics tracking word lookups

### Monitoring

```bash
# Check cache hit rate
# Expected: >90% after initial usage

# Check API response times
# Expected: p50 <100ms (cached), p95 <3s (uncached)

# Check error rate
# Expected: <1% under normal conditions

# Check quota usage
# Monitor users hitting limits
```

### Analytics Events

Track these events:
- `word_explanation_requested` (word, cached, user_plan)
- `word_explanation_success` (word, processing_time, jlpt_level)
- `word_explanation_error` (word, error_type)
- `word_explanation_limit_reached` (user_plan, words_explained_today)

## Common Issues

### Issue: Modal doesn't open
**Fix**: Check console for errors, verify WordExplanationModal is imported

### Issue: Cached word still takes time
**Fix**: Check Firestore rules, verify admin SDK initialized

### Issue: Quota not updating
**Fix**: Check usage collection in Firestore, verify bucket key generation

### Issue: No kanji breakdown
**Fix**: Verify word contains kanji, check AI processor prompt

### Issue: Conjugation missing
**Fix**: Verify word is verb/adjective, check part of speech detection

## Test Data

### Common Test Words
```typescript
const testWords = {
  nouns: ['猫', '学校', '図書館', '友達', '先生'],
  verbs: ['食べる', '書く', '見る', '行く', 'する', '来る'],
  adjectives: {
    i: ['美しい', '大きい', '楽しい', '新しい'],
    na: ['静か', '便利', '好き', '元気']
  },
  particles: ['は', 'が', 'を', 'に', 'で', 'から'],
  adverbs: ['とても', 'ゆっくり', 'すぐ', 'もう']
};
```

---

**Testing Status**: Ready for QA
**Last Updated**: 2025-01-10
**Coverage Target**: >90% for API routes, >80% for hooks
