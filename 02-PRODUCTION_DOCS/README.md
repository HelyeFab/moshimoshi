# Production Documentation

This folder contains production-level documentation for the Moshimoshi Japanese Learning Platform. These documents cover live systems, integrations, and solutions to production issues.

---

## Directory Structure

```
02-PRODUCTION_DOCS/
├── README.md                      # This file
├── BUGS/                          # Production bug reports and post-mortems
├── authentication/                # Auth flows, OAuth, session management
├── payments/                      # Stripe, discounts, subscriptions
│   └── discounts/                 # Discount system documentation
├── email/                         # Email notifications and delivery systems
├── content-generation/            # AI-generated content, stories, comics
├── community/                     # Discord, social integrations
├── kanji-mastery/                 # Kanji learning tool documentation
└── tts/                           # Text-to-Speech system documentation
```

---

## Quick Reference

### Bug Reports (`BUGS/`)

| Document | Date | Severity | Platform |
|----------|------|----------|----------|
| [Hiragana Dots on Android Chrome](./BUGS/2025-01-27_HIRAGANA_DOTS_ANDROID_CHROME.md) | 2025-01-27 | High | Android |

**Purpose:**
- Post-mortem documentation for production bugs
- Learning resource for new developers
- Historical record of issues and solutions

---

### Authentication (`authentication/`)

| Document | Description |
|----------|-------------|
| [AUTH_FLOW_DEBUG_GUIDE.md](./authentication/AUTH_FLOW_DEBUG_GUIDE.md) | Complete guide to authentication flows including the Apple Sign-In Safari fix using Apple's native JS SDK |

**Key Topics:**
- Apple Sign-In (Safari ITP workaround)
- Google Sign-In
- Firebase Auth integration
- Session management with JWT/Redis

---

### Payments (`payments/`)

| Document | Description |
|----------|-------------|
| [discounts/DISCOUNT_SYSTEM.md](./payments/discounts/DISCOUNT_SYSTEM.md) | Config-driven discount system with admin management |

**Key Topics:**
- Stripe coupon/promo code integration
- Admin-grantable discounts (Thank You 50%)
- Auto-apply discounts at checkout
- Adding new discount types

---

### Email Systems (`email/`)

| Document | Description |
|----------|-------------|
| [EMAIL_TEMPLATES.md](./email/EMAIL_TEMPLATES.md) | Complete guide to creating and managing email templates |
| [EMAIL_NOTIFICATIONS.md](./email/EMAIL_NOTIFICATIONS.md) | Admin notification system for alerts |
| [EMAIL_SUPPRESSION_SYSTEM.md](./email/EMAIL_SUPPRESSION_SYSTEM.md) | Bounce and unsubscribe handling |

**Key Topics:**
- Creating email templates (HTML structure, components, variables)
- Resend email integration
- Admin notifications
- Bounce handling
- Suppression lists

---

### Content Generation (`content-generation/`)

| Document | Description |
|----------|-------------|
| [SCHEDULED_STORY_GENERATION.md](./content-generation/SCHEDULED_STORY_GENERATION.md) | Automated story generation system with scheduling |
| [story-comics.md](./content-generation/story-comics.md) | Comic/manga story feature documentation |

**Key Topics:**
- AI story generation (OpenAI/Anthropic)
- Scheduled content creation
- Story templates and JLPT levels
- Comic panel generation

---

### Community (`community/`)

| Document | Description |
|----------|-------------|
| [DISCORD_COMMUNITY_SETUP.md](./community/DISCORD_COMMUNITY_SETUP.md) | Discord server setup and bot integration guide |

**Key Topics:**
- Discord server structure
- Bot configuration
- Community channels
- Moderation setup

---

### Kanji Mastery (`kanji-mastery/`)

| Document | Description |
|----------|-------------|
| [KANJI_PROGRESS_SUMMARY.md](./kanji-mastery/KANJI_PROGRESS_SUMMARY.md) | Interactive kanji progress component with Firebase API, i18n, and modal integration |

**Key Topics:**
- Firebase API integration for premium users
- IndexedDB fallback for free users
- Interactive kanji grids with KanjiDetailsModal
- Mobile-responsive layout (compact 36px cells)
- i18n translations (6 languages)
- SRS status visualization (Mastered/Review/Learning)

---

### Text-to-Speech (`tts/`)

| Document | Description |
|----------|-------------|
| [TTS_SYSTEM_GUIDE.md](./tts/TTS_SYSTEM_GUIDE.md) | Complete developer onboarding guide for the TTS system |

**Key Topics:**
- Multi-provider architecture (VOICEVOX → ElevenLabs → Web Speech API)
- Dual-layer caching (Firestore server + IndexedDB client)
- `useTTS` hook usage and configuration
- API routes reference (`/api/tts/*`)
- Extending TTS to new components
- iOS compatibility workarounds
- Playback speed with pitch preservation
- Performance optimization strategies

**Key Files:**
- `src/hooks/useTTS.ts` - Main React hook
- `src/lib/tts/service.ts` - Server-side orchestration
- `src/lib/tts/providers/voicevox.ts` - Primary provider
- `src/lib/tts/offlineCache.ts` - IndexedDB cache

---

## Document Standards

### Status Indicators

Each document should include a status at the top:

- **ACTIVE** - Currently in use, maintained
- **RESOLVED** - Issue documented and fixed
- **DEPRECATED** - No longer in use
- **DRAFT** - Work in progress

### Required Sections

Production documents should include:

1. **Overview/Summary** - What this document covers
2. **Architecture** - System design and flow diagrams
3. **Configuration** - Required settings and environment variables
4. **Troubleshooting** - Common issues and solutions
5. **Related Resources** - Links to external docs and references

---

## Contributing

When adding new production documentation:

1. Place in the appropriate subfolder (or create a new one if needed)
2. Follow the naming convention: `FEATURE_NAME.md` (uppercase with underscores)
3. Include status and date at the top
4. Update this README with the new document

---

*Last Updated: 2026-01-27*
