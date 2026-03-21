# Feature Announcements System

**Status:** ACTIVE
**Last Updated:** 2026-01-28

## Overview

The Feature Announcements system provides in-app overlay notifications to inform users about new features, updates, and important information. It includes analytics tracking, user dismissal management, and admin controls for creating and managing announcements.

## Quick Start

1. **View announcements admin**: `/[locale]/admin/announcements`
2. **Create announcement**: Use the announcement form with title, message, and feature ID
3. **Track analytics**: View engagement metrics directly on announcement cards
4. **Use template**: Copy `_TEMPLATE.md` for new announcement documentation

## Documentation

| Document | Description |
|----------|-------------|
| [QUICK_START.md](./QUICK_START.md) | Quick guide to viewing and managing announcement analytics |
| [ANALYTICS_IMPLEMENTATION.md](./ANALYTICS_IMPLEMENTATION.md) | Technical implementation of analytics tracking system |
| [_TEMPLATE.md](./_TEMPLATE.md) | Template for documenting new announcement features |
| [kanji-mastery-progress.md](./kanji-mastery-progress.md) | Example: Kanji Mastery progress announcement |
| [kuchiguse500-deck-update.md](./kuchiguse500-deck-update.md) | Launch copy for Kuchiguse 500 deck/audio/format updates |
| [adjectives-100-master-deck.md](./adjectives-100-master-deck.md) | Launch copy for 100 Japanese Adjectives Master Deck |

## Key Topics

- **In-app overlays** - Modal-style feature announcements
- **Analytics tracking** - Views, dismissals, engagement rates
- **Admin management** - Create, publish, archive announcements
- **User preferences** - Per-user dismissal tracking
- **Feature gating** - Show announcements for specific features

## Key Files

- `src/components/announcements/FeatureAnnouncementOverlay.tsx:156` - Main overlay component
- `src/app/[locale]/admin/announcements/page.tsx:89` - Admin management interface
- `src/app/api/announcements/track-view/route.ts:23` - Analytics tracking API
- `src/lib/announcements/types.ts:12` - Type definitions

## Architecture

```
Announcements System
├── Frontend
│   ├── FeatureAnnouncementOverlay (Display)
│   └── Admin Interface (Management)
├── Backend
│   ├── Firebase (Storage)
│   └── Analytics API (Tracking)
└── User State
    └── Dismissal Tracking (LocalStorage + Firebase)
```

## Analytics Metrics

- **Views**: Total and unique user views
- **Dismissals**: How many users dismissed the announcement
- **Engagement Rate**: Percentage of users who engaged (dismissed)
- **Real-time updates**: Metrics update as users interact

## Creating New Announcements

1. Navigate to admin announcements page
2. Fill in announcement details (title, message, feature ID)
3. Preview before publishing
4. Publish to show to all users
5. Monitor analytics to track engagement

## Behavior Notes

- **Single active announcement**: Overlay shows the most recent `published` announcement (`publishedAt desc`, `limit 1`)
- **Dismissal scope**: Dismissal is tracked per user/visitor (`{visitorValue}_{announcementId}`), so dismissed items do not reappear for that user
- **Display scope**: Current overlay is shown to authenticated users on non-auth pages

## Scripted Seeding

Each announcement has a markdown content file and a corresponding seed script.

### Kuchiguse 500 Deck Update
- Markdown: [kuchiguse500-deck-update.md](./kuchiguse500-deck-update.md)
- Seed script: `scripts/announcements/seed-kuchiguse500-announcement.mjs`
  - Dry run: `node scripts/announcements/seed-kuchiguse500-announcement.mjs --dry-run`
  - Draft create: `node scripts/announcements/seed-kuchiguse500-announcement.mjs`
  - Publish now: `node scripts/announcements/seed-kuchiguse500-announcement.mjs --publish`

### 100 Japanese Adjectives Master Deck
- Markdown: [adjectives-100-master-deck.md](./adjectives-100-master-deck.md)
- Seed script: `scripts/announcements/seed-adjectives100-announcement.mjs`
  - Dry run: `node scripts/announcements/seed-adjectives100-announcement.mjs --dry-run`
  - Draft create: `node scripts/announcements/seed-adjectives100-announcement.mjs`
  - Publish now: `node scripts/announcements/seed-adjectives100-announcement.mjs --publish`

### Creating New Seed Scripts
Use any existing seed script as a template. The pattern:
1. Create markdown in `02-PRODUCTION_DOCS/announcements/<slug>.md`
2. Copy an existing seed script to `scripts/announcements/seed-<slug>-announcement.mjs`
3. Update `payload` (title, featureId, imageUrl) and the markdown path
4. Run the seed script — draft by default, `--publish` to go live immediately
5. The `/marketeer` Claude Code skill automates this entire process

---

*For complete analytics guide, see [ANALYTICS_IMPLEMENTATION.md](./ANALYTICS_IMPLEMENTATION.md)*
