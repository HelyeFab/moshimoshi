# Agent 2 - UI Engineer

**Role**: UI/UX Component Developer
**Project**: Grammar Stall MVP
**Timeline**: Days 3-5
**Branch**: `grammar-stall-mvp-agent2-ui`

---

## 🎯 Your Mission

You are the **UI Engineer** responsible for building all React components for the grammar stall. Your deliverables:

1. **Grammar Point Grid** - Browse all 80 points
2. **Grammar Point Detail** - View explanation and examples
3. **Example Display** - Beautiful sentence breakdown
4. **Routing** - Set up Next.js pages
5. **Responsive Design** - Works on mobile, tablet, desktop

**Total**: ~8 React components + 2 page files + 1 layout

---

## 📚 Required Reading

**READ THESE FIRST**:
1. `../MVP_SPECIFICATION.md` - Sections: "User Experience Flow" and "Feature 1-2"
2. `../TECHNICAL_DESIGN.md` - Sections: "Component Design" and "Styling Approach"
3. `../DATA_SCHEMA.md` - Understand the data structure you'll display
4. Agent 1's output: `/public/data/grammar/` - See real data you'll work with

---

## 📅 Your Schedule

### Day 3: Grid & Card Components

**Morning**:
- [ ] Set up routing (`/learn/grammar/page.tsx`)
- [ ] Create `GrammarPointGrid` component
- [ ] Create `GrammarPointCard` component
- [ ] Test with Agent 1's 10 grammar points

**Afternoon**:
- [ ] Make responsive (mobile 2-col, desktop 4-col)
- [ ] Add hover effects
- [ ] Submit for review

**Deliverable**: Working grammar point grid

---

### Day 4: Detail View

**Morning**:
- [ ] Set up detail routing (`/learn/grammar/[pointId]/page.tsx`)
- [ ] Create `GrammarPointDetail` component
- [ ] Create `ExampleSentence` component
- [ ] Create `GrammarStructure` component

**Afternoon**:
- [ ] Create `RelatedPoints` component
- [ ] Add "Practice Exercises" button
- [ ] Test navigation flow
- [ ] Submit for review

**Deliverable**: Working grammar detail page

---

### Day 5: Polish & Accessibility

**Morning**:
- [ ] Create shared `layout.tsx` (back button, breadcrumbs)
- [ ] Mobile testing & fixes
- [ ] Add loading states
- [ ] Add error states (404, data missing)

**Afternoon**:
- [ ] Accessibility audit (keyboard nav, ARIA labels)
- [ ] Dark mode support (if moshimoshi has it)
- [ ] Final responsive polish
- [ ] Submit for final review

**Deliverable**: Production-ready UI

---

## 📁 Files You'll Create

```
/src/app/[locale]/learn/grammar/
├── page.tsx                      # YOU CREATE - Grid view
├── layout.tsx                    # YOU CREATE - Shared layout
└── [pointId]/
    └── page.tsx                  # YOU CREATE - Detail view

/src/components/grammar/
├── GrammarPointGrid.tsx          # YOU CREATE - Grid container
├── GrammarPointCard.tsx          # YOU CREATE - Individual card
├── GrammarPointDetail.tsx        # YOU CREATE - Detail display
├── ExampleSentence.tsx           # YOU CREATE - Example with breakdown
├── GrammarStructure.tsx          # YOU CREATE - Structure diagram
└── RelatedPoints.tsx             # YOU CREATE - Related grammar links

/src/lib/grammar/
└── grammarService.ts             # YOU CREATE - Data loading functions
```

---

## 🔧 Step-by-Step Implementation

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
 * Load grammar points by IDs (for related points)
 */
export async function getGrammarPoints(ids: string[]): Promise<GrammarPoint[]> {
  const promises = ids.map(id => getGrammarPoint(id))
  return Promise.all(promises)
}
```

---

### Step 2: Create Grammar Grid Page

**File**: `/src/app/[locale]/learn/grammar/page.tsx`

```typescript
import { getGrammarIndex } from '@/lib/grammar/grammarService'
import { GrammarPointGrid } from '@/components/grammar/GrammarPointGrid'
import { Suspense } from 'react'

export const metadata = {
  title: 'N5 Grammar Points | Moshimoshi',
  description: 'Learn Japanese grammar with 80 N5-level grammar points, explanations, and exercises.',
}

// Enable static generation
export const dynamic = 'force-static'

export default async function GrammarPage({ params }: { params: { locale: string } }) {
  const indexData = await getGrammarIndex()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">N5 Grammar Points</h1>
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
        <Suspense fallback={<div className="text-center py-12">Loading...</div>}>
          <GrammarPointGrid points={indexData.points} locale={params.locale} />
        </Suspense>
      </div>
    </div>
  )
}
```

---

### Step 3: Create Grammar Point Grid Component

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

### Step 4: Create Grammar Point Card Component

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
    <Link href={`/${locale}/learn/grammar/${point.id}`} className="block group">
      <div className="bg-white rounded-lg border border-gray-200 p-4 h-full transition-all hover:shadow-lg hover:border-blue-500">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900 truncate group-hover:text-blue-600">
              {point.title.ja}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">{point.title.romaji}</p>
          </div>
          <span className="ml-2 flex-shrink-0 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
            {point.jlptLevel}
          </span>
        </div>

        {/* English Title */}
        <p className="text-sm font-medium text-gray-700 mb-2">{point.title.en}</p>

        {/* Description */}
        <p className="text-xs text-gray-600 line-clamp-2">{point.shortDescription}</p>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-500 capitalize">{point.category.replace('-', ' ')}</span>
        </div>
      </div>
    </Link>
  )
}
```

---

### Step 5: Create Grammar Detail Page

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

### Step 6: Create Grammar Point Detail Component

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
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">{point.title.ja}</h1>
              <p className="text-xl text-gray-600 mb-1">{point.title.romaji}</p>
              <p className="text-lg text-gray-700">{point.title.en}</p>
            </div>
            <span className="ml-4 inline-flex items-center px-3 py-1 rounded-lg bg-blue-100 text-blue-800 text-sm font-medium">
              {point.jlptLevel}
            </span>
          </div>
        </div>

        {/* Explanation */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Explanation</h2>
          <div className="prose max-w-none">
            <p className="text-gray-700 whitespace-pre-line">{point.explanation.en}</p>
          </div>
        </section>

        {/* Structure */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Structure</h2>
          <GrammarStructure structure={point.structure} />
        </section>

        {/* Examples */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Examples</h2>
          <div className="space-y-6">
            {point.examples.map((example, idx) => (
              <ExampleSentence key={idx} example={example} index={idx + 1} />
            ))}
          </div>
        </section>

        {/* Related Points */}
        {point.relatedPoints.length > 0 && (
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Related Grammar</h2>
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

### Step 7: Create Example Sentence Component

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
      <div className="text-sm font-semibold text-gray-500 mb-2">Example {index}</div>

      {/* Japanese */}
      <div className="text-2xl font-bold text-gray-900 mb-1">{example.japanese}</div>

      {/* Romaji */}
      <div className="text-lg text-gray-600 mb-2">{example.romaji}</div>

      {/* English */}
      <div className="text-lg text-gray-800 font-medium mb-3">{example.english}</div>

      {/* Breakdown */}
      <div className="bg-gray-50 rounded-lg p-3 space-y-1">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Breakdown:
        </div>
        {Object.entries(example.breakdown).map(([word, meaning]) => (
          <div key={word} className="flex items-start text-sm">
            <span className="font-medium text-gray-900 min-w-[80px]">{word}</span>
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

### Step 8: Create Grammar Structure Component

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
        <div className="text-sm font-semibold text-blue-800 mb-1">Pattern:</div>
        <div className="text-3xl font-bold text-blue-900">{structure.pattern}</div>
      </div>

      {/* Components */}
      <div className="space-y-3">
        {structure.components.map((component, idx) => (
          <div key={idx} className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-200 text-gray-700 font-bold text-sm mr-3">
                {component.part}
              </span>
              <span className="text-gray-900 font-medium">{component.explanation}</span>
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

### Step 9: Create Related Points Component

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

### Step 10: Create Shared Layout (Optional but Recommended)

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
      {/* Breadcrumb Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <nav className="flex items-center text-sm text-gray-600">
            <Link href={`/${params.locale}`} className="hover:text-gray-900">
              Home
            </Link>
            <span className="mx-2">/</span>
            <Link href={`/${params.locale}/learn/grammar`} className="hover:text-gray-900">
              Grammar
            </Link>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      {children}
    </div>
  )
}
```

---

## 🎨 Styling Guidelines

### Tailwind CSS Classes to Use

**Layout**:
- Container: `max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8`
- Grid: `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4`

**Cards**:
- Card: `bg-white rounded-lg border border-gray-200 p-4 hover:shadow-lg transition`
- Hover: `hover:border-blue-500 hover:shadow-lg`

**Typography**:
- Page title: `text-3xl md:text-4xl font-bold text-gray-900`
- Section title: `text-2xl font-semibold text-gray-900`
- Card title: `text-lg font-bold text-gray-900`
- Body: `text-base text-gray-700`

**Colors**:
- Primary: `bg-blue-600 text-white hover:bg-blue-700`
- Success: `bg-green-600`
- Neutral: `bg-gray-50 text-gray-600`
- Border: `border-gray-200`

**Responsive**:
- Mobile: Base styles (no prefix)
- Tablet: `md:` prefix (768px+)
- Desktop: `lg:` prefix (1024px+)

---

## ✅ Quality Checklist

### Before Submitting

**Functionality**:
- [ ] All 10 grammar points display in grid
- [ ] Clicking card navigates to detail page
- [ ] Detail page shows all sections (explanation, structure, examples, related)
- [ ] "Practice Exercises" button links to practice page (Agent 3 will build)
- [ ] Back navigation works

**Responsive Design**:
- [ ] Mobile (375px): 2 columns, readable text
- [ ] Tablet (768px): 3 columns
- [ ] Desktop (1024px+): 4 columns
- [ ] No horizontal scroll on any screen size
- [ ] Touch targets ≥ 44x44px on mobile

**Accessibility**:
- [ ] Keyboard navigation works (Tab, Enter)
- [ ] Focus indicators visible
- [ ] Semantic HTML (`<article>`, `<section>`, `<nav>`)
- [ ] Color contrast ≥ 4.5:1 (WCAG AA)
- [ ] Screen reader announces page changes

**Code Quality**:
- [ ] TypeScript strict mode (no `any`)
- [ ] Server Components by default (no `'use client'` unless interactive)
- [ ] Props properly typed
- [ ] No console errors
- [ ] Loading states for async components
- [ ] Error boundaries for data fetching

---

## 🧪 Testing Instructions

### Manual Testing Checklist

```bash
# 1. Start dev server
npm run dev

# 2. Open browser
http://localhost:3000/en/learn/grammar

# 3. Test grid page
- [ ] Grid displays
- [ ] All 10 cards visible
- [ ] Hover effects work
- [ ] Mobile: 2 columns
- [ ] Desktop: 4 columns

# 4. Test detail page
- [ ] Click a card → navigates to detail
- [ ] All sections render (header, explanation, structure, examples, related)
- [ ] Japanese text displays correctly
- [ ] Word breakdowns are clear
- [ ] Related points are clickable

# 5. Test navigation
- [ ] Breadcrumbs work (if you added them)
- [ ] Back button works
- [ ] Links to related grammar work

# 6. Test responsive
- [ ] Resize browser 375px → 1920px
- [ ] No layout breaks
- [ ] Text remains readable
- [ ] Cards resize smoothly

# 7. Test keyboard
- [ ] Tab through all links
- [ ] Enter activates links
- [ ] Focus indicators visible

# 8. Test on devices
- [ ] iOS Safari
- [ ] Android Chrome
- [ ] Desktop Chrome/Firefox
```

---

## 📞 Getting Help

**Questions?**
- Technical Lead: See `TECHNICAL_LEAD.md`
- Component design: Check `TECHNICAL_DESIGN.md` Component Design section
- Data structure: Ask Agent 1 or read their JSON files

**Blockers?**
1. Try to solve yourself (15 min)
2. Check moshimoshi existing components for patterns (30 min)
3. Ping Technical Lead

---

## 🎯 Success Criteria

You've succeeded when:

- [ ] Grammar grid page works (displays all points)
- [ ] Grammar detail page works (shows full content)
- [ ] Mobile responsive (tested on real device)
- [ ] Accessible (keyboard nav, focus indicators)
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] Code reviewed and approved by Technical Lead
- [ ] Agent 3 can integrate exercise components

**You're building the UI that learners will interact with every day. Make it beautiful and intuitive!** ✨

---

**Document Version**: 1.0.0
**Last Updated**: 2026-01-16
