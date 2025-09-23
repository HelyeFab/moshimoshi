# KanjiDetailsModal Usage Guide

## Overview

`KanjiDetailsModal` is the centralized component for displaying detailed kanji information throughout the Moshimoshi application. This modal provides a consistent user experience for viewing kanji details, including meanings, readings, stroke order, example sentences with furigana, and practice options.

## Features

- **Kanji Information**: Displays meaning, on'yomi, kun'yomi readings
- **Stroke Order Animation**: Shows how to write the kanji correctly
- **Example Sentences**: Real-world usage with furigana support
- **Drawing Practice**: Interactive drawing practice mode
- **Audio Playback**: TTS for readings and example sentences
- **Mobile Optimized**: Responsive design with improved line height for furigana

## Installation

### 1. Import the Required Components

```typescript
import { useKanjiDetails } from '@/hooks/useKanjiDetails'
import KanjiDetailsModal from '@/components/kanji/KanjiDetailsModal'
```

### 2. Set Up the Hook

```typescript
const { modalKanji, openKanjiDetails, closeKanjiDetails } = useKanjiDetails()
```

### 3. Add the Modal to Your Component

```tsx
<KanjiDetailsModal
  kanji={modalKanji}
  isOpen={!!modalKanji}
  onClose={closeKanjiDetails}
/>
```

## Usage Examples

### Example 1: Simple Kanji Display with Details Button

```tsx
import { useKanjiDetails } from '@/hooks/useKanjiDetails'
import KanjiDetailsModal from '@/components/kanji/KanjiDetailsModal'

function KanjiCard({ kanji }) {
  const { modalKanji, openKanjiDetails, closeKanjiDetails } = useKanjiDetails()

  return (
    <>
      <div className="kanji-card">
        <span className="text-4xl">{kanji.kanji}</span>
        <button
          onClick={() => openKanjiDetails(kanji)}
          className="text-primary-500 hover:text-primary-600"
        >
          View Details
        </button>
      </div>

      <KanjiDetailsModal
        kanji={modalKanji}
        isOpen={!!modalKanji}
        onClose={closeKanjiDetails}
      />
    </>
  )
}
```

### Example 2: Making Individual Kanji Clickable in Text

```tsx
function VocabularyWord({ word }) {
  const { modalKanji, openKanjiDetails, closeKanjiDetails } = useKanjiDetails()

  return (
    <>
      <div className="word-display">
        {word.kanji.split('').map((char, idx) => {
          const isKanji = /[\u4e00-\u9faf]/.test(char)

          return isKanji ? (
            <span
              key={idx}
              className="cursor-pointer hover:text-primary-600"
              onClick={() => openKanjiDetails(char)}
              title={`View details for ${char}`}
            >
              {char}
            </span>
          ) : (
            <span key={idx}>{char}</span>
          )
        })}
      </div>

      <KanjiDetailsModal
        kanji={modalKanji}
        isOpen={!!modalKanji}
        onClose={closeKanjiDetails}
      />
    </>
  )
}
```

### Example 3: Info Icon for Kanji Details

```tsx
function StudyCard({ kanji }) {
  const { modalKanji, openKanjiDetails, closeKanjiDetails } = useKanjiDetails()

  return (
    <>
      <div className="study-card relative">
        <div className="text-8xl">{kanji.kanji}</div>

        {/* Info icon button */}
        <button
          onClick={() => openKanjiDetails(kanji)}
          className="absolute top-2 right-2 p-2 text-gray-400 hover:text-primary-500"
          aria-label="View kanji details"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>

      <KanjiDetailsModal
        kanji={modalKanji}
        isOpen={!!modalKanji}
        onClose={closeKanjiDetails}
      />
    </>
  )
}
```

## Data Formats

### Full Kanji Object

```typescript
interface Kanji {
  kanji: string          // The kanji character (required)
  meaning: string        // English meaning (required)
  onyomi?: string[]      // On'yomi readings
  kunyomi?: string[]     // Kun'yomi readings
  jlpt?: string          // JLPT level (N5, N4, N3, N2, N1)
  grade?: number         // School grade level
  frequency?: number     // Frequency rank
  strokes?: number       // Stroke count
}
```

### Minimal Kanji (Character Only)

When you only have a kanji character, you can pass it directly:

```typescript
openKanjiDetails('漢')  // The modal will fetch additional data
```

## Helper Functions

### Extract Kanji from Text

```typescript
import { extractKanjiFromText } from '@/hooks/useKanjiDetails'

const kanjiChars = extractKanjiFromText('日本語を勉強する')
// Returns: ['日', '本', '語', '勉', '強']
```

### Check if Character is Kanji

```typescript
import { isKanji } from '@/hooks/useKanjiDetails'

if (isKanji(char)) {
  // Make it clickable
}
```

## Current Implementations

The KanjiDetailsModal is currently implemented in:

1. **Kanji Browser** (`/kanji-browser`)
   - Main kanji browsing interface

2. **Kanji Mastery** (`/tools/kanji-mastery`)
   - Info icon in Round1Learn component

3. **Review Engine** (`/components/review-engine`)
   - KanjiCard component with details button

4. **Vocabulary Pages** (`/learn/vocabulary`)
   - Clickable kanji within vocabulary words

5. **Kanji Connection** (`/kanji-connection`)
   - Radicals, Families, and Visual Layout pages

6. **Kanji Moods** (`/kanji-moods`)
   - Moodboard kanji displays

## Styling Guidelines

### Mobile Optimization

The modal includes mobile-specific styling:
- Increased line height for better furigana readability
- Larger touch targets for interactive elements
- Responsive padding and spacing

### Dark Mode

The modal fully supports dark mode with appropriate color transitions:
- `dark:bg-dark-800` backgrounds
- `dark:text-gray-100` text colors
- `dark:border-dark-700` borders

## Performance Considerations

1. **Lazy Loading**: The modal fetches additional data (stroke order, examples) only when opened
2. **Caching**: Uses `useTTS` with `cacheFirst: true` for audio playback
3. **Furigana**: Automatically fetches furigana for example sentences via the `/api/furigana` endpoint

## Troubleshooting

### Modal Not Opening

Ensure you're passing the correct data format:
```typescript
// ✅ Correct
openKanjiDetails({ kanji: '漢', meaning: 'Chinese' })

// ✅ Also correct (minimal)
openKanjiDetails('漢')

// ❌ Wrong
openKanjiDetails({ character: '漢' })  // Wrong property name
```

### Furigana Not Showing

1. Check that the kuromoji dictionary files exist in `/public/kuromoji_dict/`
2. Verify the `/api/furigana` endpoint is working
3. Check the console for any API errors

### Missing Stroke Order

Stroke order SVGs are fetched from external sources. Ensure:
- Network connection is available
- The kanji character is common enough to have stroke order data

## Future Enhancements

- [ ] Add favorite/bookmark functionality directly in the modal
- [ ] Include compound words containing the kanji
- [ ] Show radical breakdown and components
- [ ] Add spaced repetition scheduling from the modal
- [ ] Include etymology and historical information

## Contributing

When adding KanjiDetailsModal to a new component:

1. Import the hook and modal component
2. Use the standard implementation pattern
3. Ensure consistent styling with existing implementations
4. Test on mobile devices for proper furigana display
5. Update this documentation with your implementation

---

Last Updated: January 2025
Author: Moshimoshi Development Team