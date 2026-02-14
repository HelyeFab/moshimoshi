# Kanji Drawing Practice

**Status:** ACTIVE
**Last Updated:** 2026-02-14
**Feature ID:** `kanji_drawing_practice`

---

## Overview

Kanji Drawing Practice is a muscle-memory writing drill integrated into the Kanji Mastery tool. Users select a kanji, then draw it 12 times on a practice sheet. Each cell includes a crosshair grid for alignment, a stroke counter, and an automatic readings overlay (on'yomi/kun'yomi) that appears after all expected strokes have been drawn. The feature intentionally avoids recognition, scoring, or SRS -- it is pure repetitive writing practice.

---

## Quick Start

1. Navigate to **Kanji Mastery** (`/tools/kanji-mastery`)
2. Open **Settings** (chevron toggle)
3. Toggle **Drawing Approach** to **On**
4. Click **Start Drawing Practice** (emerald button)
5. Select a JLPT level, then tap any kanji
6. Draw the kanji 12 times on the practice sheet
7. After completing all strokes in a cell, readings appear automatically
8. Press **Clear** to reset a cell and draw again

---

## Documentation

- [FEATURE_GUIDE.md](./FEATURE_GUIDE.md) - Complete implementation guide with architecture, components, and code references

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Kanji Mastery Page                               │
│                    /tools/kanji-mastery/page.tsx                          │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  StudySettings                                                     │  │
│  │  drawingMode: boolean ──► "Start Drawing Practice" button          │  │
│  └────────────────────────────┬───────────────────────────────────────┘  │
│                               │ router.push('/tools/kanji-mastery/      │
│                               │              drawing')                   │
└───────────────────────────────┼──────────────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        Drawing Practice Page                             │
│               /tools/kanji-mastery/drawing/page.tsx                       │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  View State: SELECTING                                              │ │
│  │                                                                     │ │
│  │  ┌─────────────┐  ┌───────────────────────────────────────────┐    │ │
│  │  │ JLPT Tabs   │  │  Search Bar                               │    │ │
│  │  │ N5-N1       │  │  kanjiService.searchKanji(query)          │    │ │
│  │  └──────┬──────┘  └───────────────────────────────────────────┘    │ │
│  │         │                                                           │ │
│  │         ▼                                                           │ │
│  │  ┌─────────────────────────────────────────────────────────────┐   │ │
│  │  │  Kanji Grid (5-12 cols responsive)                          │   │ │
│  │  │  kanjiService.loadKanjiByLevel(level)                       │   │ │
│  │  │  onClick ──► useFeature('kanji_drawing_practice')           │   │ │
│  │  │              .checkAndTrack()                                │   │ │
│  │  └──────────────────────────┬──────────────────────────────────┘   │ │
│  │                             │ allowed?                              │ │
│  └─────────────────────────────┼───────────────────────────────────────┘ │
│                                ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  View State: PRACTICING                                             │ │
│  │  ┌──────────────────────────────────────────────────────────────┐  │ │
│  │  │  DrawingPracticeSheet                                        │  │ │
│  │  │                                                              │  │ │
│  │  │  ┌──────────────┐  ┌─────────────────────────────────────┐  │  │ │
│  │  │  │ Kanji Info   │  │  StrokeBuildup                      │  │  │ │
│  │  │  │ Card         │  │  (horizontal scroll, SVG parsing)   │  │  │ │
│  │  │  └──────────────┘  └─────────────────────────────────────┘  │  │ │
│  │  │                                                              │  │ │
│  │  │  ┌──────────────────────────────────────────────────────┐   │  │ │
│  │  │  │  Practice Grid (3 cols mobile / 6 cols desktop)      │   │  │ │
│  │  │  │  12 x SimpleDrawingCanvas                            │   │  │ │
│  │  │  │                                                      │   │  │ │
│  │  │  │  [Canvas] [Canvas] [Canvas]  ← mobile (3/row)       │   │  │ │
│  │  │  │  [Canvas] [Canvas] [Canvas] [Canvas] [Canvas] [C]   │   │  │ │
│  │  │  │                              ↑ desktop (6/row)       │   │  │ │
│  │  │  │                                                      │   │  │ │
│  │  │  │  Each cell:                                          │   │  │ │
│  │  │  │  - 120x120 HTML5 canvas with crosshair grid          │   │  │ │
│  │  │  │  - Stroke counter badge                              │   │  │ │
│  │  │  │  - Ghost SVG on first cell                           │   │  │ │
│  │  │  │  - Readings overlay after all strokes drawn          │   │  │ │
│  │  │  │  - Clear / Undo buttons                              │   │  │ │
│  │  │  └──────────────────────────────────────────────────────┘   │  │ │
│  │  └──────────────────────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Description |
|------|-------------|
| `config/features.v1.json:139` | `kanji_drawing_practice` feature definition |
| `src/app/[locale]/tools/kanji-mastery/page.tsx:23` | `StudySettings.drawingMode` + toggle UI |
| `src/app/[locale]/tools/kanji-mastery/drawing/page.tsx:1` | Drawing selection page (JLPT tabs, search, grid) |
| `src/app/[locale]/tools/kanji-mastery/drawing/layout.tsx:1` | SEO metadata layout |
| `src/app/[locale]/tools/kanji-mastery/drawing/DrawingPracticeSheet.tsx:1` | Full practice sheet (info card, buildup, 12 cells) |
| `src/components/drawing-practice/SimpleDrawingCanvas.tsx:1` | Stripped-down drawing canvas with readings overlay |
| `src/components/drawing-practice/StrokeBuildup.tsx:1` | Progressive stroke buildup from KanjiVG SVG |
| `src/components/drawing-practice/ReadingReferenceCell.tsx:1` | Standalone reading cell (unused, kept for reuse) |
| `src/services/kanjiService.ts` | `loadKanjiByLevel()`, `searchKanji()`, `getStrokeOrderSVG()` |
| `src/types/kanji.ts:10` | `Kanji` interface |

---

## Entitlement Configuration

### Feature Definition

```json
{
  "id": "kanji_drawing_practice",
  "name": "Kanji Drawing Practice",
  "category": "learning",
  "lifecycle": "active",
  "permission": "do_practice",
  "limitType": "daily",
  "notifications": false,
  "description": "Practice drawing kanji through repetitive muscle-memory exercises",
  "metadata": {
    "contentType": "writing",
    "difficulty": "beginner",
    "estimatedDuration": "10-20 minutes",
    "countsForStreak": true,
    "givesXp": false
  }
}
```

### Plan Limits

| Plan | Daily Limit |
|------|-------------|
| Guest | 0 (blocked) |
| Free | 2 |
| Premium Monthly | -1 (unlimited) |
| Premium Yearly | -1 (unlimited) |

### Gating Behavior

Entitlement check occurs when the user **selects a kanji** (not on page load). This allows free users to browse all kanji before the limit applies.

```typescript
const { checkAndTrack } = useFeature('kanji_drawing_practice')

const handleKanjiSelect = async (kanji: Kanji) => {
  const allowed = await checkAndTrack({ showUI: true })
  if (!allowed) {
    // Toast shown automatically by checkAndTrack
    return
  }
  setSelectedKanji(kanji)
}
```

---

## i18n Support

All strings are localized across 6 languages:

| Locale | File |
|--------|------|
| English | `src/i18n/locales/en/strings.ts` |
| Italian | `src/i18n/locales/it/strings.ts` |
| Japanese | `src/i18n/locales/ja/strings.ts` |
| German | `src/i18n/locales/de/strings.ts` |
| Spanish | `src/i18n/locales/es/strings.ts` |
| French | `src/i18n/locales/fr/strings.ts` |

### String Namespace

All strings live under `kanjiMasteryTool.drawingApproach.*` (27 keys) plus SEO strings under `seo.kanjiMasteryDrawing.*` (2 keys).

---

## Related Documentation

- [Kanji Mastery Onboarding](../onboarding/KANJI_MASTERY_ONBOARDING.md) - Parent feature onboarding guide
- [Kanji Progress Summary](../kanji-mastery/KANJI_PROGRESS_SUMMARY.md) - Progress tracking component
- [Entitlements Guide](../entitlements/FEATURE_GUIDE.md) - How entitlement gating works
- [i18n Guide](../i18n/FEATURE_GUIDE.md) - Adding/updating translations

---

*Last Updated: 2026-02-14*
