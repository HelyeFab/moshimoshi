# Kanji Progress Summary Component

**Status:** ACTIVE
**Last Updated:** 2026-01-27
**Component:** `src/app/[locale]/tools/kanji-mastery/components/KanjiProgressSummary.tsx`

---

## Overview

The `KanjiProgressSummary` component displays a user's kanji learning progress with interactive kanji grids, statistics, and modal integration. It supports both free users (IndexedDB storage) and premium users (Firebase cloud storage).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        KanjiProgressSummary Component                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐     ┌─────────────────────────────────────────────────┐│
│  │   User Type     │     │              Data Source                        ││
│  │   Detection     │────▶│  Premium: /api/kanji-mastery/session           ││
│  │                 │     │  Free: IndexedDB (local storage)               ││
│  └─────────────────┘     └────────────────────┬────────────────────────────┘│
│                                               │                              │
│                                               ▼                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        Progress Data Structure                          ││
│  │  {                                                                      ││
│  │    totalStudied: number,                                                ││
│  │    mastered: number,                                                    ││
│  │    accuracy: number,                                                    ││
│  │    dayStreak: number,                                                   ││
│  │    progressByLevel: { [level: string]: { total, studied, mastered } }, ││
│  │    kanjiProgress: [ { character, level, lastReviewed, srsStatus } ]    ││
│  │  }                                                                      ││
│  └────────────────────────────────┬────────────────────────────────────────┘│
│                                   │                                          │
│                                   ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                          UI Components                                  ││
│  │                                                                         ││
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────────┐  ││
│  │  │  Stats Cards  │  │  Level Grid   │  │    Interactive Kanji      │  ││
│  │  │  - Studied    │  │  (N5-N1 bars) │  │    Grids (clickable)      │  ││
│  │  │  - Mastered   │  │               │  │    - Mastered (green)     │  ││
│  │  │  - Accuracy   │  │               │  │    - In Review (amber)    │  ││
│  │  │  - Streak     │  │               │  │    - In Learning (blue)   │  ││
│  │  └───────────────┘  └───────────────┘  └────────────┬──────────────┘  ││
│  │                                                      │                  ││
│  │                                                      ▼                  ││
│  │                                        ┌───────────────────────────┐   ││
│  │                                        │   KanjiDetailsModal       │   ││
│  │                                        │   (opens on kanji click)  │   ││
│  │                                        └───────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Sources

### Premium Users (Firebase)

Premium users have their kanji progress stored in Firebase Firestore. The component fetches this data via the API:

```typescript
// API Endpoint: GET /api/kanji-mastery/session
// Returns:
{
  kanjiProgress: [
    {
      character: '日',
      level: 'N5',
      lastReviewed: '2026-01-27T10:30:00Z',
      srsStatus: 'review'  // 'learning' | 'review' | 'mastered'
    },
    // ... more kanji
  ],
  // ... other session data
}
```

**API File:** `src/app/api/kanji-mastery/session/route.ts`

The API queries the user's `kanji_progress` subcollection and transforms the data:

```typescript
// Determine SRS status from state
const srsStatus = progress.srsState === 'MASTERED'
  ? 'mastered'
  : progress.srsState === 'REVIEW'
    ? 'review'
    : 'learning'
```

### Free Users (IndexedDB)

Free users store progress locally in IndexedDB. The component reads directly from the browser storage:

```typescript
// IndexedDB Store: moshimoshi_progress
// Key: kanji_progress
```

---

## Interactive Kanji Grids

### Grid Types

The component displays three interactive grids based on SRS status:

| Grid | Color | SRS Status | Description |
|------|-------|------------|-------------|
| Mastered | Green (`bg-green-50`) | `mastered` | Items with 21+ day intervals, 90% accuracy |
| In Review | Amber (`bg-amber-50`) | `review` | Items in the review phase |
| In Learning | Blue (`bg-blue-50`) | `learning` | New items in initial learning steps |

### Responsive Layout

The grids use a mobile-optimized flex layout with fixed-size kanji cells:

```typescript
// Grid container
<div className="flex flex-wrap gap-1.5">
  {/* Kanji cells - fixed 36x36px */}
  <button className="w-9 h-9 flex items-center justify-center ...">
    {character}
  </button>
</div>
```

**Design Decision:** Changed from CSS Grid with `aspect-square` to flexbox with fixed dimensions for better mobile experience - prevents oversized kanji boxes.

### Click Interaction

Each kanji is clickable and opens the `KanjiDetailsModal`:

```typescript
const handleKanjiClick = useCallback(async (character: string) => {
  const kanjiDetails = await kanjiService.getKanjiDetails(character)
  if (kanjiDetails) {
    setModalKanji(kanjiDetails)
  }
}, [])
```

**Hover Effect:** `hover:scale-110 transition-all` for visual feedback.

---

## Internationalization (i18n)

All UI strings use the project's custom i18n system via `useI18n()` hook.

### Translation Keys

Located in `src/i18n/locales/{lang}/strings.ts` under `kanjiMasteryTool.progress`:

```typescript
kanjiMasteryTool: {
  progress: {
    title: 'Your Progress',
    kanjiStudied: 'Kanji Studied',
    mastered: 'Mastered',
    accuracy: 'Accuracy',
    dayStreak: 'Day Streak',
    progressByLevel: 'Progress by Level',
    studied: 'studied',
    masteredKanji: 'Mastered Kanji',
    inReview: 'In Review',
    inLearning: 'In Learning',
    hoverForDetails: 'Hover over a kanji to see details',
    lastStudied: 'Last studied:',
  },
}
```

### Supported Languages

| Language | Locale File |
|----------|-------------|
| English | `en/strings.ts` |
| Japanese | `ja/strings.ts` |
| German | `de/strings.ts` |
| French | `fr/strings.ts` |
| Spanish | `es/strings.ts` |
| Italian | `it/strings.ts` |

### Usage Pattern

```typescript
import { useI18n } from '@/i18n/I18nContext'

function KanjiProgressSummary() {
  const { t } = useI18n()

  return (
    <h2>{t('kanjiMasteryTool.progress.title')}</h2>
    <p>{t('kanjiMasteryTool.progress.masteredKanji')}</p>
  )
}
```

**Note:** The project uses a custom `useI18n()` hook from `@/i18n/I18nContext`, NOT `useTranslations` from `next-intl`.

---

## Component Dependencies

### Imports

```typescript
import { useEffect, useState, useCallback } from 'react'
import { useI18n } from '@/i18n/I18nContext'
import KanjiDetailsModal from '@/components/kanji/KanjiDetailsModal'
import { kanjiService } from '@/services/kanjiService'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import type { Kanji } from '@/types/kanji'
```

### External Components

| Component | Purpose |
|-----------|---------|
| `KanjiDetailsModal` | Shows full kanji details (readings, meanings, examples) |
| `MobileNavSpacer` | Adds bottom padding for mobile navigation bar |

### Services

| Service | Purpose |
|---------|---------|
| `kanjiService.getKanjiDetails(character)` | Fetches complete kanji data for modal |

---

## State Management

```typescript
// Progress data from API/IndexedDB
const [progressData, setProgressData] = useState<ProgressData | null>(null)

// Loading state
const [isLoading, setIsLoading] = useState(true)

// Modal state for kanji details
const [modalKanji, setModalKanji] = useState<Kanji | null>(null)
```

---

## Error Handling

The component gracefully handles:

1. **API failures** - Falls back to showing cached/empty state
2. **Missing kanji data** - Silently ignores if `kanjiService.getKanjiDetails()` returns null
3. **Empty progress** - Shows zero values rather than errors

---

## File References

| File | Purpose |
|------|---------|
| `src/app/[locale]/tools/kanji-mastery/components/KanjiProgressSummary.tsx` | Main component |
| `src/app/api/kanji-mastery/session/route.ts` | API for premium user data |
| `src/components/kanji/KanjiDetailsModal.tsx` | Kanji details modal |
| `src/services/kanjiService.ts` | Kanji data service |
| `src/components/layout/MobileNavSpacer.tsx` | Mobile navigation spacer |
| `src/i18n/locales/*/strings.ts` | Translation files (6 languages) |

---

## Testing Considerations

### Premium User Flow
1. Sign in with a premium account
2. Complete some kanji reviews
3. Navigate to Kanji Mastery page
4. Verify progress grids show individual kanji
5. Click a kanji to verify modal opens

### Free User Flow
1. Use app without signing in (or as free user)
2. Complete kanji reviews (stored in IndexedDB)
3. Verify progress displays from local storage

### Mobile Testing
1. Test on mobile viewport (< 768px)
2. Verify kanji grids use compact 36x36px cells
3. Verify `MobileNavSpacer` prevents content from hiding behind nav

### i18n Testing
1. Switch language in app settings
2. Verify all progress labels translate correctly
3. Test all 6 supported languages

---

## Related Documentation

- [Universal Review Engine](/docs/REVIEW_ENGINE_DEEP_DIVE.md) - SRS algorithm details
- [Kanji Mastery Tool](/docs/KANJI_MASTERY_TOOL.md) - Full tool documentation
- [Authentication Flow](../authentication/AUTH_FLOW_DEBUG_GUIDE.md) - User type detection

---

*Last Updated: 2026-01-27*
