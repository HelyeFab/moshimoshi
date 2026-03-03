

# Content Generation System

**Status:** ACTIVE
**Last Updated:** 2026-02-27

## Overview

The Content Generation system creates AI-powered learning materials including stories, dialogues, and comic-style manga content. It uses OpenAI and Anthropic APIs with scheduled generation, JLPT-level targeting, and quality validation.

## Quick Start

1. **Scheduled generation**: Automated story creation runs on schedule
2. **JLPT levels**: Content generated for all levels (N5-N1)
3. **Story templates**: Configurable themes and difficulty
4. **Comic generation**: Panel-based manga-style stories with images
5. **Automation controls**: Use Admin Feature Flags to pause/resume schedulers per content type

## Automation Switches (Admin Feature Flags)

Automation is controlled in Firestore at `config/featureFlags` via the Admin page `/admin/feature-flags`.

- `STORY_AUTOMATION`: Controls scheduled story generation and daily story retry scheduler
- `NEWS_AUTOMATION`: Controls scheduled news scraper and scheduled article audio generator
- `COMICS_AUTOMATION`: Controls scheduled comic generation

Behavior:

- These switches affect scheduled jobs only.
- Manual admin generation flows remain available.

## Documentation

| Document | Description |
|----------|-------------|
| [SCHEDULED_STORY_GENERATION.md](./SCHEDULED_STORY_GENERATION.md) | Automated story generation system with scheduling |
| [story-comics.md](./story-comics.md) | Comic/manga story feature documentation |
| [STORY_GENERATION_DEEPDIVE.md](./STORY_GENERATION_DEEPDIVE.md) | End-to-end story generation deepdive (scheduler, admin, word precompute) |
| [BOOK_GENERATION_DEEPDIVE.md](./BOOK_GENERATION_DEEPDIVE.md) | End-to-end book generation deepdive (admin flow, publish, word precompute) |
| [DRILL_WORD_RESOLVER_AI_FALLBACK_PLAN.md](./DRILL_WORD_RESOLVER_AI_FALLBACK_PLAN.md) | Implementation plan + status for AI fallback word resolution + Firebase cache for Conjugation Drill focus mode |
| [DRILL_AI_FALLBACK_RUNBOOK.md](../conjugation-drill/DRILL_AI_FALLBACK_RUNBOOK.md) | QA checklist, cache schema reference, and troubleshooting for the drill AI fallback system |

## Key Topics

- **AI story generation** - OpenAI/Anthropic integration
- **Scheduled creation** - Automated content pipeline
- **JLPT targeting** - Level-appropriate vocabulary and grammar
- **Quality validation** - Automated checks for appropriateness
- **Comic panels** - Visual storytelling with generated images
- **Content templates** - Reusable story structures
- **Shared AI processor patterns** - Reusing processor/hybrid/cache patterns for non-content runtime fallbacks (e.g. drill word resolution)

## Architecture

```
Content Generation Pipeline
├── Scheduler
│   ├── Cron jobs
│   └── Queue management
├── AI Generation
│   ├── OpenAI API (Stories)
│   ├── Anthropic API (Dialogues)
│   └── Image generation (Comics)
├── Validation
│   ├── Grammar checks
│   ├── Vocabulary level verification
│   └── Content appropriateness
└── Storage
    ├── Firebase (Metadata)
    └── R2 (Media assets)
```

## Key Files

- `src/lib/content/story-generator.ts:89` - Story generation logic
- `src/lib/content/comic-generator.ts:123` - Comic panel creation
- `src/app/api/content/generate/route.ts:45` - Generation API endpoint
- `config/content-templates.json:12` - Story templates configuration

## Story Generation Features

- **Theme-based**: Different genres (slice-of-life, adventure, mystery)
- **Level-appropriate**: Vocabulary and grammar match JLPT level
- **Audio integration**: TTS for all generated content
- **Furigana support**: Automatic reading aids
- **Translation**: English translations included

## Comic Generation Features

- **Panel layout**: Configurable panel arrangements
- **Character consistency**: Maintained across panels
- **Speech bubbles**: Automatic text placement
- **Style options**: Manga, anime, or realistic styles
- **Background generation**: Scene-appropriate backgrounds

## Scheduling

Stories are generated on a schedule:
- **Daily**: N5 and N4 content (high demand)
- **3x weekly**: N3 content
- **Weekly**: N2 and N1 content
- **Manual**: Special events and themes

Use the automation switches above to pause/resume scheduled runs without changing code or cron definitions.

---

*For technical implementation details, see [SCHEDULED_STORY_GENERATION.md](./SCHEDULED_STORY_GENERATION.md)*
