# Moshimoshi Production Documentation

**Last Updated**: 2025-12-18
**Project**: Moshimoshi Japanese Learning Platform
**Purpose**: Centralized technical documentation for production systems

---

## 📚 Documentation Structure

This documentation is organized into 5 main categories for easy navigation:

### 1. 🏗️ [URE Architecture](./1-URE-Architecture/)
**Universal Review Engine - Core Learning System**

Architecture, migration plans, and XP/gamification system documentation.

| Document | Purpose | Status |
|----------|---------|--------|
| [URE Architecture & Migration Plan](./1-URE-Architecture/URE_ARCHITECTURE_AND_MIGRATION_PLAN.md) | Complete architecture overview and migration roadmap | Phase 2 Complete |
| [URE XP Extension Guide](./1-URE-Architecture/URE_XP_EXTENSION_GUIDE.md) | XP system implementation and extension guide | Live |
| [XP Activities](./1-URE-Architecture/XP_ACTIVITIES.md) | XP earning activities and gamification mechanics | Live |
| [News URE Integration](./1-URE-Architecture/NEWS_URE.md) | News feature URE adapter implementation | Live |

**Phase 2 Migration Documents:**
- [Agent Prompt](./1-URE-Architecture/PHASE_2_AGENT_PROMPT.md) - Migration instructions for Phase 2
- [Cleanup Agent Prompt](./1-URE-Architecture/PHASE_2_CLEANUP_AGENT_PROMPT.md) - Technical debt cleanup instructions
- [Cleanup Completion Report](./1-URE-Architecture/PHASE_2_CLEANUP_COMPLETION_REPORT.md) - Final cleanup status
- [Final Verification](./1-URE-Architecture/PHASE_2_FINAL_VERIFICATION.md) - Production readiness verification
- [Progress Summary](./1-URE-Architecture/PHASE_2_PROGRESS_SUMMARY.md) - Migration progress tracking
- [Verification Checklist](./1-URE-Architecture/PHASE_2_VERIFICATION_CHECKLIST.md) - QA checklist
- [Verification Report](./1-URE-Architecture/PHASE_2_VERIFICATION_REPORT.md) - Verification results

**Critical Issue Resolution Documents:**
- [URE Current State](./1-URE-Architecture/URE_CURRENT_STATE.md) - Current migration status and blockers
- [Critical Issue & Resolution](./1-URE-Architecture/CRITICAL_ISSUE_AND_RESOLUTION.md) - Critical bug discovered during testing
- [Study Mode XP Restoration](./1-URE-Architecture/STUDY_MODE_XP_RESTORATION.md) - Product requirement restoration
- [Product Requirements vs Architecture](./1-URE-Architecture/PRODUCT_REQUIREMENTS_VS_ARCHITECTURE.md) - Lessons learned and principles

---

### 2. 💳 [Payment & Monetization](./2-Payment-Monetization/)
**Stripe Integration, Subscriptions, and Pre-Launch Campaign**

Payment processing, subscription management, entitlements, and pre-launch waitlist system.

| Document | Purpose | Status |
|----------|---------|--------|
| [Stripe Architecture Expert Report](./2-Payment-Monetization/STRIPE_ARCHITECTURE_EXPERT_REPORT.md) | Complete Stripe integration analysis and best practices | Live |
| [Stripe Integration Overview](./2-Payment-Monetization/STRIPE_STRIPE_INTEGRATION_OVERVIEW.md) | High-level integration guide | Live |
| [Entitlement Gate](./2-Payment-Monetization/ENTITLEMENTGATE.md) | Feature access control and premium gating | Live |
| [Pre-Launch Waitlist Implementation](./2-Payment-Monetization/PRELAUNCH_WAITLIST_IMPLEMENTATION.md) | Waitlist system with 25% discount auto-apply | Production Ready |
| [Pre-Launch Lock](./2-Payment-Monetization/PRELAUNCH_LOCK.md) | App lock mechanism until launch date | Active |

**Key Systems:**
- Stripe Checkout Sessions with automatic discount application
- Webhook event handling (Cloud Functions)
- Subscription lifecycle management
- Waitlist → User → Discount eligibility pipeline
- Pre-launch lock with environment toggle

---

### 3. 🎯 [Features](./3-Features/)
**Feature Implementation Documentation**

Individual feature implementations, technical specifications, and integration guides.

| Document | Purpose | Status |
|----------|---------|--------|
| [Anki Study Implementation](./3-Features/ANKI_STUDY_IMPLEMENTATION.md) | Anki flashcard system with SRS integration | Live |
| [Dashboard Stats](./3-Features/DASHBOARD_STATS.md) | Dashboard statistics and analytics system | Live |
| [Sentence Pre-Generation](./3-Features/SENTENCE_PREGENERATION.md) | AI sentence generation and caching | Live |
| [Word Explanation Extension](./3-Features/WORD_EXPLANATION_EXTENSION.md) | Word explanation system architecture | Live |
| [Word Explanation Fast Path](./3-Features/WORD_EXPLANATION_FAST_PATH.md) | Performance optimization for word lookups | Live |

**Feature Categories:**
- **Learning Tools**: Anki study, sentence generation
- **Analytics**: Dashboard stats, performance metrics
- **Content Systems**: Word explanations, AI-generated content

---

### 4. ⚙️ [Infrastructure](./4-Infrastructure/)
**System Architecture, DevOps, and Platform Services**

Core infrastructure, internationalization, SEO, and operational systems.

| Document | Purpose | Status |
|----------|---------|--------|
| [i18n/Locale System](./4-Infrastructure/I18N_LOCALE_SYSTEM.md) | Internationalization system (6 locales) | Live |
| [Multilanguage SEO Report](./4-Infrastructure/MULTILANGUAGE_SEO_REPORT.md) | SEO implementation for 6 languages | Live |
| [Email Alerts for Functions](./4-Infrastructure/EMAIL_ALERTS_FOR_FUNCTIONS.md) | Cloud Functions monitoring and alerting | Live |

**Key Infrastructure:**
- **i18n**: next-intl v4.5.8 with custom translation layer
- **SEO**: Dynamic sitemaps, hreflang tags, locale-aware metadata
- **Monitoring**: Email alerts for Cloud Functions errors
- **Supported Locales**: en, ja, de, es, fr, it

---

### 5. ✅ [Quality Assurance](./5-Quality-Assurance/)
**Testing, Technical Debt, and Quality Control**

Testing strategies, QA processes, technical debt tracking, and verification procedures.

| Document | Purpose | Status |
|----------|---------|--------|
| [Manual Testing Guide](./5-Quality-Assurance/MANUAL_TESTING_GUIDE.md) | Comprehensive manual testing procedures | Active |
| [Testing Summary](./5-Quality-Assurance/TESTING_SUMMARY.md) | Automated test coverage and results | 80%+ Coverage |
| [Technical Debt Audit](./5-Quality-Assurance/TECHNICAL_DEBT_AUDIT.md) | Technical debt tracking and resolution | Resolved |

**Quality Metrics:**
- **Test Coverage**: 80%+ overall, 90%+ core modules
- **URE Tests**: 74 tests covering EventEmitter, SessionManager, Integration
- **Manual Testing**: Required for all URE migrations before production

---

## 🚀 Quick Reference

### Current Production Status
- **URE Phase 2**: ✅ Complete (all 6 features migrated)
- **Pre-Launch Lock**: 🟢 Active (until 2026-01-16)
- **Stripe Integration**: 🟢 Live with waitlist discount
- **Test Coverage**: ✅ 80%+ (74 URE tests)
- **Technical Debt**: ✅ Resolved

### Recent Major Updates
- **2025-12-18**: Phase 2 URE migration complete, all features migrated to ReviewSessionUI
- **2025-12-18**: Blog route unlocked for pre-launch access
- **2025-12-15**: Pre-launch waitlist system tested and verified in production
- **2025-12-14**: Stripe architecture documented with expert analysis

### Critical Systems
1. **Universal Review Engine (URE)**: Core learning/review system
2. **Stripe Integration**: Payments, subscriptions, webhooks
3. **Pre-Launch Campaign**: Waitlist → Discount → Checkout pipeline
4. **i18n System**: 6-language support with SEO optimization

---

## 📖 Documentation Guidelines

### When to Add New Documentation
- New feature implementations (>500 lines of code)
- Architecture changes affecting multiple modules
- Payment/monetization system changes
- Infrastructure updates (i18n, SEO, monitoring)
- Migration plans for major refactors

### Documentation Format
- Use clear headings and table of contents
- Include status badges (✅ Complete, 🟡 In Progress, 🔴 Pending)
- Add file references with line numbers
- Include test coverage information
- Document architectural decisions and rationale

### Folder Assignment
- **1-URE-Architecture**: URE core, adapters, session management, XP/gamification
- **2-Payment-Monetization**: Stripe, subscriptions, entitlements, pre-launch
- **3-Features**: Individual feature implementations and specs
- **4-Infrastructure**: System architecture, i18n, SEO, monitoring
- **5-Quality-Assurance**: Testing, QA, technical debt, verification

---

## 🔗 External Resources

- **Project Repository**: https://github.com/HelyeFab/moshimoshi
- **Production URL**: https://moshimoshi.vercel.app
- **Stripe Dashboard**: https://dashboard.stripe.com
- **Firebase Console**: https://console.firebase.google.com

---

## 📝 Document Maintenance

**Update Frequency**: Documents should be updated when:
- Feature implementations are completed
- Architecture changes are made
- Migration phases are completed
- Technical debt is resolved
- Production incidents occur

**Owner**: Development Team
**Review Cycle**: Monthly for active documents, quarterly for stable systems

---

*For questions or suggestions about this documentation structure, contact the development team.*
