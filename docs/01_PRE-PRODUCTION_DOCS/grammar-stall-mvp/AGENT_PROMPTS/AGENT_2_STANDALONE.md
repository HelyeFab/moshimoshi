# Agent 2 - UI Engineer (Standalone Prompt)

**Role**: UI/UX Component Developer
**Project**: Grammar Stall MVP
**Timeline**: Days 3-5
**Branch**: `grammar-stall-mvp-agent2-ui`

---

## 🎯 Your Mission

Build all React components for the grammar stall. Your deliverables:

1. **Grammar Point Grid** - Browse all 80 points
2. **Grammar Point Detail** - View explanation and examples
3. **Component Library** - Reusable grammar display components
4. **Routing** - Next.js App Router pages
5. **Responsive Design** - Mobile, tablet, desktop

**Total**: ~8 components + 3 pages + 1 layout

---

## 📅 Your Schedule

### Day 3: Grid & Card
- Set up routing
- Create GrammarPointGrid + GrammarPointCard
- Test with Agent 1's 10 grammar points
- Make responsive

### Day 4: Detail View
- Create GrammarPointDetail
- Create ExampleSentence, GrammarStructure, RelatedPoints
- Add "Practice Exercises" button
- Test navigation

### Day 5: Polish
- Create shared layout
- Mobile testing & fixes
- Accessibility audit
- Loading/error states

---

## 📁 Files You'll Create

```
/src/app/[locale]/learn/grammar/
├── page.tsx                    # Grid view
├── layout.tsx                  # Shared layout
└── [pointId]/
    └── page.tsx                # Detail view

/src/components/grammar/
├── GrammarPointGrid.tsx        # Grid container
├── GrammarPointCard.tsx        # Card component
├── GrammarPointDetail.tsx      # Detail display
├── ExampleSentence.tsx         # Example with breakdown
├── GrammarStructure.tsx        # Structure diagram
└── RelatedPoints.tsx           # Related links

/src/lib/grammar/
└── grammarService.ts           # Data loading
```

---

## 📊 DATA TYPES YOU'LL USE

Agent 1 created these TypeScript interfaces. You'll import them from `/src/lib/grammar/types.ts`:

```typescript
// What Agent 1 created - you'll use these

export interface GrammarPointIndex {
  id: string
  order: number
  category: string
  title: {
    ja: string
    romaji: string
    en: string
  }
  shortDescription: string
  jlptLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
  difficulty: 'beginner' | 'intermediate' | 'advanced'
}

export interface GrammarPoint {
  id: string
  version: string
  title: {
    ja: string
    romaji: string
    en: string
  }
  jlptLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
  category: string
  explanation: {
    en: string
    ja: string
  }
  structure: {
    pattern: string
    components: StructureComponent[]
  }
  examples: Example[]
  relatedPoints: string[]
  commonMistakes?: CommonMistake[]
  tags: string[]
}

export interface StructureComponent {
  part: string
  explanation: string
  examples: string[]
}

export interface Example {
  japanese: string
  romaji: string
  english: string
  breakdown: Record<string, string>
  notes?: string
}

export interface GrammarIndexFile {
  version: string
  jlptLevel: string
  totalPoints: number
  lastUpdated: string
  points: GrammarPointIndex[]
}
```

---

## 🎨 STYLING SYSTEM

### Tailwind CSS Classes

**Use these consistently throughout all components:**

**Layout**:
```
Container: max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8
Wide Container: max-w-7xl mx-auto px-4 sm:px-6 lg:px-8
Grid: grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4
```

**Cards**:
```
Card: bg-white rounded-lg border border-gray-200 p-4
Card Hover: hover:shadow-lg hover:border-blue-500 transition-all
Section Card: bg-white rounded-lg shadow-sm border border-gray-200 p-6
```

**Typography**:
```
Page Title: text-3xl md:text-4xl font-bold text-gray-900
Section Title: text-2xl font-semibold text-gray-900
Card Title: text-lg font-bold text-gray-900
Body Text: text-base text-gray-700
Small Text: text-sm text-gray-600
Tiny Text: text-xs text-gray-500
```

**Colors**:
```
Primary Blue: bg-blue-600 text-white hover:bg-blue-700
Badge: bg-blue-100 text-blue-800
Success: bg-green-50 border-green-500 text-green-800
Gray BG: bg-gray-50
Borders: border-gray-200
```

**Responsive Grid** (critical!):
```
Mobile (default): grid-cols-2
Tablet (md:): grid-cols-3
Desktop (lg:): grid-cols-4
```

---

## 🔧 COMPLETE IMPLEMENTATION

### Step 1: Create Data Service

**File**: `/src/lib/grammar/grammarService.ts`

```typescript
import { GrammarIndexFile, GrammarPoint } from './types'

/**
 * Load the full grammar index
 */
export async function getGrammarIndex(): Promise<GrammarIndexFile> {
  const response = await fetch('/data/grammar/n5-index.json')
  if (!response.ok) {
    throw new Error('Failed to load grammar index')
  }
  return response.json()
}

/**
 * Load a specific grammar point by ID
 */
export async function getGrammarPoint(id: string): Promise<GrammarPoint> {
  const response = await fetch(`/data/grammar/points/${id}.json`)
  if (!response.ok) {
    throw new Error(`Grammar point not found: ${id}`)
  }
  return response.json()
}

/**
 * Load multiple grammar points (for related points)
 */
export async function getGrammarPoints(ids: string[]): Promise<GrammarPoint[]> {
  const promises = ids.map(id => getGrammarPoint(id))
  return Promise.all(promises)
}
```

---

### Step 2: Grammar Grid Page

**File**: `/src/app/[locale]/learn/grammar/page.tsx`

```typescript
import { getGrammarIndex } from '@/lib/grammar/grammarService'
import { GrammarPointGrid } from '@/components/grammar/GrammarPointGrid'
import { Suspense } from 'react'

export const metadata = {
  title: 'N5 Grammar Points | Moshimoshi',
  description: 'Learn Japanese grammar with 80 N5-level grammar points.',
}

// Enable static generation
export const dynamic = 'force-static'

export default async function GrammarPage({
  params
}: {
  params: { locale: string }
}) {
  const indexData = await getGrammarIndex()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                N5 Grammar Points
              </h1>
              <p className="mt-2 text-gray-600">
                Master Japanese grammar with {indexData.totalPoints} essential grammar points
              </p>
            </div>
            <div className="hidden md:block">
              <span className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-100 text-blue-800 text-sm font-medium">
                JLPT {indexData.jlptLevel}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Suspense fallback={<LoadingGrid />}>
          <GrammarPointGrid points={indexData.points} locale={params.locale} />
        </Suspense>
      </div>
    </div>
  )
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {[...Array(12)].map((_, i) => (
        <div key={i} className="bg-gray-200 rounded-lg h-32 animate-pulse" />
      ))}
    </div>
  )
}
```

---

### Step 3: Grammar Point Grid Component

**File**: `/src/components/grammar/GrammarPointGrid.tsx`

```typescript
import { GrammarPointIndex } from '@/lib/grammar/types'
import { GrammarPointCard } from './GrammarPointCard'

interface GrammarPointGridProps {
  points: GrammarPointIndex[]
  locale: string
}

export function GrammarPointGrid({ points, locale }: GrammarPointGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {points.map(point => (
        <GrammarPointCard key={point.id} point={point} locale={locale} />
      ))}
    </div>
  )
}
```

---

### Step 4: Grammar Point Card Component

**File**: `/src/components/grammar/GrammarPointCard.tsx`

```typescript
import Link from 'next/link'
import { GrammarPointIndex } from '@/lib/grammar/types'

interface GrammarPointCardProps {
  point: GrammarPointIndex
  locale: string
}

export function GrammarPointCard({ point, locale }: GrammarPointCardProps) {
  return (
    <Link
      href={`/${locale}/learn/grammar/${point.id}`}
      className="block group"
    >
      <div className="bg-white rounded-lg border border-gray-200 p-4 h-full transition-all hover:shadow-lg hover:border-blue-500">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900 truncate group-hover:text-blue-600">
              {point.title.ja}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {point.title.romaji}
            </p>
          </div>
          <span className="ml-2 flex-shrink-0 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
            {point.jlptLevel}
          </span>
        </div>

        {/* English Title */}
        <p className="text-sm font-medium text-gray-700 mb-2">
          {point.title.en}
        </p>

        {/* Description */}
        <p className="text-xs text-gray-600 line-clamp-2">
          {point.shortDescription}
        </p>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-500 capitalize">
            {point.category.replace('-', ' ')}
          </span>
        </div>
      </div>
    </Link>
  )
}
```

---

### Step 5: Grammar Detail Page

**File**: `/src/app/[locale]/learn/grammar/[pointId]/page.tsx`

```typescript
import { getGrammarIndex, getGrammarPoint } from '@/lib/grammar/grammarService'
import { GrammarPointDetail } from '@/components/grammar/GrammarPointDetail'
import { notFound } from 'next/navigation'

export const dynamic = 'force-static'

// Generate static params for all grammar points
export async function generateStaticParams() {
  const indexData = await getGrammarIndex()
  return indexData.points.map(point => ({
    pointId: point.id,
  }))
}

// Generate metadata
export async function generateMetadata({
  params,
}: {
  params: { pointId: string }
}) {
  try {
    const point = await getGrammarPoint(params.pointId)
    return {
      title: `${point.title.en} | Grammar | Moshimoshi`,
      description: point.explanation.en.slice(0, 155),
    }
  } catch {
    return {
      title: 'Grammar Point | Moshimoshi',
    }
  }
}

export default async function GrammarDetailPage({
  params,
}: {
  params: { locale: string; pointId: string }
}) {
  try {
    const point = await getGrammarPoint(params.pointId)
    return <GrammarPointDetail point={point} locale={params.locale} />
  } catch (error) {
    notFound()
  }
}
```

---

### Step 6: Grammar Point Detail Component

**File**: `/src/components/grammar/GrammarPointDetail.tsx`

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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                {point.title.ja}
              </h1>
              <p className="text-xl text-gray-600 mb-1">
                {point.title.romaji}
              </p>
              <p className="text-lg text-gray-700">
                {point.title.en}
              </p>
            </div>
            <span className="ml-4 inline-flex items-center px-3 py-1 rounded-lg bg-blue-100 text-blue-800 text-sm font-medium">
              {point.jlptLevel}
            </span>
          </div>
        </div>

        {/* Explanation */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Explanation
          </h2>
          <div className="prose max-w-none">
            <p className="text-gray-700 whitespace-pre-line">
              {point.explanation.en}
            </p>
          </div>
        </section>

        {/* Structure */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Structure
          </h2>
          <GrammarStructure structure={point.structure} />
        </section>

        {/* Examples */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Examples
          </h2>
          <div className="space-y-6">
            {point.examples.map((example, idx) => (
              <ExampleSentence key={idx} example={example} index={idx + 1} />
            ))}
          </div>
        </section>

        {/* Related Points */}
        {point.relatedPoints.length > 0 && (
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Related Grammar
            </h2>
            <RelatedPoints pointIds={point.relatedPoints} locale={locale} />
          </section>
        )}

        {/* Practice CTA */}
        <div className="text-center mt-8">
          <Link
            href={`/${locale}/learn/grammar/${point.id}/practice`}
            className="inline-flex items-center px-8 py-4 rounded-lg bg-blue-600 text-white text-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg"
          >
            Practice Exercises →
          </Link>
        </div>
      </div>
    </div>
  )
}
```

---

### Step 7: Example Sentence Component

**File**: `/src/components/grammar/ExampleSentence.tsx`

```typescript
import { Example } from '@/lib/grammar/types'

interface ExampleSentenceProps {
  example: Example
  index: number
}

export function ExampleSentence({ example, index }: ExampleSentenceProps) {
  return (
    <div className="border-l-4 border-blue-500 pl-4">
      {/* Example Number */}
      <div className="text-sm font-semibold text-gray-500 mb-2">
        Example {index}
      </div>

      {/* Japanese */}
      <div className="text-2xl font-bold text-gray-900 mb-1">
        {example.japanese}
      </div>

      {/* Romaji */}
      <div className="text-lg text-gray-600 mb-2">
        {example.romaji}
      </div>

      {/* English */}
      <div className="text-lg text-gray-800 font-medium mb-3">
        {example.english}
      </div>

      {/* Breakdown */}
      <div className="bg-gray-50 rounded-lg p-3 space-y-1">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Breakdown:
        </div>
        {Object.entries(example.breakdown).map(([word, meaning]) => (
          <div key={word} className="flex items-start text-sm">
            <span className="font-medium text-gray-900 min-w-[80px]">
              {word}
            </span>
            <span className="text-gray-600">{meaning}</span>
          </div>
        ))}
      </div>

      {/* Notes */}
      {example.notes && (
        <div className="mt-2 text-sm text-gray-600 italic">
          💡 {example.notes}
        </div>
      )}
    </div>
  )
}
```

---

### Step 8: Grammar Structure Component

**File**: `/src/components/grammar/GrammarStructure.tsx`

```typescript
import { GrammarPoint } from '@/lib/grammar/types'

interface GrammarStructureProps {
  structure: GrammarPoint['structure']
}

export function GrammarStructure({ structure }: GrammarStructureProps) {
  return (
    <div>
      {/* Pattern */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <div className="text-sm font-semibold text-blue-800 mb-1">
          Pattern:
        </div>
        <div className="text-3xl font-bold text-blue-900">
          {structure.pattern}
        </div>
      </div>

      {/* Components */}
      <div className="space-y-3">
        {structure.components.map((component, idx) => (
          <div key={idx} className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-200 text-gray-700 font-bold text-sm mr-3">
                {component.part}
              </span>
              <span className="text-gray-900 font-medium">
                {component.explanation}
              </span>
            </div>
            <div className="ml-11 text-sm text-gray-600">
              Examples: {component.examples.join(', ')}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

### Step 9: Related Points Component

**File**: `/src/components/grammar/RelatedPoints.tsx`

```typescript
import Link from 'next/link'
import { getGrammarPoints } from '@/lib/grammar/grammarService'

interface RelatedPointsProps {
  pointIds: string[]
  locale: string
}

export async function RelatedPoints({ pointIds, locale }: RelatedPointsProps) {
  const relatedPoints = await getGrammarPoints(pointIds)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {relatedPoints.map(point => (
        <Link
          key={point.id}
          href={`/${locale}/learn/grammar/${point.id}`}
          className="block p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors"
        >
          <div className="font-bold text-gray-900">{point.title.ja}</div>
          <div className="text-sm text-gray-600 mt-0.5">{point.title.en}</div>
        </Link>
      ))}
    </div>
  )
}
```

---

### Step 10: Shared Layout (Optional)

**File**: `/src/app/[locale]/learn/grammar/layout.tsx`

```typescript
import Link from 'next/link'
import { ReactNode } from 'react'

export default function GrammarLayout({
  children,
  params,
}: {
  children: ReactNode
  params: { locale: string }
}) {
  return (
    <div>
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <nav className="flex items-center text-sm text-gray-600">
            <Link href={`/${params.locale}`} className="hover:text-gray-900">
              Home
            </Link>
            <span className="mx-2">/</span>
            <Link
              href={`/${params.locale}/learn/grammar`}
              className="hover:text-gray-900"
            >
              Grammar
            </Link>
          </nav>
        </div>
      </div>

      {children}
    </div>
  )
}
```

---

## ✅ QUALITY CHECKLIST

### Before Submitting

**Functionality**:
- [ ] Grid displays all grammar points
- [ ] Cards are clickable
- [ ] Detail page shows all sections
- [ ] Navigation works
- [ ] No broken links

**Responsive**:
- [ ] Mobile (375px): 2 columns, readable
- [ ] Tablet (768px): 3 columns
- [ ] Desktop (1024px+): 4 columns
- [ ] No horizontal scroll
- [ ] Touch targets ≥ 44px

**Accessibility**:
- [ ] Keyboard navigation (Tab, Enter)
- [ ] Focus indicators visible
- [ ] Semantic HTML
- [ ] Color contrast ≥ 4.5:1

**Code Quality**:
- [ ] TypeScript strict (no `any`)
- [ ] Server Components default
- [ ] Props typed
- [ ] No console errors
- [ ] Loading states

---

## 🧪 TESTING

```bash
# Start dev server
npm run dev

# Test grid
http://localhost:3000/en/learn/grammar
- [ ] Grid displays
- [ ] 10 cards visible
- [ ] Hover works
- [ ] Mobile: 2 cols
- [ ] Desktop: 4 cols

# Test detail
- [ ] Click card → detail page
- [ ] All sections render
- [ ] Examples display
- [ ] Related links work

# Test responsive
- [ ] Resize 375px → 1920px
- [ ] No breaks
- [ ] Text readable

# Test keyboard
- [ ] Tab through links
- [ ] Enter activates
- [ ] Focus visible
```

---

## 🎯 SUCCESS CRITERIA

You've succeeded when:

- [ ] Grammar grid works
- [ ] Grammar detail works
- [ ] Mobile responsive
- [ ] Accessible
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] Code reviewed
- [ ] Agent 3 can integrate exercises

**Make it beautiful and intuitive!** ✨

---

**Document Version**: 2.0.0 (Standalone)
**Last Updated**: 2026-01-16
