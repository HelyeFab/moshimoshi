# Grammar Stall Technical Design

**Project**: Moshimoshi Grammar Guide Stall
**Version**: 1.0.0
**Last Updated**: 2026-01-16

---

## 🏗️ Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Browser                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Next.js App Router                        │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │  /learn/grammar (Grid View)                │  │  │
│  │  │    - GrammarPointGrid Component            │  │  │
│  │  │    - Server Component (RSC)                │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │  /learn/grammar/[pointId] (Detail View)    │  │  │
│  │  │    - GrammarPointDetail Component          │  │  │
│  │  │    - Server Component (RSC)                │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │  /learn/grammar/[pointId]/practice         │  │  │
│  │  │    - ExerciseContainer Component           │  │  │
│  │  │    - Client Component ('use client')       │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Static JSON Data Layer                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │  /public/data/grammar/                           │  │
│  │    ├── n5-index.json                             │  │
│  │    ├── points/                                   │  │
│  │    │   ├── x-wa-y-desu.json                      │  │
│  │    │   └── ... (80 files)                        │  │
│  │    └── exercises/                                │  │
│  │        ├── x-wa-y-desu.json                      │  │
│  │        └── ... (80 files)                        │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Rendering Strategy

- **Grammar Grid Page**: Server Component (RSC) - Pre-renders at build time
- **Grammar Detail Page**: Server Component (RSC) - Static generation with `generateStaticParams`
- **Exercise Page**: Client Component - Interactive state, answer validation

### Why This Architecture?

1. **Server Components for Content**: Grammar explanations are static → server-render for SEO and performance
2. **Client Components for Interactivity**: Exercises need state management → client-side rendering
3. **Static JSON**: No database complexity, fast CDN delivery, offline-capable
4. **No API Routes**: Direct file fetching eliminates unnecessary complexity

---

## 📁 Detailed File Structure

```
moshimoshi/
├── src/
│   ├── app/
│   │   └── [locale]/
│   │       └── learn/
│   │           └── grammar/                    # Grammar stall root
│   │               ├── page.tsx                # Grid view (SERVER)
│   │               ├── layout.tsx              # Shared layout
│   │               └── [pointId]/
│   │                   ├── page.tsx            # Detail view (SERVER)
│   │                   └── practice/
│   │                       └── page.tsx        # Exercise view (CLIENT)
│   │
│   ├── components/
│   │   └── grammar/                            # Grammar-specific components
│   │       ├── GrammarPointGrid.tsx            # SERVER - Grid of cards
│   │       ├── GrammarPointCard.tsx            # SERVER - Individual card
│   │       ├── GrammarPointDetail.tsx          # SERVER - Detail display
│   │       ├── ExampleSentence.tsx             # SERVER - Example display
│   │       ├── GrammarStructure.tsx            # SERVER - Structure diagram
│   │       ├── RelatedPoints.tsx               # SERVER - Related links
│   │       ├── ExerciseContainer.tsx           # CLIENT - Exercise wrapper
│   │       ├── ExerciseFeedback.tsx            # CLIENT - Answer feedback
│   │       ├── ExerciseProgress.tsx            # CLIENT - Progress bar
│   │       └── exercises/
│   │           ├── MultipleChoice.tsx          # CLIENT - MC exercise
│   │           ├── FillInBlank.tsx             # CLIENT - Fill-in exercise
│   │           └── SentenceMatching.tsx        # CLIENT - Matching exercise
│   │
│   ├── lib/
│   │   └── grammar/                            # Grammar business logic
│   │       ├── grammarService.ts               # Load grammar data
│   │       ├── exerciseValidator.ts            # Validate answers
│   │       ├── exerciseEngine.ts               # Exercise state machine
│   │       ├── furiganaHelper.ts               # Add furigana to text
│   │       └── types.ts                        # TypeScript interfaces
│   │
│   └── types/
│       └── grammar.ts                          # Shared type exports
│
├── public/
│   └── data/
│       └── grammar/                            # Static JSON data
│           ├── n5-index.json                   # Index of all points
│           ├── points/                         # Grammar point data
│           │   ├── 001-x-wa-y-desu.json
│           │   ├── 002-particles-wa.json
│           │   └── ... (80 files)
│           └── exercises/                      # Exercise data
│               ├── 001-x-wa-y-desu.json
│               ├── 002-particles-wa.json
│               └── ... (80 files)
│
└── 01_PRODUCTION_DOCS/
    └── grammar-stall-mvp/                      # This documentation
        ├── MVP_SPECIFICATION.md
        ├── TECHNICAL_DESIGN.md (you are here)
        ├── DATA_SCHEMA.md
        └── AGENT_PROMPTS/
            ├── TECHNICAL_LEAD.md
            ├── AGENT_1_DATA.md
            ├── AGENT_2_UI.md
            └── AGENT_3_LOGIC.md
```

---

## 🔧 Component Design

### Grammar Point Grid (Server Component)

**File**: `src/components/grammar/GrammarPointGrid.tsx`

```typescript
import { GrammarPointCard } from './GrammarPointCard'
import { GrammarPointIndex } from '@/lib/grammar/types'

interface GrammarPointGridProps {
  points: GrammarPointIndex[]
  locale: string
}

export function GrammarPointGrid({ points, locale }: GrammarPointGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
      {points.map(point => (
        <GrammarPointCard key={point.id} point={point} locale={locale} />
      ))}
    </div>
  )
}
```

**Responsibilities**:
- Render grid of grammar cards
- Responsive layout (2/3/4 columns)
- Pass locale for i18n support

**Data Source**: Server-side fetch from `n5-index.json`

---

### Grammar Point Card (Server Component)

**File**: `src/components/grammar/GrammarPointCard.tsx`

```typescript
import Link from 'next/link'
import { GrammarPointIndex } from '@/lib/grammar/types'

interface GrammarPointCardProps {
  point: GrammarPointIndex
  locale: string
}

export function GrammarPointCard({ point, locale }: GrammarPointCardProps) {
  return (
    <Link href={`/${locale}/learn/grammar/${point.id}`}>
      <div className="border rounded-lg p-4 hover:shadow-lg transition">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-bold">{point.title.ja}</h3>
          <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded">
            N5
          </span>
        </div>
        <p className="text-sm text-gray-600 mb-1">{point.title.romaji}</p>
        <p className="text-sm">{point.title.en}</p>
        <p className="text-xs text-gray-500 mt-2">{point.shortDescription}</p>
      </div>
    </Link>
  )
}
```

**Responsibilities**:
- Display grammar point summary
- Link to detail page
- Show JLPT level badge
- Hover effects

---

### Grammar Point Detail (Server Component)

**File**: `src/components/grammar/GrammarPointDetail.tsx`

```typescript
import { GrammarPoint } from '@/lib/grammar/types'
import { ExampleSentence } from './ExampleSentence'
import { GrammarStructure } from './GrammarStructure'
import { RelatedPoints } from './RelatedPoints'
import Link from 'next/link'

interface GrammarPointDetailProps {
  point: GrammarPoint
  locale: string
}

export function GrammarPointDetail({ point, locale }: GrammarPointDetailProps) {
  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{point.title.ja}</h1>
        <p className="text-xl text-gray-600 mb-1">{point.title.romaji}</p>
        <p className="text-lg">{point.title.en}</p>
      </div>

      {/* Explanation */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Explanation</h2>
        <div className="prose max-w-none">
          {point.explanation.en}
        </div>
      </section>

      {/* Structure */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Structure</h2>
        <GrammarStructure structure={point.structure} />
      </section>

      {/* Examples */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Examples</h2>
        {point.examples.map((example, idx) => (
          <ExampleSentence key={idx} example={example} />
        ))}
      </section>

      {/* Related Grammar */}
      {point.relatedPoints.length > 0 && (
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Related Grammar</h2>
          <RelatedPoints pointIds={point.relatedPoints} locale={locale} />
        </section>
      )}

      {/* Practice Button */}
      <div className="text-center mt-12">
        <Link
          href={`/${locale}/learn/grammar/${point.id}/practice`}
          className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700"
        >
          Practice Exercises
        </Link>
      </div>
    </div>
  )
}
```

**Responsibilities**:
- Display full grammar explanation
- Show examples with breakdowns
- Link to related grammar
- CTA to practice exercises

---

### Exercise Container (Client Component)

**File**: `src/components/grammar/ExerciseContainer.tsx`

```typescript
'use client'

import { useState } from 'react'
import { Exercise, ExerciseResult } from '@/lib/grammar/types'
import { validateAnswer } from '@/lib/grammar/exerciseValidator'
import { MultipleChoice } from './exercises/MultipleChoice'
import { FillInBlank } from './exercises/FillInBlank'
import { ExerciseFeedback } from './ExerciseFeedback'
import { ExerciseProgress } from './ExerciseProgress'

interface ExerciseContainerProps {
  exercises: Exercise[]
  grammarPointId: string
}

export function ExerciseContainer({ exercises, grammarPointId }: ExerciseContainerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [feedback, setFeedback] = useState<ExerciseResult | null>(null)

  const currentExercise = exercises[currentIndex]

  const handleAnswer = (userAnswer: string | string[]) => {
    const result = validateAnswer(currentExercise, userAnswer)
    setFeedback(result)
  }

  const handleNext = () => {
    setFeedback(null)
    setCurrentIndex(prev => Math.min(prev + 1, exercises.length - 1))
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <ExerciseProgress current={currentIndex + 1} total={exercises.length} />

      <div className="my-8">
        {currentExercise.type === 'multiple-choice' && (
          <MultipleChoice exercise={currentExercise} onAnswer={handleAnswer} />
        )}
        {currentExercise.type === 'fill-in-blank' && (
          <FillInBlank exercise={currentExercise} onAnswer={handleAnswer} />
        )}
      </div>

      {feedback && (
        <ExerciseFeedback result={feedback} onNext={handleNext} />
      )}
    </div>
  )
}
```

**Responsibilities**:
- Manage exercise state (current question, feedback)
- Route to correct exercise component
- Handle answer submission
- Progress tracking (1/10, 2/10, etc.)

---

## 🔄 Data Flow

### Loading Grammar Points (Server Side)

```typescript
// src/app/[locale]/learn/grammar/page.tsx
import { getGrammarIndex } from '@/lib/grammar/grammarService'
import { GrammarPointGrid } from '@/components/grammar/GrammarPointGrid'

export default async function GrammarPage({ params }: { params: { locale: string } }) {
  const grammarPoints = await getGrammarIndex()

  return (
    <div>
      <h1>N5 Grammar Points</h1>
      <GrammarPointGrid points={grammarPoints} locale={params.locale} />
    </div>
  )
}

// src/lib/grammar/grammarService.ts
export async function getGrammarIndex(): Promise<GrammarPointIndex[]> {
  const response = await fetch('/data/grammar/n5-index.json')
  const data = await response.json()
  return data.points
}
```

### Loading Grammar Detail (Server Side)

```typescript
// src/app/[locale]/learn/grammar/[pointId]/page.tsx
import { getGrammarPoint } from '@/lib/grammar/grammarService'
import { GrammarPointDetail } from '@/components/grammar/GrammarPointDetail'

export async function generateStaticParams() {
  const index = await getGrammarIndex()
  return index.map(point => ({ pointId: point.id }))
}

export default async function GrammarDetailPage({
  params,
}: {
  params: { locale: string; pointId: string }
}) {
  const point = await getGrammarPoint(params.pointId)

  return <GrammarPointDetail point={point} locale={params.locale} />
}

// src/lib/grammar/grammarService.ts
export async function getGrammarPoint(id: string): Promise<GrammarPoint> {
  const response = await fetch(`/data/grammar/points/${id}.json`)
  const data = await response.json()
  return data
}
```

### Loading Exercises (Client Side)

```typescript
// src/app/[locale]/learn/grammar/[pointId]/practice/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { Exercise } from '@/lib/grammar/types'
import { ExerciseContainer } from '@/components/grammar/ExerciseContainer'

export default function PracticePage({
  params,
}: {
  params: { pointId: string }
}) {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/data/grammar/exercises/${params.pointId}.json`)
      .then(res => res.json())
      .then(data => {
        setExercises(data.exercises)
        setLoading(false)
      })
  }, [params.pointId])

  if (loading) return <div>Loading exercises...</div>

  return <ExerciseContainer exercises={exercises} grammarPointId={params.pointId} />
}
```

---

## 🧪 Answer Validation Logic

**File**: `src/lib/grammar/exerciseValidator.ts`

```typescript
import { Exercise, ExerciseResult } from './types'

export function validateAnswer(
  exercise: Exercise,
  userAnswer: string | string[]
): ExerciseResult {
  const normalized = normalizeAnswer(userAnswer)
  const correctNormalized = normalizeAnswer(exercise.correctAnswer)

  // Exact match
  if (normalized === correctNormalized) {
    return {
      isCorrect: true,
      message: exercise.correctFeedback || 'Correct!',
      correctAnswer: exercise.correctAnswer,
    }
  }

  // Check accepted variations
  if (exercise.acceptedVariations) {
    const isAccepted = exercise.acceptedVariations.some(
      variation => normalizeAnswer(variation) === normalized
    )
    if (isAccepted) {
      return {
        isCorrect: true,
        message: exercise.correctFeedback || 'Correct!',
        correctAnswer: exercise.correctAnswer,
      }
    }
  }

  // Incorrect
  return {
    isCorrect: false,
    message: exercise.incorrectFeedback || `The correct answer is: ${exercise.correctAnswer}`,
    correctAnswer: exercise.correctAnswer,
    explanation: exercise.explanation,
  }
}

function normalizeAnswer(answer: string | string[]): string {
  if (Array.isArray(answer)) {
    return answer.map(a => a.trim().toLowerCase()).join('|')
  }
  return answer.trim().toLowerCase()
}
```

**Normalization Rules**:
- Trim whitespace
- Convert to lowercase (for romaji/English)
- Support multiple answers (arrays)
- Support accepted variations (e.g., "は" vs "wa")

---

## 🎨 Styling Approach

### Tailwind CSS Classes

**Consistent Spacing**:
- Container: `max-w-4xl mx-auto p-6`
- Sections: `mb-8`
- Headers: `mb-4`

**Typography Scale**:
- Page title: `text-3xl font-bold`
- Section title: `text-2xl font-semibold`
- Card title: `text-lg font-bold`
- Body text: `text-base`
- Small text: `text-sm`
- Tiny text: `text-xs`

**Color Palette**:
- Primary (blue): `bg-blue-600`, `text-blue-600`
- Success (green): `bg-green-600`, `text-green-600`
- Error (red): `bg-red-600`, `text-red-600`
- Neutral: `bg-gray-100`, `text-gray-600`, `text-gray-900`

**Responsive Grid**:
```css
grid-cols-2      /* Mobile: 2 columns */
md:grid-cols-3   /* Tablet: 3 columns */
lg:grid-cols-4   /* Desktop: 4 columns */
```

---

## 🌐 Internationalization (i18n)

### Locale Support

**Current**: English (`en`)
**Future**: Japanese (`ja`)

### i18n Strategy for MVP

**Grammar Content**: English only for MVP
- Explanations in English
- UI labels in English
- Examples show Japanese + English translation

**Post-MVP**: Add Japanese explanations
- Use existing moshimoshi i18n system (`useI18n` hook)
- Add `ja` translations to grammar JSON files

### File Naming Convention

```
/public/data/grammar/points/
  └── 001-x-wa-y-desu.json  # Contains both 'en' and 'ja' fields
```

JSON structure already supports multiple languages:
```json
{
  "title": {
    "en": "X is Y",
    "ja": "XはYです"
  },
  "explanation": {
    "en": "English explanation...",
    "ja": "日本語の説明..."
  }
}
```

For MVP, only populate `"en"` fields. Leave `"ja"` fields as empty strings.

---

## ⚡ Performance Optimization

### Static Generation

```typescript
// Enable static generation for all grammar pages
export const dynamic = 'force-static'

// Pre-generate all grammar point pages at build time
export async function generateStaticParams() {
  const index = await getGrammarIndex()
  return index.map(point => ({ pointId: point.id }))
}
```

**Result**: All pages pre-rendered, instant load from CDN

### Code Splitting

- Grammar grid: Server Component → in main bundle
- Grammar detail: Server Component → in main bundle
- Exercise page: Client Component → separate chunk (lazy loaded)

### Image Optimization

Not applicable for MVP (text-only content)

### Bundle Size

- Keep dependencies minimal
- No heavy libraries (charts, animations)
- Total JS bundle target: <100kb gzipped

---

## 🧪 Testing Strategy

### Unit Tests (Not Required for MVP)

Future: Test `exerciseValidator.ts` with Jest

### Manual Testing Checklist

**Grammar Grid Page**:
- [ ] All 80 cards visible
- [ ] Cards display correctly on mobile (2 columns)
- [ ] Cards display correctly on desktop (4 columns)
- [ ] Clicking card navigates to detail page
- [ ] JLPT badge shows "N5"

**Grammar Detail Page**:
- [ ] Title, romaji, English all visible
- [ ] Explanation renders correctly
- [ ] Examples show Japanese + English
- [ ] Related points are clickable links
- [ ] "Practice Exercises" button works
- [ ] Back navigation works

**Exercise Page**:
- [ ] Progress shows correct count (1/10, 2/10, etc.)
- [ ] Multiple choice: selecting answer works
- [ ] Fill-in-blank: typing answer works
- [ ] Correct answer shows success feedback
- [ ] Incorrect answer shows error feedback
- [ ] "Next" button advances to next question
- [ ] Last question shows completion message

**Cross-Browser**:
- [ ] Chrome (desktop + mobile)
- [ ] Firefox
- [ ] Safari (iOS)

**Accessibility**:
- [ ] Keyboard navigation works (Tab, Enter)
- [ ] Screen reader announces page changes
- [ ] Focus indicators visible
- [ ] Color contrast meets WCAG AA (4.5:1)

---

## 🚀 Deployment

### Build Process

```bash
# 1. Install dependencies (if needed)
npm install

# 2. Build Next.js app
npm run build

# 3. Test production build locally
npm run start

# 4. Deploy to Vercel/production
git push origin grammar-stall-mvp
```

### Static Assets

Grammar JSON files in `/public/data/grammar/` are automatically served by Next.js:
- URL: `https://moshimoshi.app/data/grammar/n5-index.json`
- Cached by CDN
- No build step required

### Environment Variables

None required for MVP (no API keys, no database)

---

## 🔒 Security Considerations

### No User Input Stored

Exercise answers are validated client-side only, never sent to server.

### Static JSON Validation

All JSON files should be validated during build:

```typescript
// Optional: Add JSON schema validation in build script
import Ajv from 'ajv'
import grammarPointSchema from './schemas/grammarPoint.json'

const ajv = new Ajv()
const validate = ajv.compile(grammarPointSchema)

// Validate each JSON file
const valid = validate(grammarPointData)
if (!valid) {
  throw new Error(`Invalid grammar point: ${validate.errors}`)
}
```

### XSS Prevention

All user input in exercises is sanitized:
- React automatically escapes text
- No `dangerouslySetInnerHTML` used
- No user-generated content

---

## 📊 Monitoring & Analytics

### MVP: No Analytics

For simplicity, no tracking in MVP.

### Post-MVP: Optional Analytics

If we add analytics later:
- Page views per grammar point
- Exercise completion rate
- Time spent on exercises
- Most common incorrect answers (for content improvement)

---

## 🐛 Error Handling

### Missing Grammar Point

```typescript
// src/app/[locale]/learn/grammar/[pointId]/page.tsx
export default async function GrammarDetailPage({ params }) {
  try {
    const point = await getGrammarPoint(params.pointId)
    return <GrammarPointDetail point={point} />
  } catch (error) {
    return (
      <div className="text-center p-8">
        <h1 className="text-2xl font-bold mb-4">Grammar Point Not Found</h1>
        <Link href="/learn/grammar">← Back to all grammar points</Link>
      </div>
    )
  }
}
```

### Missing Exercises

```typescript
// Client-side error handling
useEffect(() => {
  fetch(`/data/grammar/exercises/${params.pointId}.json`)
    .then(res => {
      if (!res.ok) throw new Error('Exercises not found')
      return res.json()
    })
    .then(data => setExercises(data.exercises))
    .catch(error => {
      setError('Exercises not available for this grammar point.')
      setLoading(false)
    })
}, [params.pointId])
```

### Malformed JSON

JSON syntax errors will be caught at build time by Next.js. No runtime validation needed.

---

## 🔄 Future Enhancements (Post-MVP)

These are explicitly out of scope but documented for future reference:

1. **Universal Review Engine Integration**
   - Add grammar points to URE as `ReviewableContent`
   - Create `GrammarPointAdapter`
   - Enable SRS scheduling

2. **Progress Tracking**
   - Store completed exercises in IndexedDB
   - Show completion badges on cards
   - Track mastery level per grammar point

3. **Search & Filter**
   - Search by grammar title or keyword
   - Filter by category (particles, verbs, adjectives)
   - Sort by difficulty or JLPT level

4. **N4/N3/N2/N1 Content**
   - Add higher level grammar points
   - Category filter by JLPT level

5. **Admin Panel**
   - CMS for editing grammar points
   - Bulk import from CSV
   - Preview before publish

---

## 📞 Technical Support

**Questions during development?**
- Technical Lead: See `AGENT_PROMPTS/TECHNICAL_LEAD.md`
- Agent-specific: See your respective prompt file

**Document Version**: 1.0.0
**Status**: Ready for Implementation
