# Kanji Drawing Practice - Feature Guide

**Status:** ACTIVE
**Last Updated:** 2026-02-14

---

## Table of Contents

1. [Feature Overview](#feature-overview)
2. [Component Deep Dive](#component-deep-dive)
3. [SimpleDrawingCanvas](#simpledrawingcanvas)
4. [StrokeBuildup](#strokebuildup)
5. [DrawingPracticeSheet](#drawingpracticesheet)
6. [Drawing Selection Page](#drawing-selection-page)
7. [Kanji Mastery Integration](#kanji-mastery-integration)
8. [User Flow](#user-flow)
9. [Responsive Layout](#responsive-layout)
10. [Readings Overlay Behavior](#readings-overlay-behavior)
11. [Entitlement Gating](#entitlement-gating)
12. [Data Dependencies](#data-dependencies)
13. [Extending the Feature](#extending-the-feature)
14. [Troubleshooting](#troubleshooting)

---

## Feature Overview

Kanji Drawing Practice provides a repetitive writing drill for kanji muscle memory. The design philosophy is deliberately simple:

- **No recognition** - Unlike `DrawingCanvasWithRecognition.tsx`, there is no KanjiCanvas service, no handwriting recognition, no candidate display
- **No scoring** - No SRS integration, no accuracy tracking, no XP rewards (`givesXp: false`)
- **No progression** - Each session is standalone; progress is not saved between sessions
- **Pure repetition** - Draw the same kanji 12 times with visual reference aids

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| 12 cells per sheet | Standard calligraphy practice sheet count; sufficient for muscle memory without fatigue |
| Readings overlay after completion | Reinforces reading association immediately after writing; avoids separate reading cards |
| Ghost SVG on first cell only | Provides initial reference without becoming a crutch on subsequent cells |
| Stroke count gating for overlay | Prevents premature readings display during multi-stroke kanji |
| No auto-clear on overlay | User controls when to move on; pressing Clear is intentional |
| 120x120 canvas size | Fits 6 per row on desktop, 3 on mobile without horizontal scroll |

---

## Component Deep Dive

### SimpleDrawingCanvas

**File:** `src/components/drawing-practice/SimpleDrawingCanvas.tsx`
**Lines:** ~297

A stripped-down HTML5 canvas component extracted from `DrawingCanvasWithRecognition.tsx`. Retains only the drawing mechanics and adds a readings overlay.

#### Props

```typescript
interface SimpleDrawingCanvasProps {
  width?: number           // Canvas width in pixels (default: 200)
  height?: number          // Canvas height in pixels (default: 200)
  ghostSVG?: string        // SVG string for ghost character trace
  showGhost?: boolean      // Show ghost on this cell (default: false)
  strokeColor?: string     // Drawing color (default: '#000000')
  strokeWidth?: number     // Stroke thickness (default: 3)
  className?: string       // Additional CSS classes
  onyomi?: string[]        // On'yomi readings for overlay
  kunyomi?: string[]       // Kun'yomi readings for overlay
  expectedStrokes?: number // Kanji stroke count; overlay triggers at this count
}
```

#### Internal State

```typescript
const [isDrawing, setIsDrawing] = useState(false)       // Currently drawing a stroke
const [currentStroke, setCurrentStroke] = useState([])   // Points in active stroke
const [strokes, setStrokes] = useState([])               // Completed strokes
const [context, setContext] = useState(null)              // Canvas 2D context
const [showReadings, setShowReadings] = useState(false)  // Readings overlay visible
```

#### Event Handling

The canvas uses raw DOM event listeners (not React synthetic events) for proper touch support:

```
mousedown / touchstart  → startDrawing()
mousemove / touchmove   → draw()
mouseup / mouseout      → stopDrawing()
touchend / touchcancel  → stopDrawing()
```

All touch events use `{ passive: false }` to enable `e.preventDefault()` which prevents page scrolling while drawing.

#### Key Behaviors

- **Drawing blocked during overlay**: `startDrawing()` returns early if `showReadings` is true
- **Undo clears overlay**: `undoLastStroke()` sets `showReadings = false` and redraws remaining strokes
- **Clear resets everything**: `clearCanvas()` wipes strokes, current stroke, and overlay state

#### What Was Removed vs DrawingCanvasWithRecognition

| DrawingCanvasWithRecognition | SimpleDrawingCanvas |
|------------------------------|---------------------|
| KanjiCanvas service init | Removed |
| `kanjiCanvasService.loadScripts()` | Removed |
| `kanjiCanvasService.initCanvas()` | Removed |
| `recognizeCharacter()` | Removed |
| `recognizeHybrid()` | Removed |
| `submitDrawing()` | Removed |
| Recognition candidates display | Replaced with readings overlay |
| Submit button | Removed |
| Recognize button | Removed |
| `isKanjiCanvasReady` state | Removed |
| `recognizedCandidates` state | Removed |
| `autoRecognize` prop | Removed |
| `onDrawingComplete` callback | Removed |
| `onStrokeComplete` callback | Removed |
| `onRecognition` callback | Removed |
| `onReadyChange` callback | Removed |
| `character` prop | Removed |
| `characterType` prop | Removed |
| framer-motion buttons | Plain buttons |
| Canvas drawing mechanics | **Kept** (lines 104-228 equivalent) |
| Crosshair grid overlay | **Kept** |
| Stroke counter badge | **Kept** |
| Clear/Undo buttons | **Kept** |

---

### StrokeBuildup

**File:** `src/components/drawing-practice/StrokeBuildup.tsx`
**Lines:** ~80

Parses KanjiVG SVG data and renders a horizontal scrolling row of progressive stroke buildup diagrams.

#### Props

```typescript
interface StrokeBuildupProps {
  svgData: string        // Raw SVG string from kanjiService.getStrokeOrderSVG()
  totalStrokes: number   // Expected number of strokes (from Kanji.strokeCount)
  cellSize?: number      // Size of each buildup cell (default: 80)
}
```

#### SVG Parsing Logic

1. Parse SVG string with `DOMParser`
2. Query all `<path>` elements with IDs matching `/kvg:[0-9a-f]+-s\d+/`
3. Fall back to `<g>` group paths if ID pattern matching fails
4. For each step K (1 to N), render strokes 1..K with the latest stroke highlighted in red (`#e53e3e`) and previous strokes in black (`#000000`)
5. Output as inline SVG strings rendered via `dangerouslySetInnerHTML`

#### Memoization

The buildup steps are computed with `useMemo` keyed on `[svgData, totalStrokes, cellSize]` to avoid re-parsing on every render.

---

### DrawingPracticeSheet

**File:** `src/app/[locale]/tools/kanji-mastery/drawing/DrawingPracticeSheet.tsx`
**Lines:** ~134

The full practice sheet view combining the info card, stroke buildup, and 12 drawing cells.

#### Props

```typescript
interface DrawingPracticeSheetProps {
  kanji: Kanji       // Selected kanji with all metadata
  onBack: () => void // Callback to return to selection view
}
```

#### Layout Structure

```
┌──────────────────────────────────────┐
│  ← Back to Selection                 │
├──────────────────────────────────────┤
│  ┌────────┐                          │
│  │  大    │  Meaning: big, large     │
│  │ (7xl)  │  On'yomi: ダイ, タイ     │
│  │        │  Kun'yomi: おおきい...    │
│  └────────┘  Strokes: 3             │
├──────────────────────────────────────┤
│  Stroke Buildup                      │
│  [1] [1,2] [1,2,3] ← scrollable     │
├──────────────────────────────────────┤
│  Practice Sheet — 12 Drawing         │
│                                      │
│  1/12    2/12    3/12                │  ← mobile: 3 cols
│  [    ]  [    ]  [    ]              │
│  Clr Und Clr Und Clr Und            │
│                                      │
│  4/12    5/12    6/12                │
│  [    ]  [    ]  [    ]              │
│  ...                                 │
└──────────────────────────────────────┘
```

#### SVG Loading

SVG data loads on mount via `kanjiService.getStrokeOrderSVG(kanji.kanji)`. Shows a loading state, then either the StrokeBuildup component or an "unavailable" message if SVG is null.

#### Ghost SVG Behavior

Only the first cell (`i === 0`) receives `showGhost={true}`. This shows a faint trace of the kanji character behind the canvas for initial guidance.

---

### Drawing Selection Page

**File:** `src/app/[locale]/tools/kanji-mastery/drawing/page.tsx`
**Lines:** ~195

A two-state page that handles kanji selection and practice.

#### State Machine

```
SELECTING ──(kanji click + entitlement check)──► PRACTICING
    ▲                                                │
    └────────────(onBack callback)───────────────────┘
```

#### Selection View Components

- **Search bar**: Real-time search via `kanjiService.searchKanji(query)`
- **JLPT level tabs**: N5/N4/N3/N2/N1 pill-style buttons
- **Kanji grid**: Responsive grid (5-12 cols) with meaning tooltip on hover
- **Entitlement check**: `checkAndTrack()` fires on kanji click, not page load

#### Auth Guard

Redirects unauthenticated users to `/auth/signin` on mount. Shows loading overlay during auth check.

---

## Kanji Mastery Integration

### Settings Page Changes

**File:** `src/app/[locale]/tools/kanji-mastery/page.tsx`

#### StudySettings Interface

```typescript
interface StudySettings {
  sessionSize: number
  jlptLevel: string
  gradeLevel: string
  studyMode: 'jlpt' | 'grade' | 'mixed'
  learningApproach: 'smart' | 'linear'
  testMode: 'recall' | 'choice'
  drawingMode: boolean          // ← Added
}
```

#### UI Additions

1. **Drawing Approach toggle** - On/Off pill-style toggle, first item in settings collapse
2. **Start Drawing Practice button** - Emerald green with Pencil icon, appears in the button row when `drawingMode` is true
3. **Settings summary** - Includes "Drawing Approach" label when enabled

#### Persistence

Drawing mode state persists via `useUserStorage` hook under the `kanjiMasterySettings` key, same as all other settings.

---

## User Flow

```
1. User opens Kanji Mastery page
2. User opens Settings, toggles Drawing Approach ON
3. User clicks "Start Drawing Practice" (emerald button)
4. Page navigates to /tools/kanji-mastery/drawing
5. User sees JLPT level tabs (N5 selected by default)
6. User can search or browse kanji
7. User taps a kanji character
8. Entitlement check: checkAndTrack('kanji_drawing_practice')
   ├── Allowed → Show DrawingPracticeSheet
   └── Denied → Toast with upgrade prompt (free users)
9. User sees:
   - Large kanji with meaning and readings
   - Stroke buildup row (horizontal scroll)
   - 12 drawing cells with crosshair grids
10. User draws in cell 1 (ghost character visible as guide)
11. After completing all strokes → readings overlay appears
12. User presses Clear → overlay dismissed, canvas reset
13. User draws in cells 2-12 (no ghost on these)
14. User presses "Back to Selection" to pick another kanji
```

---

## Responsive Layout

### Practice Grid

| Breakpoint | Columns | Canvas Size | Gap |
|------------|---------|-------------|-----|
| Mobile (<1024px) | 3 | 120x120 | 12px |
| Desktop (lg+) | 6 | 120x120 | 12px |

### Bottom Padding

| Breakpoint | Padding |
|------------|---------|
| Mobile | `pb-24` (96px) to clear mobile nav |
| Desktop | `pb-16` (64px) |

### Kanji Selection Grid

| Breakpoint | Columns |
|------------|---------|
| Default | 5 |
| sm (640px) | 8 |
| md (768px) | 10 |
| lg (1024px) | 12 |

---

## Readings Overlay Behavior

The readings overlay is the key UX innovation of this feature. It replaces the original separate `ReadingReferenceCell` approach with an in-canvas overlay.

### Trigger Logic

```typescript
// Show readings once all expected strokes are drawn and user stops
const allStrokesDrawn = expectedStrokes ? strokes.length >= expectedStrokes : false

useEffect(() => {
  if (allStrokesDrawn && !isDrawing && hasReadings) {
    const timer = setTimeout(() => setShowReadings(true), 300)
    return () => clearTimeout(timer)
  }
  setShowReadings(false)
}, [allStrokesDrawn, isDrawing, hasReadings])
```

### Key Rules

| Rule | Implementation |
|------|----------------|
| Overlay appears after ALL expected strokes are drawn | `strokes.length >= expectedStrokes` |
| 300ms delay prevents flickering | `setTimeout(..., 300)` |
| Drawing is blocked while overlay is visible | `if (showReadings) return` in `startDrawing()` |
| Only Clear button dismisses overlay | No `onClick` on overlay div |
| Undo dismisses overlay and removes last stroke | `setShowReadings(false)` in `undoLastStroke()` |
| Overlay is not scrollable (no visible scrollbars) | `overflow-y-auto` + `scrollbarWidth: 'none'` |

### Overlay Content

```
┌──────────────────────┐
│      ON'YOMI         │  ← text-[8px] label
│        ダイ           │  ← text-[10px] per reading
│        タイ           │
│                      │
│      KUN'YOMI        │
│      おおきい         │
│      おおいに         │
│        おお           │
└──────────────────────┘
```

Each reading is rendered on its own line (not comma-joined) to avoid truncation in small cells.

---

## Entitlement Gating

### Configuration

```json
// config/features.v1.json
"kanji_drawing_practice": {
  "guest": { "daily": 0 },
  "free": { "daily": 2 },
  "premium_monthly": { "daily": -1 },
  "premium_yearly": { "daily": -1 }
}
```

### Gating Point

The entitlement check happens at **kanji selection time**, not on page load:

```typescript
// src/app/[locale]/tools/kanji-mastery/drawing/page.tsx
const handleKanjiSelect = async (kanji: Kanji) => {
  const allowed = await checkAndTrack({ showUI: true })
  if (!allowed) {
    if (!isPremium) {
      showToast(t('entitlements.messages.limitReached'), 'warning', 5000, {
        label: t('subscription.actions.upgrade'),
        onClick: () => router.push('/pricing'),
      })
    }
    return
  }
  setSelectedKanji(kanji)
}
```

This means:
- Free users can browse all kanji freely
- The limit (2/day) is consumed when they actually start a practice sheet
- Premium users have unlimited access

### Generated Types

After running `npm run gen:entitlements`, `kanji_drawing_practice` appears in:
- `src/types/FeatureId.ts` - Type union
- `src/lib/entitlements/policy.ts` - Policy rules
- `src/lib/access/permissionMap.ts` - Permission mapping
- `src/lib/features/registry.ts` - Feature registry

---

## Data Dependencies

### kanjiService

| Method | Usage |
|--------|-------|
| `loadKanjiByLevel(level: JLPTLevel)` | Load kanji for selected JLPT tab |
| `searchKanji(query: string)` | Real-time search across all levels |
| `getStrokeOrderSVG(character: string)` | Fetch KanjiVG SVG for stroke buildup + ghost |

### KanjiVG SVG Data

SVG files are served from `/data/kanjivg/{codePoint}.svg`. The stroke paths follow the KanjiVG naming convention with IDs like `kvg:05927-s1`, `kvg:05927-s2`, etc.

### Kanji Type

```typescript
// src/types/kanji.ts
interface Kanji {
  kanji: string
  meaning: string
  meanings: string[]
  onyomi: string[]
  kunyomi: string[]
  jlpt: JLPTLevel
  strokeCount: number
  grade?: number | 'S'
  frequency?: number
  examples: KanjiExample[]
  radicals?: string[]
  components?: string[]
}
```

---

## Extending the Feature

### Adding More Drawing Cells

Change `TOTAL_CELLS` in `DrawingPracticeSheet.tsx`:

```typescript
const TOTAL_CELLS = 12  // Change to 16, 20, etc.
```

### Adding Canvas Size Options

Pass different `width`/`height` to `SimpleDrawingCanvas`. The crosshair grid and ghost SVG auto-scale.

### Adding Stroke Order Animation

The `StrokeBuildup` component already extracts individual stroke paths. To add animation, iterate through paths with `requestAnimationFrame` and draw them sequentially with a delay.

### Integrating with SRS

To add SRS tracking, wrap the kanji selection handler with a progress update:

```typescript
const handleKanjiSelect = async (kanji: Kanji) => {
  const allowed = await checkAndTrack({ showUI: true })
  if (!allowed) return

  // Optional: Track drawing practice in SRS
  // await kanjiProgressManager.trackDrawingPractice(kanji.kanji, user)

  setSelectedKanji(kanji)
}
```

---

## Troubleshooting

### Readings overlay appears too early

**Symptom:** Overlay shows after 1 stroke on a multi-stroke kanji.

**Cause:** `expectedStrokes` prop not passed to `SimpleDrawingCanvas`.

**Fix:** Ensure `expectedStrokes={kanji.strokeCount}` is set in `DrawingPracticeSheet.tsx`.

### Readings overlay never appears

**Symptom:** Drawing completes but no readings show.

**Cause:** `onyomi` and `kunyomi` are both empty arrays, or `expectedStrokes` is not set.

**Fix:** Check kanji data. Some rare kanji may have empty readings. The `hasReadings` check requires at least one reading.

### SVG stroke paths not found

**Symptom:** StrokeBuildup shows nothing, "Stroke data unavailable" message appears.

**Cause:** KanjiVG file missing for this character, or SVG uses non-standard path IDs.

**Fix:** The component falls back to querying `<g>` group paths. If still empty, the SVG may genuinely be unavailable for that character.

### Canvas not responding to touch on mobile

**Symptom:** Drawing doesn't work on touch devices.

**Cause:** Touch events not properly prevented, causing page scroll instead of drawing.

**Fix:** All touch listeners use `{ passive: false }` and call `e.preventDefault()`. Verify the canvas has `touch-none` CSS class.

### Entitlement check fails silently

**Symptom:** Nothing happens when clicking a kanji.

**Cause:** `checkAndTrack` returning false without showing UI.

**Fix:** Ensure `{ showUI: true }` is passed. Check browser console for entitlement API errors.

### i18n strings showing English in other locales

**Symptom:** "Drawing Approach" label appears in English on Italian/German/etc.

**Cause:** `drawingApproach` section missing from that locale's `strings.ts`.

**Fix:** Verify all 6 locale files have the `kanjiMasteryTool.drawingApproach` section.

---

*Last Updated: 2026-02-14*
