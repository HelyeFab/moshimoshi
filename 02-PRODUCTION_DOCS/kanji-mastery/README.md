# Kanji Mastery

**Status:** ACTIVE
**Last Updated:** 2026-01-28

## Overview

Kanji Mastery is a comprehensive kanji learning system featuring a 3-round learning methodology, SRS-based review scheduling, and progress tracking. Users learn kanji through progressive rounds: Learn → Test → Evaluate, with intelligent spacing and randomization to prevent pattern memorization.

## Quick Start

1. **Onboarding**: Read `KANJI_MASTERY_ONBOARDING.md` for complete system overview
2. **Testing**: See `KANJI_MASTERY_TEST_SUITE.md` for test coverage and quality assurance
3. **Progress tracking**: Review `KANJI_PROGRESS_SUMMARY.md` for analytics implementation
4. **SRS improvements**: Check `SRS_TEST_ORDER_RANDOMIZATION_PLAN.md` for latest enhancements

## Documentation

| Document | Description |
|----------|-------------|
| [KANJI_MASTERY_ONBOARDING.md](./KANJI_MASTERY_ONBOARDING.md) | Complete onboarding guide (feature flow, SRS pipeline, storage/sync) |
| [KANJI_MASTERY_TEST_SUITE.md](./KANJI_MASTERY_TEST_SUITE.md) | Comprehensive test suite documentation |
| [KANJI_PROGRESS_SUMMARY.md](./KANJI_PROGRESS_SUMMARY.md) | Interactive progress component with Firebase API and i18n |
| [SRS_TEST_ORDER_RANDOMIZATION_PLAN.md](./SRS_TEST_ORDER_RANDOMIZATION_PLAN.md) | Plan for randomizing test order to prevent memorization |

## Key Topics

- **3-round methodology** - Learn → Test → Evaluate progression
- **SRS algorithm** - SM-2+ with interval randomization
- **Progress tracking** - Firebase API for premium, IndexedDB for free users
- **Test randomization** - Prevent pattern-based memorization
- **Mobile responsive** - Compact 36px grid cells for mobile
- **i18n support** - 6 languages (EN, JA, ES, FR, DE, IT)
- **Audio support** - TTS integration for kanji readings

## Architecture

```
Kanji Mastery System
├── Learning Flow
│   ├── Round 1: Learn (Flashcard presentation)
│   ├── Round 2: Test (Recall validation)
│   └── Round 3: Evaluate (Write from memory)
├── SRS Engine
│   ├── SM-2+ algorithm
│   ├── Interval randomization (±5%)
│   ├── Overdue bonus (+20-50%)
│   └── Leech detection (8+ failures)
├── Storage
│   ├── Premium: Firebase API
│   ├── Free: IndexedDB fallback
│   └── Sync: Background queue
└── Progress Tracking
    ├── Mastered (21+ days, 90% accuracy)
    ├── Review (in SRS rotation)
    └── Learning (initial acquisition)
```

## Key Files

- `src/app/[locale]/tools/kanji-mastery/learn/LearnContent.tsx:89` - Main learning interface
- `src/app/[locale]/tools/kanji-mastery/learn/components/Round1Learn.tsx:45` - Learn round
- `src/app/[locale]/tools/kanji-mastery/learn/components/Round2Test.tsx:67` - Test round
- `src/app/[locale]/tools/kanji-mastery/learn/components/Round3Evaluate.tsx:78` - Evaluate round
- `src/lib/review-engine/srs/algorithm.ts:156` - SRS calculation
- `src/lib/kanji-mastery/progress-manager.ts:123` - Progress tracking

## Learning Methodology

### Round 1: Learn
- Display kanji with readings and meanings
- Show example words and sentences
- Audio playback for pronunciation
- User marks when ready to proceed

### Round 2: Test
- Present kanji without hints
- Multiple choice or recall input
- Immediate feedback
- Track success rate

### Round 3: Evaluate
- Write kanji from memory
- Canvas-based drawing input
- Stroke order guidance
- Final assessment

## SRS Configuration

```typescript
{
  initialEaseFactor: 2.5,
  minEaseFactor: 1.3,
  maxEaseFactor: 2.5,
  learningSteps: [0.0069, 0.0208], // 10min, 30min
  graduatingInterval: 1, // 1 day
  maxInterval: 365,
  leechThreshold: 8
}
```

## Progress States

- **New** - Never studied
- **Learning** - Initial acquisition (< 1 day interval)
- **Review** - Active SRS rotation (1-365 days)
- **Mastered** - 21+ days interval with 90%+ accuracy

## Test Suite

Comprehensive test coverage includes:
- Unit tests for SRS algorithm (95% coverage)
- Integration tests for learning flow
- Progress tracking validation
- Randomization verification
- Offline sync testing

See [KANJI_MASTERY_TEST_SUITE.md](./KANJI_MASTERY_TEST_SUITE.md) for details.

## Premium vs Free

| Feature | Free | Premium |
|---------|------|---------|
| Basic learning | ✅ | ✅ |
| SRS reviews | ✅ | ✅ |
| Progress tracking | IndexedDB | Firebase API |
| Cross-device sync | ❌ | ✅ |
| Progress analytics | Basic | Advanced |
| Unlimited kanji | Limited | ✅ |

---

*For complete onboarding guide, see [KANJI_MASTERY_ONBOARDING.md](./KANJI_MASTERY_ONBOARDING.md)*
