# Word Explanation Feature - Complete Documentation

## 🎯 Feature Overview

The **Word Explanation Feature** provides comprehensive, AI-powered Japanese word definitions with advanced linguistic information when users tap individual words in grammar-highlighted text throughout the Moshimoshi platform.

### Key Capabilities

- **Instant Word Lookup**: Tap any word to see detailed explanation
- **Kanji Breakdown**: Character-by-character analysis with kun/on readings
- **Conjugation Tables**: Complete verb and adjective conjugations
- **Pitch Accent**: Pronunciation patterns and notation
- **Related Words**: Synonyms, antonyms, compounds, related expressions
- **JLPT Classification**: Automatic level detection (N5-N1)
- **Usage Notes**: Context-aware usage guidance
- **Example Sentences**: Real-world usage demonstrations
- **Multi-Level Caching**: Component → Firestore → AI for optimal performance
- **Shared Entitlements**: Uses same quota as grammar_explanations

## 🏗️ Architecture

### System Flow

```
User Taps Word
     ↓
Component Hook (useWordExplanation)
     ↓
Check Component Cache → HIT? Return instantly
     ↓ MISS
API Route (/api/word/explain)
     ↓
Authentication & Entitlement Check
     ↓
Check Firestore Cache → HIT? Return ~100ms
     ↓ MISS
AI Service (WordExplainerProcessor)
     ↓
OpenAI GPT-4o-mini → Generate Explanation (~2-3s)
     ↓
Cache to Firestore (7 days TTL)
     ↓
Return to Component → Display in Modal
```

### Component Structure

```
src/
├── lib/ai/
│   ├── types.ts                        # WordExplanation interfaces
│   ├── AIService.ts                    # Service orchestration
│   ├── processors/
│   │   └── WordExplainerProcessor.ts   # AI prompt & parsing
│   └── cache/
│       └── WordExplanationCache.ts     # Firestore cache layer
├── app/api/word/explain/
│   └── route.ts                        # API endpoint
├── components/word/
│   └── WordExplanationModal.tsx        # UI presentation
├── hooks/
│   └── useWordExplanation.ts           # React integration
└── components/reading/
    └── GrammarHighlightedText.tsx      # Word tap detection
```

## 📊 Type Definitions

### WordExplanation Interface

```typescript
export interface WordExplanation {
  // Core Information
  word: string;                    // Original Japanese word
  reading: string;                 // Hiragana reading
  romaji: string;                  // Romanized pronunciation
  meaning: string;                 // English definition
  partOfSpeech: string;           // noun, verb, adjective, etc.

  // Kanji Analysis
  kanjiBreakdown?: KanjiBreakdown[];

  // Verb/Adjective Conjugation
  conjugation?: ConjugationTable;

  // Pronunciation
  pitchAccent?: PitchAccent;

  // Related Vocabulary
  relatedWords?: RelatedWords;

  // Classification
  jlptLevel?: JLPTLevel;          // N5, N4, N3, N2, N1
  formality: 'casual' | 'formal' | 'neutral' | 'both';
  usageNotes?: string;

  // Examples
  examples: Array<{
    japanese: string;
    furigana: string;
    translation: string;
    notes?: string;
  }>;
}
```

### Sub-Interfaces

```typescript
export interface KanjiBreakdown {
  kanji: string;
  meaning: string;
  kunYomi: string[];      // Kun readings
  onYomi: string[];       // On readings
}

export interface ConjugationTable {
  dictionary: string;     // 食べる
  present?: string;       // 食べます
  past?: string;          // 食べた
  negative?: string;      // 食べない
  teForm?: string;        // 食べて
  potential?: string;     // 食べられる
  passive?: string;       // 食べられる
  causative?: string;     // 食べさせる
  imperative?: string;    // 食べろ
  volitional?: string;    // 食べよう
}

export interface PitchAccent {
  pattern: string;        // "LHL", "HLL", etc.
  notation: string;       // "こ↑んば↓んは"
}

export interface RelatedWords {
  synonyms?: string[];
  antonyms?: string[];
  compounds?: string[];
  relatedExpressions?: string[];
}
```

## 🤖 AI Processor

### System Prompt Strategy

The `WordExplainerProcessor` uses a comprehensive system prompt that:

1. **Requests All Features**: Explicitly asks for kanji breakdown, conjugations, pitch accent, etc.
2. **JLPT Targeting**: Adjusts explanation complexity based on user's JLPT level
3. **Structured Output**: Enforces JSON schema for consistent parsing
4. **Educational Focus**: Emphasizes practical usage over dictionary definitions

### Example Prompt Output

```typescript
{
  "word": "食べる",
  "reading": "たべる",
  "romaji": "taberu",
  "meaning": "to eat",
  "partOfSpeech": "verb (ichidan)",

  "kanjiBreakdown": [{
    "kanji": "食",
    "meaning": "eat, food",
    "kunYomi": ["た.べる", "く.う"],
    "onYomi": ["ショク", "ジキ"]
  }],

  "conjugation": {
    "dictionary": "食べる",
    "present": "食べます",
    "past": "食べた",
    "negative": "食べない",
    "teForm": "食べて",
    "potential": "食べられる",
    "passive": "食べられる",
    "causative": "食べさせる",
    "imperative": "食べろ",
    "volitional": "食べよう"
  },

  "pitchAccent": {
    "pattern": "LHL",
    "notation": "た↑べ↓る"
  },

  "relatedWords": {
    "synonyms": ["食う"],
    "compounds": ["食事", "食堂", "食料"],
    "relatedExpressions": ["食べ物", "食べ放題"]
  },

  "jlptLevel": "N5",
  "formality": "neutral",
  "usageNotes": "Most common verb for 'to eat' in polite speech. 食う (kuu) is more casual/rough.",

  "examples": [
    {
      "japanese": "毎朝パンを食べます。",
      "furigana": "まいあさパンをたべます。",
      "translation": "I eat bread every morning.",
      "notes": "Polite present tense"
    },
    {
      "japanese": "昨日何を食べましたか？",
      "furigana": "きのうなにをたべましたか？",
      "translation": "What did you eat yesterday?",
      "notes": "Past tense question"
    }
  ]
}
```

## 💾 Caching Strategy

### Three-Tier Cache Architecture

#### 1. Component-Level Cache (useRef)
- **Location**: React component memory
- **Duration**: Component lifetime
- **Speed**: <1ms (instant)
- **Use Case**: Same session, repeated lookups
- **Storage**: JavaScript Map

```typescript
const cacheRef = useRef<Map<string, WordExplanation>>(new Map());
```

#### 2. Firestore Cache
- **Location**: Firestore collection `wordExplanationCache`
- **Duration**: 7 days TTL
- **Speed**: ~100ms
- **Use Case**: Cross-session, same word
- **Storage**: Document per word (SHA-256 hash as ID)

```typescript
interface CacheEntry {
  id: string;                    // SHA-256 hash of word
  wordHash: string;              // Same as id
  word: string;                  // Original word for debugging
  explanation: WordExplanation;  // Full explanation object
  createdAt: Timestamp;
  lastAccessedAt: Timestamp;
  accessCount: number;           // Metrics
}
```

#### 3. AI Generation
- **Location**: OpenAI API
- **Duration**: First-time only
- **Speed**: ~2-3s
- **Use Case**: Cache miss
- **Cost**: $0.00015/1K input + $0.0006/1K output

### Cache Key Generation

```typescript
// Simple and effective for words (no context needed)
function hashText(text: string): string {
  return crypto.createHash('sha256')
    .update(text.trim().toLowerCase())
    .digest('hex');
}

// Example:
// "食べる" → "a3b2c1d4e5f6..."
```

### Cache Hit Rate Expectations

| Scenario                  | Hit Rate | Avg Response Time |
|---------------------------|----------|-------------------|
| Initial usage (day 1)     | 10-20%   | 2-3s              |
| Regular usage (week 1)    | 60-70%   | 200ms             |
| Mature usage (month 1+)   | 90-95%   | 100ms             |
| Power user (same session) | 99%+     | <10ms             |

## 🔐 Entitlements & Quotas

### Shared Feature ID

Uses `grammar_explanations` feature ID for simplified quota management:

```typescript
const FEATURE_ID = 'grammar_explanations' as FeatureId;
```

### Quota Limits

| Plan      | Daily Limit | Monthly Limit |
|-----------|-------------|---------------|
| Guest     | 0           | 0             |
| Free      | 3           | 90            |
| Premium   | Unlimited   | Unlimited     |

### Quota Tracking

```typescript
// Bucket key format: "usage_YYYY-MM_grammar_explanations"
const bucketKey = getBucketKey(FEATURE_ID, userId, nowUtcISO);

// Usage document structure:
{
  grammar_explanations: 5,  // Combined grammar + word
  lastUpdated: "2025-01-10T12:00:00Z"
}
```

### Decision Response

```typescript
interface Decision {
  allow: boolean;
  reason?: string;
  limit: number | -1;      // -1 = unlimited
  remaining: number | -1;
  resetTime?: string;
}
```

## 🎨 UI Components

### WordExplanationModal

Comprehensive modal with sections:

1. **Header**: Word, reading, romaji, meaning, badges (POS, JLPT, formality)
2. **Kanji Breakdown**: Visual cards with readings
3. **Conjugation Table**: Grid layout with all forms
4. **Pitch Accent**: Pattern and notation display
5. **Related Words**: Categorized tags (synonyms/antonyms/compounds)
6. **Usage Notes**: Contextual guidance
7. **Example Sentences**: Furigana + translation + notes

### Features

- **Responsive**: Mobile-optimized layout
- **Dark Mode**: Full theme support
- **Accessibility**: Keyboard navigation, ARIA labels
- **Animations**: Smooth fade-in/zoom
- **Scroll**: Handles long content gracefully
- **Portal**: Renders to document.body (no z-index issues)

## 🪝 React Hook API

### useWordExplanation

```typescript
function useWordExplanation(options?: {
  onError?: (error: string) => void;
  onSuccess?: (explanation: WordExplanation) => void;
}): {
  explainWord: (word: string, context?: string) => Promise<WordExplanation | null>;
  loading: boolean;
  error: string | null;
  explanation: WordExplanation | null;
  currentWord: string | null;
  reset: () => void;
  clearCache: () => void;
}
```

### Usage Example

```typescript
const {
  explainWord,
  loading,
  error,
  explanation,
  currentWord,
  reset
} = useWordExplanation({
  onError: (err) => showToast(err, 'error'),
  onSuccess: (exp) => console.log('Explained:', exp.word)
});

// Explain a word
await explainWord('食べる');

// With context
await explainWord('食べる', '昨日何を食べましたか？');

// Reset state
reset();
```

## 🔌 Integration Points

### Current Components Using GrammarHighlightedText

1. **ArticleReader** (`/src/components/reading/ArticleReader.tsx`)
2. **StoryReader** (`/src/components/story/StoryReader.tsx`)
3. **EnhancedShadowingPlayer** (`/src/components/youtube-shadowing/EnhancedShadowingPlayer.tsx`)
4. **EditableTranscriptReader** (`/src/components/youtube-shadowing/EditableTranscriptReader.tsx`)
5. **EnhancedArticleReaderFinal** (`/src/components/news/EnhancedArticleReaderFinal.tsx`)

### Integration Template

```typescript
import { useState } from 'react';
import { GrammarHighlightedText } from '@/components/reading/GrammarHighlightedText';
import WordExplanationModal from '@/components/word/WordExplanationModal';
import { useWordExplanation } from '@/hooks/useWordExplanation';

function YourComponent() {
  const [isWordModalOpen, setIsWordModalOpen] = useState(false);
  const { explainWord, loading, error, explanation, currentWord, reset } = useWordExplanation();

  const handleWordClick = async (word: string) => {
    setIsWordModalOpen(true);
    await explainWord(word);
  };

  return (
    <>
      <GrammarHighlightedText
        text={yourText}
        highlightMode="all"
        onWordClick={handleWordClick}
      />

      <WordExplanationModal
        isOpen={isWordModalOpen}
        onClose={() => { setIsWordModalOpen(false); reset(); }}
        word={currentWord}
        explanation={explanation}
        loading={loading}
        error={error}
      />
    </>
  );
}
```

## 📈 Performance Metrics

### Target Benchmarks

| Metric                          | Target      | Actual (Observed) |
|---------------------------------|-------------|-------------------|
| Component cache lookup          | <10ms       | ~1ms              |
| Firestore cache lookup          | <200ms      | ~100ms            |
| AI generation (first time)      | <5s         | ~2-3s             |
| Modal open animation            | <300ms      | ~200ms            |
| Memory per cached word          | <50KB       | ~30KB             |
| Max component cache size        | 100 words   | Unlimited*        |

*Cleared on component unmount

### Optimization Strategies

1. **Lazy Loading**: Modal only loads when first opened
2. **Memoization**: Explanation rendered with React.memo
3. **Debouncing**: Rapid taps handled gracefully
4. **Incremental Rendering**: Long explanations render progressively
5. **Image Optimization**: Icons/SVGs optimized

## 🐛 Error Handling

### Error Types

```typescript
type ErrorCode =
  | 'UNAUTHENTICATED'      // Not logged in
  | 'LIMIT_REACHED'        // Quota exceeded
  | 'WORD_REQUIRED'        // Empty word
  | 'WORD_TOO_LONG'        // >100 chars
  | 'SERVICE_UNAVAILABLE'  // Firebase down
  | 'AI_PROCESSING_FAILED' // OpenAI error
  | 'INTERNAL_ERROR'       // Unexpected error
  | 'NETWORK_ERROR'        // Fetch failed
  | 'PARSE_ERROR';         // Invalid JSON
```

### User-Facing Messages

```typescript
const errorMessages = {
  UNAUTHENTICATED: 'Please sign in to use word explanations',
  LIMIT_REACHED: 'Daily limit reached. Upgrade to Premium for unlimited!',
  WORD_TOO_LONG: 'Word is too long to analyze',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable. Please try again.',
  AI_PROCESSING_FAILED: 'Failed to generate explanation. Please try again.',
  NETWORK_ERROR: 'Network error. Check your connection.'
};
```

### Graceful Degradation

1. **Cache failure** → Fall through to AI generation
2. **AI failure** → Show error, allow retry
3. **Modal crash** → Error boundary catches, app continues
4. **Network offline** → Detect and show offline message

## 📱 Mobile Considerations

### Touch Optimization

- **Tap Targets**: Minimum 44x44px (iOS guidelines)
- **Debouncing**: Prevent double-taps
- **Modal**: Full-height on small screens
- **Scroll**: Native smooth scrolling
- **Font Sizes**: Responsive scaling

### PWA Support

- **Offline**: Cache explanations in IndexedDB (future)
- **Install**: Add to home screen with word lookup
- **Push**: Notifications for new features (optional)

## 🔒 Security

### Input Validation

```typescript
// Server-side validation in /api/word/explain
if (!word || word.length === 0) {
  return error('WORD_REQUIRED');
}

if (word.length > 100) {
  return error('WORD_TOO_LONG');
}

// Sanitize
const sanitized = word.trim();
```

### Rate Limiting

- **Client**: Quota system enforced
- **Server**: Firebase rate limiting (future)
- **IP-based**: Cloudflare protection

### Data Privacy

- **No PII**: Word lookups not linked to user identity in cache
- **GDPR**: User can request data deletion
- **Retention**: Cache auto-expires (7 days)

## 📊 Analytics & Monitoring

### Events to Track

```typescript
// Word explanation requested
analytics.track('word_explanation_requested', {
  word,
  cached: boolean,
  user_plan: 'free' | 'premium',
  jlpt_level: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
});

// Success
analytics.track('word_explanation_success', {
  word,
  processing_time_ms: number,
  cache_hit: boolean
});

// Error
analytics.track('word_explanation_error', {
  word,
  error_code: string
});

// Quota limit hit
analytics.track('word_explanation_limit_reached', {
  user_plan: string,
  words_explained_today: number
});
```

### Metrics Dashboard

Monitor:
- **Cache hit rate**: Target >90%
- **Average response time**: Target <500ms
- **Error rate**: Target <1%
- **Quota exhaustion**: Free users hitting limits
- **Popular words**: Most looked-up vocabulary

## 🚀 Deployment Checklist

### Environment Variables

```bash
# Required for production
FIREBASE_ADMIN_PROJECT_ID=moshimoshi-de237
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-...@moshimoshi-de237.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
OPENAI_API_KEY=sk-proj-...
OPEN_AI_API_KEY=sk-proj-...  # Duplicate for compatibility
```

### Firestore Setup

```bash
# Create collection (auto-created on first write)
wordExplanationCache/

# Indexes (optional, for performance)
- word (ascending)
- wordHash (ascending)
- createdAt (descending)
- accessCount (descending)
```

### Vercel Configuration

```bash
# Deploy with environment variables
vercel env add FIREBASE_ADMIN_PROJECT_ID
vercel env add FIREBASE_ADMIN_CLIENT_EMAIL
vercel env add FIREBASE_ADMIN_PRIVATE_KEY
vercel env add OPENAI_API_KEY
vercel env add OPEN_AI_API_KEY
```

## 🧪 Testing

### Manual Testing

See [`TESTING_GUIDE.md`](./TESTING_GUIDE.md) for comprehensive test cases.

### Quick Smoke Test

```bash
# 1. Start dev server
npm run dev

# 2. Navigate to article reader
# 3. Click on word "食べる"
# 4. Verify:
#    - Modal opens
#    - Loading spinner appears
#    - Explanation displays with:
#      ✓ Kanji breakdown (食)
#      ✓ Conjugation table
#      ✓ JLPT level (N5)
#      ✓ Example sentences
# 5. Close and reopen
#    - Should load instantly from cache
```

## 📚 Related Documentation

- **Integration Guide**: [`INTEGRATION_EXAMPLE.md`](./INTEGRATION_EXAMPLE.md)
- **Testing Guide**: [`TESTING_GUIDE.md`](./TESTING_GUIDE.md)
- **AI Service**: `/docs/AI_SERVICE.md` (if exists)
- **Grammar Explanation**: `/docs/grammar-explanation/GRAMMAR_EXPLANATION_TRIGGER.md`

## 🎯 Future Enhancements

### Phase 2 (Q2 2025)
- [ ] **Saved Words List**: Allow users to save words for later review
- [ ] **Custom Word Lists**: Create vocabulary lists from explained words
- [ ] **Offline Support**: IndexedDB cache for PWA
- [ ] **Audio Pronunciation**: TTS for word readings
- [ ] **Flashcard Generation**: Auto-create flashcards from lookups

### Phase 3 (Q3 2025)
- [ ] **SRS Integration**: Add explained words to review engine
- [ ] **Word of the Day**: Showcase interesting vocabulary
- [ ] **Usage Analytics**: Show user's vocabulary progress
- [ ] **Related Kanji**: Cross-link to kanji learning system
- [ ] **Community Notes**: User-contributed usage examples

## 👥 Credits

**Developed**: January 2025
**AI Model**: GPT-4o-mini
**Framework**: Next.js 15.5.2
**Database**: Firebase Firestore
**Caching**: Multi-tier (Component + Firestore + AI)

---

**Status**: ✅ Production Ready
**Version**: 1.0.0
**Last Updated**: 2025-01-10
