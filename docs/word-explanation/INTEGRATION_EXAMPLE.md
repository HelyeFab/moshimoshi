# Word Explanation Integration Example

This document shows how to integrate the word explanation feature into components that use `GrammarHighlightedText`.

## Overview

The word explanation feature provides:
- **Comprehensive word definitions** with kanji breakdown
- **Conjugation tables** for verbs and adjectives
- **Pitch accent** patterns
- **Related words** (synonyms, antonyms, compounds)
- **JLPT level** classification
- **Usage notes** and example sentences
- **Firestore caching** for instant repeated lookups
- **Component-level memory cache** for same-session performance

## Quick Start

### 1. Import Dependencies

```typescript
import { useState } from 'react';
import { GrammarHighlightedText } from '@/components/reading/GrammarHighlightedText';
import WordExplanationModal from '@/components/word/WordExplanationModal';
import { useWordExplanation } from '@/hooks/useWordExplanation';
import { useToast } from '@/components/ui/Toast/ToastContext';
```

### 2. Set Up State and Hook

```typescript
function YourComponent() {
  const [isWordModalOpen, setIsWordModalOpen] = useState(false);
  const { showToast } = useToast();

  const {
    explainWord,
    loading: wordLoading,
    error: wordError,
    explanation: wordExplanation,
    currentWord,
    reset: resetWordExplanation
  } = useWordExplanation({
    onError: (error) => {
      showToast(error, 'error');
    },
    onSuccess: (explanation) => {
      console.log('✅ Word explained:', explanation.word);
    }
  });
```

### 3. Handle Word Clicks

```typescript
  const handleWordClick = async (word: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    setIsWordModalOpen(true);
    await explainWord(word);
  };

  const handleCloseWordModal = () => {
    setIsWordModalOpen(false);
    resetWordExplanation();
  };
```

### 4. Render Components

```typescript
  return (
    <>
      {/* Your text with grammar highlighting */}
      <GrammarHighlightedText
        text={yourJapaneseText}
        highlightMode="all"
        onWordClick={handleWordClick}
        showFurigana={true}
      />

      {/* Word Explanation Modal */}
      <WordExplanationModal
        isOpen={isWordModalOpen}
        onClose={handleCloseWordModal}
        word={currentWord}
        explanation={wordExplanation}
        loading={wordLoading}
        error={wordError}
      />
    </>
  );
}
```

## Complete Example: ArticleReader Component

Here's a complete example showing integration in the `ArticleReader` component:

```typescript
'use client';

import { useState } from 'react';
import { GrammarHighlightedText } from '@/components/reading/GrammarHighlightedText';
import WordExplanationModal from '@/components/word/WordExplanationModal';
import { useWordExplanation } from '@/hooks/useWordExplanation';
import { useToast } from '@/components/ui/Toast/ToastContext';

interface ArticleReaderProps {
  article: {
    title: string;
    content: string;
    // ... other fields
  };
}

export default function ArticleReader({ article }: ArticleReaderProps) {
  const { showToast } = useToast();
  const [highlightMode, setHighlightMode] = useState<'none' | 'all' | 'content' | 'grammar'>('all');
  const [showFurigana, setShowFurigana] = useState(true);

  // Word explanation state
  const [isWordModalOpen, setIsWordModalOpen] = useState(false);

  const {
    explainWord,
    loading: wordLoading,
    error: wordError,
    explanation: wordExplanation,
    currentWord,
    reset: resetWordExplanation
  } = useWordExplanation({
    onError: (error) => {
      showToast(\`Failed to explain word: \${error}\`, 'error');
    }
  });

  const handleWordClick = async (word: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    console.log('📖 Explaining word:', word);
    setIsWordModalOpen(true);
    await explainWord(word);
  };

  const handleCloseWordModal = () => {
    setIsWordModalOpen(false);
    resetWordExplanation();
  };

  return (
    <div className="article-reader">
      {/* Article Header */}
      <header>
        <h1>{article.title}</h1>

        {/* Reading Settings */}
        <div className="reading-controls">
          <label>
            <input
              type="checkbox"
              checked={showFurigana}
              onChange={(e) => setShowFurigana(e.target.checked)}
            />
            Show Furigana
          </label>

          <select
            value={highlightMode}
            onChange={(e) => setHighlightMode(e.target.value as any)}
          >
            <option value="none">No Highlighting</option>
            <option value="all">All Words</option>
            <option value="content">Content Words</option>
            <option value="grammar">Grammar Words</option>
          </select>
        </div>
      </header>

      {/* Article Content with Word Tapping */}
      <article className="content">
        <GrammarHighlightedText
          text={article.content}
          highlightMode={highlightMode}
          onWordClick={handleWordClick}
          showFurigana={showFurigana}
        />
      </article>

      {/* Word Explanation Modal */}
      <WordExplanationModal
        isOpen={isWordModalOpen}
        onClose={handleCloseWordModal}
        word={currentWord}
        explanation={wordExplanation}
        loading={wordLoading}
        error={wordError}
      />
    </div>
  );
}
```

## Advanced Usage

### With Context

You can provide context to improve explanation accuracy:

```typescript
const handleWordClick = async (word: string, event: React.MouseEvent, sentence?: string) => {
  setIsWordModalOpen(true);
  await explainWord(word, sentence); // Pass full sentence as context
};
```

### Custom Error Handling

```typescript
const {
  explainWord,
  // ... other values
} = useWordExplanation({
  onError: (error) => {
    if (error.includes('LIMIT_REACHED')) {
      showToast('Daily word explanation limit reached. Upgrade to Premium for unlimited access!', 'warning');
    } else if (error.includes('UNAUTHENTICATED')) {
      showToast('Please sign in to use word explanations', 'info');
    } else {
      showToast(\`Error: \${error}\`, 'error');
    }
  },
  onSuccess: (explanation) => {
    // Track analytics
    console.log('Word explained:', explanation.word, explanation.jlptLevel);
  }
});
```

### Cache Management

```typescript
const { clearCache } = useWordExplanation();

// Clear cache when user logs out or switches accounts
const handleLogout = () => {
  clearCache();
  // ... other logout logic
};
```

## Entitlements

The word explanation feature shares quota with grammar explanations:

| Plan      | Daily Limit |
|-----------|-------------|
| Guest     | 0           |
| Free      | 3           |
| Premium   | Unlimited   |

## Caching Strategy

1. **Component-Level Cache**: Instant (0ms) - lasts for component lifetime
2. **Firestore Cache**: ~100ms - persists across sessions (7 days TTL)
3. **AI Generation**: ~2-3s - only when cache misses

## Mobile Considerations

On mobile devices, word tapping works seamlessly:

```typescript
// The onClick handler works for both desktop and mobile
<GrammarHighlightedText
  text={text}
  highlightMode="all"
  onWordClick={handleWordClick} // Works on tap for mobile
  showFurigana={true}
/>
```

## Troubleshooting

### Modal not appearing

Ensure the modal is rendered outside any overflow containers:

```typescript
// Modal uses createPortal internally, so it renders to document.body
// No special setup needed
```

### Word not being explained

Check browser console for:
- Network errors (API unreachable)
- Entitlement errors (quota exceeded)
- Validation errors (word too long)

### Cache not working

- Verify Firebase Admin credentials are set in environment
- Check that `wordExplanationCache` collection exists in Firestore
- Review server logs for cache read/write errors

## Testing Checklist

- [ ] Tap on nouns → Explanation appears with kanji breakdown
- [ ] Tap on verbs → Conjugation table shown
- [ ] Tap on adjectives → Conjugation table shown
- [ ] Tap on particles → Grammar explanation shown
- [ ] Repeat tap on same word → Loads instantly from cache
- [ ] Reach quota limit → Proper error message shown
- [ ] Test on mobile → Tapping works smoothly
- [ ] Test various JLPT levels → Appropriate explanations
- [ ] Check Firestore → `wordExplanationCache` collection has entries

## Files Modified

- ✅ `/src/lib/ai/types.ts` - Type definitions
- ✅ `/src/lib/ai/processors/WordExplainerProcessor.ts` - AI processor
- ✅ `/src/lib/ai/cache/WordExplanationCache.ts` - Firestore cache
- ✅ `/src/app/api/word/explain/route.ts` - API endpoint
- ✅ `/src/lib/ai/AIService.ts` - Service routing
- ✅ `/src/components/word/WordExplanationModal.tsx` - Modal UI
- ✅ `/src/hooks/useWordExplanation.ts` - React hook

## Next Steps

1. **Add to existing readers**: Integrate into StoryReader, EnhancedShadowingPlayer
2. **Analytics**: Track which words users look up most
3. **Saved words list**: Allow users to save words for review
4. **Custom word lists**: Create vocabulary lists from explained words
5. **Offline support**: Cache explanations in IndexedDB for PWA

---

**Last Updated**: 2025-01-10
**Feature**: Word Explanation System
