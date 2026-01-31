# Textbook Vocabulary Feature

**Status:** ACTIVE
**Last Updated:** 2026-01-31
**Feature Owner:** Development Team
**Production Launch:** 2025-12-01

## Overview

The Textbook Vocabulary feature provides a comprehensive Japanese vocabulary learning system aligned with popular textbooks. Students can study, review, and track progress across 17,761+ vocabulary items from 10 textbooks including Genki, Minna no Nihongo, Dekiru Nihongo, and specialized sources.

**Core Value Proposition:**
- 📚 **Textbook-aligned learning** - Study vocabulary from your actual course materials
- 🎯 **SRS-powered reviews** - Spaced repetition with SM-2+ algorithm
- 📱 **Offline-first architecture** - Full functionality without internet
- 🎓 **Lesson-based organization** - Follow your textbook's structure
- 🔊 **Audio support** - Native Japanese TTS for all vocabulary
- 📊 **Progress tracking** - Per-textbook, per-lesson analytics

---

## Quick Start (< 5 minutes)

### For Users
1. Navigate to `/textbook-vocabulary`
2. Select a textbook (e.g., Genki 1)
3. Choose a lesson or search for words
4. Select vocabulary items to study
5. Click "Study" for flashcard mode or "Review" for SRS testing

### For Developers
```bash
# 1. View the feature
npm run dev
# Open http://localhost:3000/textbook-vocabulary

# 2. Convert a new Anki deck
node scripts/anki-deck-to-json.mjs \
  ~/Downloads/Your_Deck.apkg \
  your-textbook-id \
  "Your Textbook Title"

# 3. Integrate the textbook
# - Update src/data/textbooks/index.json
# - Add UI config to TextbookSelector.tsx
```

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Textbook Vocabulary Feature              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐      ┌──────────────┐      ┌──────────┐  │
│  │   Browse    │ ───> │    Study     │      │  Review  │  │
│  │  & Select   │      │  Flashcards  │      │  (SRS)   │  │
│  └─────────────┘      └──────────────┘      └──────────┘  │
│         │                     │                     │       │
│         └─────────────────────┴─────────────────────┘       │
│                              │                              │
│                    ┌─────────▼──────────┐                   │
│                    │  Progress Manager  │                   │
│                    │   (IndexedDB)      │                   │
│                    └─────────┬──────────┘                   │
│                              │                              │
│              ┌───────────────┼───────────────┐              │
│              │                               │              │
│     ┌────────▼────────┐           ┌─────────▼────────┐     │
│     │ URE Adapter     │           │  Sync to Firebase │     │
│     │ (Recognition,   │           │  (Premium users)  │     │
│     │  Listening)     │           └───────────────────┘     │
│     └─────────────────┘                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Data Sources (Static JSON):
  src/data/textbooks/
    ├── genki-1/all.json (1,496 items)
    ├── minna-1/all.json (2,029 items)
    └── kanji-in-context/all.json (9,279 items)
```

### Data Flow

```
User Interaction → Selection → Mode Choice
                                   │
                    ┌──────────────┼──────────────┐
                    │                             │
            Study Mode                      Review Mode
                    │                             │
                    ▼                             ▼
        Track View Count              URE Session Manager
                    │                             │
                    ▼                             ▼
       Progress Manager                  Event Hub (XP)
                    │                             │
                    └──────────────┬──────────────┘
                                   ▼
                            IndexedDB (Local)
                                   │
                                   ▼
                    Sync Queue → Firebase (Premium)
```

### Three View Modes

1. **Browse Mode** (Default)
   - Grid/List/Card views
   - Lesson filtering
   - Search functionality
   - Selection interface

2. **Study Mode** (Passive Learning)
   - Flashcard interface with flip animation
   - Interactive "recall" pills (meaning, reading, examples)
   - Tatoeba example sentences
   - Audio playback
   - Progress tracking (6 views = learned)
   - **XP Award:** Product requirement - awards XP on completion

3. **Review Mode** (Active Testing)
   - URE-powered SRS sessions
   - Recognition mode (meaning → Japanese)
   - Listening mode (audio → meaning)
   - Smart distractor generation
   - Statistics tracking

---

## Documentation Index

| Document | Description | Status |
|----------|-------------|--------|
| [README.md](./README.md) | This file - Feature overview and quick start | ✅ Active |
| [FEATURE_GUIDE.md](./FEATURE_GUIDE.md) | Complete implementation guide and code walkthrough | ✅ Active |
| [DATA_STRUCTURE_REFERENCE.md](./DATA_STRUCTURE_REFERENCE.md) | Data schema, validation, and adapter creation guide | ✅ Active |
| [DATA_PIPELINE_GUIDE.md](./DATA_PIPELINE_GUIDE.md) | Anki deck conversion and data creation process | ✅ Active |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common issues, debugging, and solutions | ✅ Active |

---

## Key Files & Components

### Page Components
- `src/app/[locale]/textbook-vocabulary/TextbookVocabularyPage.tsx:52-517` - Main orchestrator
- `src/app/[locale]/textbook-vocabulary/components/TextbookSelector.tsx:104-256` - Textbook grid
- `src/app/[locale]/textbook-vocabulary/components/VocabularyDisplay.tsx:73-620` - Browse/select interface

### Study & Review
- `src/components/textbook-vocabulary/TextbookVocabularyStudyMode.tsx:40-630` - Flashcard study mode
- `src/components/review-engine/ReviewSessionUI.tsx` - URE review interface (shared)

### Data Layer
- `src/lib/review-engine/adapters/TextbookVocabularyAdapter.ts:70-429` - URE adapter
- `src/utils/textbookVocabularyProgressManager.ts:19-273` - Progress tracking
- `src/data/textbooks/index.json` - Textbook registry

### Data Pipeline
- `scripts/anki-deck-to-json.mjs:1-248` - Anki → JSON converter (recommended)
- `scripts/convert-anki-to-textbook.ts:1-342` - TypeScript converter (legacy)

### Universal Review Engine Integration
- `src/lib/review-engine/core/interfaces.ts:42` - ReviewableContent interface
- `src/lib/review-engine/adapters/base.adapter.ts` - BaseContentAdapter
- `src/lib/review-engine/progress/UniversalProgressManager.ts:95-100` - Progress base class

---

## Technology Stack

### Frontend
- **Next.js 15.5.2** - App Router, dynamic imports, i18n
- **React 19** - Hooks, Context API, AnimatePresence
- **Framer Motion** - Flashcard flip animations, transitions
- **TypeScript** - Full type safety

### Data Storage
- **IndexedDB** (via `idb` library) - Offline-first local storage
- **Firebase Firestore** - Premium user sync
- **Static JSON** - 17,761 vocabulary items (build-time included)

### Review Engine
- **Universal Review Engine (URE)** - SRS algorithm, session management
- **SM-2+ Algorithm** - Enhanced spaced repetition
- **Event Hub** - Gamification/XP integration

### Audio
- **TTS Service** - VOICEVOX → ElevenLabs → Web Speech API
- **Audio Preloading** - Chunked, staggered for performance

---

## Current Dataset (17,761 Items)

### Popular Textbooks (8,642 items)
1. **Genki 1** - 1,496 cards (Elementary Japanese)
2. **Genki 2** - 491 cards (Elementary Japanese II)
3. **Genki 2 New (3rd Ed.)** - 589 cards (Updated curriculum)
4. **Minna no Nihongo 1** - 2,029 cards (Japanese for Everyone)
5. **Minna no Nihongo 2** - 1,058 cards (Japanese for Everyone II)
6. **Dekiru Nihongo 1** - 645 cards (Beginner Japanese)
7. **Dekiru Nihongo 2** - 390 cards (Intermediate Japanese)
8. **Dekiru Nihongo Beginner** - 284 cards (Beginner/Intermediate)

### Specialized Sources (9,119 items)
9. **Kaishi 1.5K** - 1,500 cards (Core Vocabulary)
10. **Kanji in Context** - 9,279 cards (Comprehensive Kanji Study)

**All data sourced from Anki decks via automated conversion pipeline.**

---

## Feature Entitlements

### Guest Users
- ❌ No access to textbook vocabulary feature
- Redirected to sign-up

### Free Users
- ✅ Access to all textbooks
- ✅ Unlimited browsing
- ⚠️ **3 lessons per day** (tracked via `/api/usage/textbook_vocabulary/check`)
- ✅ Study mode (unlimited)
- ✅ Review mode (unlimited sessions)
- 📊 Progress tracked locally (IndexedDB only)

### Premium Users
- ✅ All free features
- ✅ **Unlimited lesson access**
- ✅ "All Lessons" view option
- ☁️ Cloud sync to Firebase
- 📈 Cross-device progress sync

**Entitlement ID:** `textbook_vocabulary`
**Config:** `config/features.v1.json`

---

## Performance Characteristics

### Load Times
- **Textbook Selection Page:** < 100ms (static data)
- **Vocabulary Display (1000 items):** 200-400ms (naive rendering)
- **Study Mode Load:** < 50ms (single item)
- **Review Session Start:** < 100ms (URE initialization)

### Storage
- **IndexedDB:** ~2-5MB per user (progress data)
- **Static Assets:** 12MB (all textbook JSON files)
- **TTS Cache:** Variable (depends on usage)

### Known Performance Issues
⚠️ **Large textbooks** (9,279 items) render all at once - no virtualization
⚠️ **Search** is client-side only - no fuzzy matching or indexing
⚠️ **Audio preload** uses fixed 1s stagger - not adaptive

---

## Integration Points

### With Other Systems

1. **Universal Review Engine (URE)**
   - Adapter pattern for content transformation
   - Session management for reviews
   - SRS algorithm for scheduling

2. **Gamification System**
   - Event Hub for XP emissions
   - Study mode: SESSION_COMPLETED event
   - Review mode: Automatic via URE

3. **TTS System**
   - Audio generation for Japanese text
   - Preloading strategy for visible items
   - Fallback to Web Speech API

4. **Entitlements System**
   - Feature gating (`useFeature` hook)
   - Lesson access limits (3/day free)
   - Premium unlock detection

5. **Progress Tracking**
   - `UniversalProgressManager` base class
   - IndexedDB for local persistence
   - Firebase sync for premium users

---

## Testing

### Current Coverage
⚠️ **CRITICAL GAP:** No test files found for textbook vocabulary feature

### Recommended Test Suite (To Be Implemented)

**Unit Tests:**
```bash
# Adapter tests (distractor logic, difficulty calculation)
npm run test src/lib/review-engine/adapters/TextbookVocabularyAdapter.test.ts

# Progress manager tests
npm run test src/utils/textbookVocabularyProgressManager.test.ts
```

**Integration Tests:**
```bash
# Study workflow
npm run test src/components/textbook-vocabulary/StudyMode.test.tsx

# Review workflow
npm run test src/app/[locale]/textbook-vocabulary/ReviewFlow.test.tsx
```

**E2E Tests:**
```bash
# Full user journey
npm run test:e2e -- textbook-vocabulary.spec.ts
```

---

## Common Workflows

### Adding a New Textbook

1. **Convert Anki Deck:**
   ```bash
   node scripts/anki-deck-to-json.mjs \
     ~/Downloads/New_Deck.apkg \
     new-textbook-id \
     "New Textbook Title"
   ```

2. **Update Registry:**
   ```json
   // src/data/textbooks/index.json
   {
     "totalCards": 18500, // Update count
     "textbooks": {
       "new-textbook-id": {
         "title": "New Textbook Title",
         "cardCount": 750
       }
     }
   }
   ```

3. **Add UI Config:**
   ```typescript
   // TextbookSelector.tsx
   'new-textbook-id': {
     icon: '🎌',
     color: 'from-emerald-400 to-teal-500',
     shadowColor: 'shadow-emerald-200',
     hoverShadow: 'hover:shadow-emerald-300',
     level: 'N4-N5',
     description: 'Short description',
     lessons: 12
   }
   ```

### Debugging Progress Issues

```typescript
// Check local progress
const manager = textbookVocabularyProgressManager;
const progress = await manager.getTextbookProgress(user, isPremium, 'genki-1');
console.log('Progress:', progress);

// Check sync queue
const syncQueue = await manager.getSyncQueue();
console.log('Pending syncs:', syncQueue);

// Force sync (premium users)
await manager.forceSyncAll();
```

### Monitoring Feature Usage

```typescript
// Check entitlement status
const { checkAndTrack, isLimited } = useFeature('textbook_vocabulary');

// Track lesson access
const allowed = await checkAndTrack({
  showUI: true,
  metadata: { itemId: 'genki-1:lesson-5' }
});

// Get usage stats
const usageData = useFeatureUsage('textbook_vocabulary');
console.log('Remaining:', usageData.remaining);
```

---

## Known Issues & Limitations

### High Priority (Affects UX)
1. **No test coverage** - Critical gap for reliability
2. **Large datasets don't virtualize** - Performance issues with 9K+ items
3. **Search is basic** - No fuzzy matching, romaji support, or indexing
4. **HTML in source data** - Some vocabulary has corrupted HTML tags

### Medium Priority (Enhancement Needed)
5. **Audio preload not adaptive** - Fixed 1s stagger regardless of network
6. **No offline sync visibility** - Users don't see pending syncs
7. **Study mode XP debatable** - Passive learning awards same XP as active review

### Low Priority (Nice to Have)
8. **No lesson metadata** - Only lesson numbers, no titles/descriptions
9. **Limited accessibility** - No keyboard shortcuts, ARIA labels
10. **No analytics** - Can't track which textbooks/lessons are popular

---

## Roadmap & Future Enhancements

### Immediate (High Priority)
- [ ] Add comprehensive test suite (80%+ coverage requirement)
- [ ] Implement virtual scrolling for large datasets
- [ ] Add sync status indicator to UI
- [ ] Build-time data validation pipeline

### Short-term (Next Quarter)
- [ ] Enhanced search (fuzzy matching, romaji input)
- [ ] Lesson metadata enrichment (titles, descriptions)
- [ ] Accessibility improvements (keyboard nav, ARIA)
- [ ] Adaptive audio preloading based on network speed

### Long-term (Roadmap)
- [ ] Custom vocabulary lists (user-created)
- [ ] Export/import progress feature
- [ ] Advanced filtering (part of speech, JLPT level)
- [ ] Analytics dashboard for usage insights
- [ ] Community-contributed textbooks

---

## Related Documentation

### Internal Docs
- [Universal Review Engine Deep Dive](../../docs/REVIEW_ENGINE_DEEP_DIVE.md)
- [Universal Review Engine Practical Guide](../../docs/REVIEW_ENGINE_PRACTICAL_GUIDE.md)
- [Entitlements System](../entitlements/README.md)
- [TTS System Guide](../tts/TTS_SYSTEM_GUIDE.md)

### External Resources
- [SM-2 Algorithm Explanation](https://www.supermemo.com/en/archives1990-2015/english/ol/sm2)
- [Anki Manual](https://docs.ankiweb.net/)
- [IndexedDB Best Practices](https://web.dev/articles/indexeddb-best-practices)

---

## Support & Troubleshooting

**For common issues, see:** [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

**For implementation help, see:** [FEATURE_GUIDE.md](./FEATURE_GUIDE.md)

**For data structure & adapters, see:** [DATA_STRUCTURE_REFERENCE.md](./DATA_STRUCTURE_REFERENCE.md)

**For data pipeline questions, see:** [DATA_PIPELINE_GUIDE.md](./DATA_PIPELINE_GUIDE.md)

---

**Maintainer:** Development Team
**Created:** 2026-01-31
**Last Reviewed:** 2026-01-31
