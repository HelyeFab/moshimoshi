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
├── blast-mode/                    # Blast Mode documentation
├── entitlements/                  # Entitlements and gating documentation
├── admin-dashboard/               # Admin dashboard development guide
├── learning-village-low-power/    # Learning Village performance optimization
├── onboarding/                    # Developer onboarding guides
├── textbook-vocabulary/           # Textbook vocabulary feature documentation
├── tts/                           # Text-to-Speech system documentation
├── user-agent-tracking/           # User agent tracking for support forms
├── entertainment-system/          # Games, achievements, leaderboard, review hub
├── user-analytics/                # User retention and engagement analysis scripts
└── i18n/                          # Internationalization system (6 languages)
```

---

## Quick Reference

### Onboarding (`onboarding/`)

| Document | Description |
|----------|-------------|
| [KANJI_MASTERY_ONBOARDING.md](./onboarding/KANJI_MASTERY_ONBOARDING.md) | Kanji Mastery onboarding guide (feature flow, SRS pipeline, storage/sync) |
| [FLASHCARDS_ONBOARDING.md](./flashcards/FLASHCARDS_ONBOARDING.md) | Flashcards + Anki resident onboarding guide |

**Key Topics:**
- Local setup and dev commands
- Required environment variables
- Auth, Stripe, Redis, R2, SRS architecture
- Testing and troubleshooting

---

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

### Blast Mode (`blast-mode/`)

| Document | Description |
|----------|-------------|
| [BLAST_MODE_OVERVIEW.md](./blast-mode/BLAST_MODE_OVERVIEW.md) | Blast Mode product + technical overview |
| [BLAST_MODE_PHASED_IMPLEMENTATION.md](./blast-mode/BLAST_MODE_PHASED_IMPLEMENTATION.md) | Phased implementation plan with acceptance criteria |

**Key Topics:**
- Adaptive 6-step flow (MCQ + tiles, no typing)
- Multi-content support (kanji, vocab, lists)
- Step generation and distractor strategy
- Phased rollout plan

---

### Entitlements & Gating (`entitlements/`)

| Document | Description |
|----------|-------------|
| [README.md](./entitlements/README.md) | Overview and quick start |
| [FEATURE_GUIDE.md](./entitlements/FEATURE_GUIDE.md) | Implementation patterns and UX standards |
| [API_REFERENCE.md](./entitlements/API_REFERENCE.md) | Entitlements API endpoints |
| [TROUBLESHOOTING.md](./entitlements/TROUBLESHOOTING.md) | Common issues and fixes |

**Key Topics:**
- Config-driven limits (daily/monthly, guest/free/premium)
- Client gating patterns (EntitlementGate vs useFeature)
- Server enforcement and usage tracking
- Admin entitlements dashboard

---

### Admin Dashboard (`admin-dashboard/`)

| Document | Description |
|----------|-------------|
| [DEVELOPER_GUIDE.md](./admin-dashboard/DEVELOPER_GUIDE.md) | Complete guide to creating and maintaining admin dashboard pages |
| [QUICK_REFERENCE.md](./admin-dashboard/QUICK_REFERENCE.md) | Quick lookup for common admin patterns and code snippets |
| [AUTH_FIX_SUMMARY.md](./admin-dashboard/AUTH_FIX_SUMMARY.md) | Documentation of authentication pattern fixes (2026-01-28) |
| [SECURITY_HARDENING.md](./admin-dashboard/SECURITY_HARDENING.md) | Security improvements: 'server-only' guards, error boundaries, React version verification |
| [METRICS_EXPLANATION.md](./admin-dashboard/METRICS_EXPLANATION.md) | How dashboard metrics work, why "Active Today" is broken, and how to fix it |

**Key Topics:**
- Cookie-based authentication pattern (server-side)
- Creating new admin pages following established patterns
- API route protection with `withAdminAuth` middleware
- Common UI components and styling patterns
- Security best practices for admin features
- ESLint rules to prevent auth pattern violations
- 'server-only' guards to prevent client-side admin imports
- Error boundaries for graceful error handling
- React version verification (CVE-2025-55182 patched)

**Essential Reading for:**
- ✅ New developers creating admin features
- ✅ Anyone working on admin pages
- ✅ Debugging authentication issues in admin routes

---

### Textbook Vocabulary (`textbook-vocabulary/`)

| Document | Description |
|----------|-------------|
| [README.md](./textbook-vocabulary/README.md) | Feature overview, architecture, and quick start guide |
| [FEATURE_GUIDE.md](./textbook-vocabulary/FEATURE_GUIDE.md) | Complete implementation guide with code examples |
| [DATA_PIPELINE_GUIDE.md](./textbook-vocabulary/DATA_PIPELINE_GUIDE.md) | Anki deck conversion and data creation process |
| [TROUBLESHOOTING.md](./textbook-vocabulary/TROUBLESHOOTING.md) | Common issues, debugging, and solutions |

**Key Topics:**
- 17,761 vocabulary items from 10 textbooks (Genki, Minna, Dekiru, etc.)
- Three modes: Browse, Study (flashcards), Review (SRS)
- URE integration with smart distractor generation (6-strategy approach)
- Offline-first progress tracking (IndexedDB + Firebase sync)
- Anki deck to JSON conversion pipeline
- Entitlements system (3 lessons/day free, unlimited premium)
- TTS audio preloading and playback
- Performance optimization for large datasets (9K+ items)

**Key Files:**
- `src/app/[locale]/textbook-vocabulary/TextbookVocabularyPage.tsx:52` - Main orchestrator
- `src/lib/review-engine/adapters/TextbookVocabularyAdapter.ts:70` - URE adapter
- `src/utils/textbookVocabularyProgressManager.ts:19` - Progress tracking
- `scripts/anki-deck-to-json.mjs` - Data conversion tool
- `src/data/textbooks/index.json` - Textbook registry

**Essential Reading for:**
- ✅ Adding new textbooks to the platform
- ✅ Understanding vocabulary learning workflows
- ✅ Integrating with Universal Review Engine
- ✅ Debugging progress tracking issues

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

### Learning Village Low Power Mode (`learning-village-low-power/`)

| Document | Description |
|----------|-------------|
| [README.md](./learning-village-low-power/README.md) | Feature overview, architecture, and quick start guide |
| [IMPLEMENTATION_GUIDE.md](./learning-village-low-power/IMPLEMENTATION_GUIDE.md) | Detailed implementation patterns, code examples, and testing guidelines |

**Key Topics:**
- GPU load reduction for Learning Village animations
- Conditional rendering and CSS effect removal
- AnimationControl toggle and useAnimationControl hook
- Low Power Mode badge and visual indicators
- Performance monitoring with PerfDebugPanel
- Framer Motion MotionConfig integration
- Browser compatibility and graceful degradation

**Effects Disabled in Low Power Mode:**
- Backdrop blur and shadow effects
- Floating lanterns and twinkling lights
- Animated Doshi mascot (switches to static)
- Drop shadows and filter effects
- Gradient text animations
- Night sky stars

**Key Files:**
- `src/components/ui/AnimationControl.tsx:244-267` - useAnimationControl hook
- `src/components/dashboard/LearningVillage.tsx:506` - Low power flag derivation
- `src/components/debug/PerfDebugPanel.tsx:35-199` - Performance monitoring

**Implementation Date:** 2026-01-28 (Commit: f81f7012)

---

### Theming System (`theming/`)

| Document | Description |
|----------|-------------|
| [README.md](./theming/README.md) | Theme system overview and quick start guide |
| [THEME_GUIDE.md](./theming/THEME_GUIDE.md) | Complete implementation guide for new pages and components |

**Key Topics:**
- 10 dynamic color palettes (Sakura, Ocean, Matcha, etc.)
- Tailwind CSS v4 with @theme directive
- SSR-safe hydration (zero FOUC)
- Dark mode implementation patterns
- Japanese typography and aesthetic colors
- Accessibility features (large text, high contrast, reduce motion)
- Component theming patterns and best practices
- Tiered storage (Guest/Free/Premium preferences)

**Key Files:**
- `src/styles/globals.css:136-230` - Theme variables and semantic tokens
- `src/styles/palettes.css:1-230` - 10 color palette definitions
- `src/lib/theme/ThemeContext.tsx` - React theme state management
- `src/lib/theme/theme-script.ts` - SSR hydration script
- `src/utils/preferencesManager.ts` - User preference storage

**Essential Reading for:**
- ✅ Developers creating new pages or components
- ✅ Anyone working with colors, typography, or styling
- ✅ Understanding dark mode implementation
- ✅ Implementing accessible UI features

---

### User Agent Tracking (`user-agent-tracking/`)

| Document | Description |
|----------|-------------|
| [README.md](./user-agent-tracking/README.md) | Comprehensive user agent tracking for support forms |

**Key Topics:**
- useUserAgent React hook for capturing browser/device info
- Automatic technical details in support emails
- 10 data points captured (browser, OS, device, screen, timezone, language)
- Integration with Contact form and Feedback widget
- Privacy policy compliance (all 6 languages)
- Option B formatting (detailed technical section)

**Data Captured:**
- Browser name and version
- Operating system and version
- Device type (Desktop/Mobile/Tablet)
- Screen resolution and viewport size
- Timezone and language
- Full user agent string

**Key Files:**
- `src/hooks/useUserAgent.ts` - Main hook and email formatting
- `src/app/[locale]/contact/ContactPage.tsx:16,113` - Contact form integration
- `src/components/support/FeedbackWidget.tsx:11,26` - Feedback widget integration
- `src/app/api/contact/route.ts:3-4,8,52` - Contact API email template
- `src/app/api/support/feedback/route.ts` - Feedback API (new)

**Dependencies:**
- ua-parser-js - User agent string parsing library

**Implementation Date:** 2026-01-29 (Commit: pending)

---

### Entertainment System (`entertainment-system/`)

| Document | Description |
|----------|-------------|
| [README.md](./entertainment-system/README.md) | Entertainment System overview, architecture, and quick start |
| [FEATURE_GUIDE.md](./entertainment-system/FEATURE_GUIDE.md) | Complete implementation guide with code examples |
| [TROUBLESHOOTING.md](./entertainment-system/TROUBLESHOOTING.md) | Common issues, debugging, and solutions |

**Key Topics:**
- Games system (8 interactive learning games)
- Review Hub (SRS review dashboard with analytics)
- Achievements system (progress-based rewards)
- Leaderboard (competitive ranking with privacy controls)
- Gamification core (XP calculation, streak management)
- Universal Review Engine integration
- Feature flag system
- Learning Village integration
- Command Palette shortcuts

**Core Components:**

**Games:**
- Kanji Simon - Memory pattern matching game
- Kanji Quest - Pokemon-style kanji battles
- Kana Drop - Falling kana arcade game
- Reading Routes - Kanji reading navigation
- Stroke Order Practice - Drawing canvas for kanji
- Matching Game - Memory card matching
- Sentence Scramble - Grammar reconstruction
- Word Assembly - Build kana from audio

**Gamification:**
- XP calculation with accuracy and speed bonuses
- Streak tracking with 24-hour grace period
- Achievement engine with condition evaluation
- Level progression system (1-50 levels)
- Completion ledger to prevent duplicate XP
- Optimistic updates with rollback support

**Leaderboard:**
- Redis caching (5-minute TTL)
- Firestore snapshots for persistence
- Privacy opt-out controls
- Paginated API (20-100 entries per page)
- Top 100 player tracking
- Subscription tier display

**Key Files:**
- `src/app/[locale]/games/page.tsx:18` - Games directory with feature flag
- `src/lib/gamification/services/gamification-coordinator.ts:1` - Server-side entry point
- `src/state/userGamification.ts:1` - Zustand store for client state
- `src/config/gamification/achievements.json:1` - Achievement definitions
- `src/app/api/leaderboard/route.ts:1` - Leaderboard API
- `src/components/dashboard/LearningVillage.tsx:1455` - Entertainment District config
- `src/lib/features/featureFlags.ts:35` - Feature flag system

**Essential Reading for:**
- ✅ Adding new learning games
- ✅ Implementing XP rewards for activities
- ✅ Creating new achievements
- ✅ Customizing leaderboard display
- ✅ Integrating gamification into new features
- ✅ Troubleshooting XP/achievement issues

**Implementation Date:** 2026-02-01

---

### User Analytics (`user-analytics/`)

| Document | Description |
|----------|-------------|
| [README.md](./user-analytics/README.md) | Overview, quick start, and key findings |
| [SCRIPTS_REFERENCE.md](./user-analytics/SCRIPTS_REFERENCE.md) | Detailed guide for each analytics script |

**Key Topics:**
- User signup analysis by date
- Day-1 retention metrics
- Multi-day return frequency analysis
- Cohort-based retention breakdown
- Premium subscriber tracking
- Post-launch analytics (Jan 23, 2026)

**Available Scripts:**
- `check-new-users-by-date.js` - Find users by signup date
- `check-returning-users.js` - Analyze return rates for cohorts
- `check-launch-retention.js` - Comprehensive post-launch retention
- `check-user-return-frequency.js` - Unique days visited per user

**Key Metrics:**
- Day-1 Retention: ~18-19%
- Multi-day Users: 8.2%
- Total signups since launch: 636

**Key Files:**
- `scripts/check-new-users-by-date.js` - Query users by date
- `scripts/check-returning-users.js` - Return analysis
- `scripts/check-launch-retention.js` - Full retention report
- `scripts/check-user-return-frequency.js` - Visit frequency analysis
- `moshimoshi-service-account.json` - Firebase credentials (required)

**Essential Reading for:**
- ✅ Understanding user retention and engagement
- ✅ Running cohort analysis
- ✅ Tracking premium conversion
- ✅ Measuring launch success

**Implementation Date:** 2026-02-01

---

### Internationalization (`i18n/`)

| Document | Description |
|----------|-------------|
| [README.md](./i18n/README.md) | i18n overview, quick start, and architecture |
| [FEATURE_GUIDE.md](./i18n/FEATURE_GUIDE.md) | Complete implementation guide with all patterns |

**Key Topics:**
- 6 languages supported (EN, JA, DE, ES, FR, IT)
- Hybrid custom TypeScript + next-intl system
- Path-based locale routing (`/{locale}/{page}`)
- Client-side hooks (`useI18n`, `useTranslation`, `useLocalePath`)
- Server-side utilities (`getTranslations`)
- Parameter interpolation with `{{paramName}}` syntax
- Automatic fallback to English for missing keys
- Cookie-based language persistence (`NEXT_LOCALE`)
- 57 translation namespaces

**Key Files:**
- `src/i18n/config.ts:8-10` - Language type definitions
- `src/i18n/I18nContext.tsx:1` - React context & hooks
- `src/i18n/routing.ts:35-57` - next-intl routing config
- `src/i18n/server.ts:38-58` - Server-side utilities
- `src/middleware.ts:46-52` - Locale extraction & routing
- `src/i18n/locales/en/strings.ts` - English translations (7,817 lines)

**Essential Reading for:**
- ✅ Adding new translation keys
- ✅ Creating locale-aware components
- ✅ Implementing server-side translations
- ✅ Adding support for new languages

**Implementation Date:** 2026-02-03

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

## Documentation Organization Rules

### MANDATORY: Feature Subfolder Structure

**Every new feature documentation MUST follow this structure:**

```
02-PRODUCTION_DOCS/
└── feature-name/              # ✅ Feature-named subfolder (kebab-case)
    ├── README.md             # ✅ REQUIRED: Feature overview and index
    ├── FEATURE_GUIDE.md      # Feature-specific documentation
    ├── API_REFERENCE.md      # API endpoints and usage
    └── TROUBLESHOOTING.md    # Common issues and solutions
```

### Feature README Requirements

Each feature subfolder **MUST include a README.md** with:

1. **Feature Overview** - What the feature does and its purpose
2. **Quick Start** - Getting started in <5 minutes
3. **Architecture** - System design and key components
4. **Document Index** - Links to all documentation in this folder
5. **Related Files** - Links to key source code files with line numbers
6. **Last Updated** - Date of last major update

**Example:**
```markdown
# Feature Name

**Status:** ACTIVE
**Last Updated:** 2026-01-28

## Overview
Brief description of what this feature does.

## Quick Start
1. Step one
2. Step two

## Documentation
- [FEATURE_GUIDE.md](./FEATURE_GUIDE.md) - Complete implementation guide
- [API_REFERENCE.md](./API_REFERENCE.md) - API endpoints

## Key Files
- `src/components/Feature.tsx:123` - Main component
- `src/lib/feature/service.ts:45` - Core logic
```

---

## Contributing New Documentation

### Step 1: Create Feature Subfolder

```bash
# Create feature folder with kebab-case naming
mkdir -p 02-PRODUCTION_DOCS/feature-name

# Create required README
touch 02-PRODUCTION_DOCS/feature-name/README.md
```

### Step 2: Write Feature Documentation

1. **Create the feature README first** - This is your index/overview
2. **Add specific documentation** - Implementation guides, API references, etc.
3. **Use uppercase with underscores** for non-README files: `FEATURE_GUIDE.md`
4. **Include status and date** at the top of each document

### Step 3: Update This README

Add your feature to the appropriate section in **this README** (`02-PRODUCTION_DOCS/README.md`):

```markdown
### Feature Name (`feature-name/`)

| Document | Description |
|----------|-------------|
| [README.md](./feature-name/README.md) | Feature overview and quick start |
| [FEATURE_GUIDE.md](./feature-name/FEATURE_GUIDE.md) | Detailed implementation guide |

**Key Topics:**
- Topic 1
- Topic 2
```

### Step 4: Update Main Project README

**CRITICAL:** Update the main project README at the repository root:

```bash
# Edit /home/beano/DevProjects/NextJs/moshimoshi/README.md
```

Add a link to your new feature documentation in the appropriate section:
- Update the feature list
- Link to `02-PRODUCTION_DOCS/feature-name/README.md`
- Briefly describe what the feature does

### Checklist for New Documentation

- [ ] Created feature subfolder with kebab-case name
- [ ] Created feature README.md with required sections
- [ ] Added all feature documentation to the subfolder
- [ ] Updated this README (`02-PRODUCTION_DOCS/README.md`)
- [ ] Updated main project README at repository root
- [ ] Verified all internal links work
- [ ] Included code references with line numbers where applicable

---

## Naming Conventions

| Item | Convention | Example |
|------|------------|---------|
| Feature folder | kebab-case | `kanji-mastery/` |
| Feature README | README.md | `README.md` |
| Documentation files | SCREAMING_SNAKE_CASE | `API_REFERENCE.md` |
| Bug reports | Date prefix | `2025-01-27_BUG_NAME.md` |

---

*Last Updated: 2026-02-03*

