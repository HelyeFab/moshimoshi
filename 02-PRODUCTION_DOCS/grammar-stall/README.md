# Grammar Stall

**Status:** ACTIVE
**Last Updated:** 2026-01-28

## Overview

The Grammar Stall is an interactive Japanese grammar learning feature that provides comprehensive grammar point explanations, example sentences, and practice exercises. Content is organized by JLPT level with detailed breakdowns of grammar structures.

## Quick Start

1. **Add grammar content**: See `ADDING_GRAMMAR_CONTENT.md` for content creation process
2. **Grammar structure**: Points organized by JLPT level (N5-N1)
3. **Interactive exercises**: Practice with example sentences and drills
4. **Search and filter**: Find grammar points by level, type, or keyword

## Documentation

| Document | Description |
|----------|-------------|
| [ADDING_GRAMMAR_CONTENT.md](./ADDING_GRAMMAR_CONTENT.md) | Guide for adding new grammar points and content |

## Key Topics

- **Grammar point database** - Structured grammar explanations
- **JLPT organization** - Content sorted by proficiency level
- **Example sentences** - Real-world usage examples
- **Practice exercises** - Interactive drills and quizzes
- **Search functionality** - Find grammar by structure or meaning
- **Furigana support** - Reading aids for all Japanese text

## Architecture

```
Grammar Stall
├── Content Database
│   ├── Grammar points (Firebase)
│   ├── Example sentences
│   └── Practice exercises
├── User Interface
│   ├── Browse by level
│   ├── Search and filter
│   └── Interactive practice
└── Progress Tracking
    ├── Completed grammar points
    ├── Exercise scores
    └── SRS review scheduling
```

## Key Files

- `src/app/[locale]/tools/grammar-stall/page.tsx:45` - Main grammar interface
- `src/lib/grammar/content-manager.ts:89` - Content management service
- `src/components/grammar/GrammarPoint.tsx:67` - Grammar display component
- `data/grammar/` - Grammar content JSON files

## Grammar Point Structure

Each grammar point includes:
- **Grammar pattern** - The structure being taught (e.g., ～てください)
- **JLPT level** - Difficulty classification
- **Meaning** - English explanation
- **Formation** - How to construct the pattern
- **Example sentences** - 5-10 examples with translations
- **Usage notes** - When and how to use
- **Related grammar** - Similar or contrasting patterns
- **Practice exercises** - Interactive drills

## Content Organization

```
Grammar Database
├── N5 (100 points)
│   ├── Basic particles
│   ├── Verb conjugations
│   └── Essential patterns
├── N4 (80 points)
├── N3 (120 points)
├── N2 (150 points)
└── N1 (200 points)
```

## Adding New Grammar Points

1. Create grammar point JSON file
2. Include all required fields (pattern, meaning, examples)
3. Add furigana for all kanji
4. Create practice exercises
5. Link to related grammar points
6. Test in development
7. Deploy to production

See [ADDING_GRAMMAR_CONTENT.md](./ADDING_GRAMMAR_CONTENT.md) for detailed instructions.

## Features

- **Interactive examples** - Click to hear pronunciation
- **Breakdown mode** - See particle-by-particle analysis
- **Comparison tool** - Compare similar grammar patterns
- **Save favorites** - Bookmark frequently referenced points
- **Progress tracking** - Mark grammar as learned
- **SRS integration** - Review grammar in spaced repetition

---

*For content creation guide, see [ADDING_GRAMMAR_CONTENT.md](./ADDING_GRAMMAR_CONTENT.md)*
