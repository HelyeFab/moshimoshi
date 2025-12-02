# TypeScript Error Files

**Generated:** 2025-11-30
**Last Updated:** 2025-12-01
**Total Errors:** ~1759 (excluding test files and .next/types generated)
**Total Files with Errors:** ~310 (excluding test files)

This document lists all files that would produce TypeScript errors if `ignoreBuildErrors` is set to `false` in `next.config.ts`.

> **IMPORTANT FOR AI AGENTS:** After fixing errors in any file, you MUST update this document:
> 1. Move the file to the "Fixed Files" section below with the date
> 2. Update the counts in the Summary table
> 3. This prevents future agents from duplicating work

---

## Fixed Files

*Files that have been fixed and verified. Do not work on these.*

| File | Fixed Date | Notes |
|------|------------|-------|
| `src/app/api/admin/stripe/cleanup/route.ts` | 2025-11-30 | Added null check for invoice.id |
| `src/app/api/admin/stripe/test-renewal/route.ts` | 2025-11-30 | Added null check for invoice.id |
| `src/app/api/stripe/create-checkout-session/route.ts` | 2025-11-30 | Fixed getSession() call (no args) |
| `src/app/api/stripe/donate/route.ts` | 2025-11-30 | Fixed getSession() call (no args) |
| `src/lib/admin/adminAuth.ts` | 2025-11-30 | Added params support to withAdminAuth, null check |
| `src/app/api/admin/users/[uid]/route.ts` | 2025-11-30 | Updated to AdminContext, added null checks |
| `src/app/api/admin/users/route.ts` | 2025-11-30 | Added FirestoreUserData interface, null checks |
| `src/app/api/auth/invalidate-all-caches/route.ts` | 2025-11-30 | Added adminDb null check |
| `src/app/api/auth/invalidate-tier-cache/route.ts` | 2025-11-30 | Added adminDb null check |
| `src/app/api/auth/refresh-session/route.ts` | 2025-11-30 | Added adminDb null check |
| `src/app/api/auth/session-check/route.ts` | 2025-11-30 | Added adminDb null check |
| `src/app/api/auth/google/route.ts` | 2025-11-30 | Imported FieldValue correctly |
| `src/app/api/auth/signin/route.ts` | 2025-11-30 | Added recaptchaScore to type |
| `src/lib/auth/audit.ts` | 2025-11-30 | Added recaptchaScore to logAuthAttempt type |
| `src/lib/notifications/push/FCMManager.ts` | 2025-11-30 | Added app/db null checks, extended NotificationOptions |
| `src/lib/notifications/push/PushNotificationService.ts` | 2025-11-30 | Added db null checks throughout |
| `src/app/blog/sitemap.ts` | 2025-11-30 | Added adminDb null check with fallback |
| `src/app/api/sessions/save/route.ts` | 2025-11-30 | Added adminDb null check |
| `src/app/api/newsletter/subscribe/route.ts` | 2025-11-30 | Added adminDb null check |
| `src/app/api/leaderboard/route.ts` | 2025-11-30 | Added adminDb null check |
| `src/app/api/blog/[id]/route.ts` | 2025-11-30 | Added adminDb null check |
| `src/app/api/blog/debug/route.ts` | 2025-11-30 | Added adminDb null check |
| `src/app/api/blog/slug/[slug]/route.ts` | 2025-11-30 | Added adminDb null check |
| `src/app/api/youtube/series/route.ts` | 2025-11-30 | Added adminDb null check |
| `src/app/api/drill/session/route.ts` | 2025-11-30 | Added adminDb null check |
| `src/app/api/gamification/load/route.ts` | 2025-11-30 | Added adminDb null check |
| `src/app/api/kanji/progress/route.ts` | 2025-11-30 | Added adminDb null check |
| `src/app/api/leaderboard/user-rank/route.ts` | 2025-11-30 | Added adminDb null check |
| `src/app/api/newsletter/verify/route.ts` | 2025-11-30 | Added adminDb null check |
| `src/app/api/resources/public/route.ts` | 2025-11-30 | Added adminDb null check |
| `src/app/api/resources/related/route.ts` | 2025-11-30 | Added adminDb null check |
| `src/lib/api/storage-helper.ts` | 2025-11-30 | Added adminDb null check |
| `src/lib/monitoring/firebase-tracker.ts` | 2025-11-30 | Added adminDb null check |
| `src/app/api/admin/backup/status/route.ts` | 2025-11-30 | Added adminDb null check, BackupHistoryRecord interface, Long type handling |
| `src/app/api/admin/backup/trigger/route.ts` | 2025-11-30 | Added adminDb null check |
| `src/app/api/admin/backup/list/route.ts` | 2025-11-30 | Added adminDb null check, BackupListItem interface |
| `src/app/api/admin/backup/check-status/route.ts` | 2025-11-30 | Added adminDb null check, BackupRecord type, GetOperationRequest type assertion |
| `src/types/admin.ts` | 2025-11-30 | Added BackupRecord, BackupListItem, BackupStatus, BackupType types |
| `src/lib/notifications/push/ServiceWorkerManager.ts` | 2025-11-30 | Captured controller reference for TypeScript narrowing in callback |
| `src/lib/notifications/utils/TimerManager.ts` | 2025-11-30 | Renamed isDestroyed property to _isDestroyed (duplicate identifier) |
| `src/lib/notifications/utils/sanitizer.ts` | 2025-11-30 | Added explicit types to forEach callback parameters |
| `src/lib/notifications/utils/RateLimiter.ts` | 2025-11-30 | Split merge vs create logic in updateConfig |
| `src/lib/notifications/orchestrator/NotificationOrchestrator.ts` | 2025-11-30 | Handle Date | Timestamp union for scheduled_for |
| `src/lib/notifications/browser/BrowserNotificationService.ts` | 2025-11-30 | Extended NotificationOptions type, added db null checks |
| `src/lib/notifications/notification-service.ts` | 2025-11-30 | Use path.join('/') for doc() call |
| `src/lib/notifications/preferences/PreferenceManager.ts` | 2025-11-30 | Added db null checks throughout |
| `src/lib/notifications/orchestrator/NotificationQueue.ts` | 2025-11-30 | Added db null checks throughout |
| `src/app/api/admin/blog/route.ts` | 2025-11-30 | Fixed checkAdminAuth usage, added adminDb null check |
| `src/app/api/admin/feature-flags/route.ts` | 2025-11-30 | Added adminAuth/adminDb null checks |
| `src/app/api/admin/resources/[id]/route.ts` | 2025-11-30 | Added adminDb null checks to GET, PUT, DELETE handlers |
| `src/app/api/admin/resources/route.ts` | 2025-11-30 | Added adminDb null checks to GET, POST handlers |
| `src/app/api/admin/resources/analytics/route.ts` | 2025-11-30 | Added adminDb null check |
| `src/app/api/admin/resources/stats/route.ts` | 2025-11-30 | Added adminDb null check |
| `src/app/api/admin/leaderboard/trigger/route.ts` | 2025-11-30 | Added adminAuth/adminDb null checks |
| `src/app/api/admin/init/route.ts` | 2025-11-30 | Fixed FieldValue import |
| `src/app/api/admin/logs/route.ts` | 2025-11-30 | Fixed imports, Query typing, adminDb null check |
| `src/app/api/admin/stats/route.ts` | 2025-11-30 | Added adminFirestore null check, typed recentUsers array |
| `src/app/api/admin/streak-config/route.ts` | 2025-11-30 | Added adminFirestore null check, fixed ZodError .errors to .issues |
| `src/app/api/admin/monitoring/firebase-usage/route.ts` | 2025-11-30 | Added adminDb null checks |
| `src/app/api/admin/monitoring/quota/route.ts` | 2025-11-30 | Added adminDb null check |
| `src/app/api/admin/scraping-logs/route.ts` | 2025-11-30 | Added adminDb null checks |
| `src/app/api/admin/scraping-progress/route.ts` | 2025-11-30 | Added adminDb null checks |
| `src/app/api/admin/news/trigger-scraping/route.ts` | 2025-11-30 | Fixed auth -> adminAuth, added null checks |
| `src/app/api/admin/decision-logs/route.ts` | 2025-11-30 | Added adminAuth import, fixed verifyIdToken call |
| `src/app/api/admin/generate-moodboard/route.ts` | 2025-11-30 | Fixed checkAdminRole call (pass request not authHeader) |
| `src/app/api/admin/evaluate/route.ts` | 2025-11-30 | Build proper EvalContext with user data |
| `src/app/api/admin/override/route.ts` | 2025-11-30 | Fixed setOverride call with required fields |
| `src/types/entitlements.ts` | 2025-11-30 | Added FeatureOverride, OverrideLog interfaces, EvalContext extensions |
| `src/app/api/admin/generate-audio/route.ts` | 2025-12-01 | Fixed checkAdminRole(request), authResult.uid |
| `src/app/api/admin/generate-image/route.ts` | 2025-12-01 | Fixed checkAdminRole, optional chaining for OpenAI response |
| `src/app/api/admin/generate-story/route.ts` | 2025-12-01 | Fixed checkAdminRole, authResult.uid, import path ai-story |
| `src/app/api/admin/youtube-series/sync/route.ts` | 2025-12-01 | Added adminDb and channelData null checks |
| `src/app/api/admin/subscriptions/upgrade/route.ts` | 2025-12-01 | Added adminFirestore null checks, typed subscription, cast current_period_end |
| `src/app/api/admin/scripts/run/route.ts` | 2025-12-01 | Renamed process → childProcess (variable shadowing) |
| `src/app/api/admin/set-admin/route.ts` | 2025-12-01 | Added adminDb null check, wrapped setAdminClaim in try/catch |
| `src/app/api/admin/stats-consistency/route.ts` | 2025-12-01 | Added adminDb null check |
| `src/lib/ai/types.ts` | 2025-12-01 | Added index signature to RequestMetadata for task-specific fields |
| `src/i18n/I18nContext.tsx` | 2025-12-01 | Updated t() signature to accept string fallbacks (fixes 38+ errors across codebase) |
| `src/components/ui/Tabs.tsx` | 2025-12-01 | Made children prop optional, fixed React.ReactElement typing |
| `src/app/review-dashboard/ReviewDashboard.tsx` | 2025-12-01 | Fixed by upstream t() and Tabs changes (39 errors resolved) |
| `src/app/api/notifications/preferences/route.ts` | 2025-12-01 | Fixed user.id→uid, added adminDb null checks, typed vibration map param (16 errors) |
| `src/app/api/notifications/pending/route.ts` | 2025-12-01 | Fixed user.id→uid, added adminDb null checks (12 errors) |
| `src/app/api/notifications/send-push/route.ts` | 2025-12-01 | Fixed user scope in catch, user.id→uid, adminDb null checks (11 errors) |
| `src/app/api/practice/track/route.ts` | 2025-12-01 | Typed error as Error, added PracticeVideo interface (7 errors) |
| `src/lib/review-engine/adapters/MoodBoardAdapter.ts` | 2025-12-01 | Aligned with BaseContentAdapter interface, removed non-existent imports, added missing abstract methods, fixed readings optional access (33 errors) |
| `src/components/dashboard/LearningVillage.tsx` | 2025-12-01 | Fixed ChineseLantern size prop typing, used CardStrings type helper for i18n dynamic key access (31 errors) |
| `src/lib/review-engine/adapters/KanjiBrowserAdapter.ts` | 2025-12-01 | Fixed ReviewMode import, added optional kanji/jlpt/meaning fields to KanjiContent, added constructor with config (19 errors) |
| `src/app/api/flashcards/decks/route.ts` | 2025-12-01 | Added adminDb null checks, cast initialCards to any[] for flexible card formats (19 errors) |
| `src/lib/services/StoryService.ts` | 2025-12-01 | Fixed import path ai-story, added getDb() helper for null-safe Firestore access (24 errors) |
| `src/i18n/locales/en/strings.ts` | 2025-12-01 | Fixed TS1117 duplicate property keys - merged dashboard, kana, settings, flashcards sections (30 errors) |
| `src/i18n/locales/fr/strings.ts` | 2025-12-01 | Fixed TS1117 duplicate property keys - merged dashboard, kana, settings, shadowing sections (23 errors) |
| `src/i18n/locales/es/strings.ts` | 2025-12-01 | Fixed TS1117 duplicate property keys - merged landing, kana, flashcards, pwa sections (19 errors) |
| `src/i18n/locales/ja/strings.ts` | 2025-12-01 | Fixed TS1117 duplicate property keys - merged landing, flashcards, checkout, pwa sections (15 errors) |
| `src/i18n/locales/de/strings.ts` | 2025-12-01 | Fixed TS1117 duplicate property keys - merged landing, kana (3→1), settings, pwa sections (8 errors) |
| `src/i18n/locales/it/strings.ts` | 2025-12-01 | Fixed TS1117 duplicate property keys - merged landing, flashcards, checkout, settings sections (6 errors) |
| `src/utils/preferencesManager.ts` | 2025-12-01 | Changed User type to MinimalUser interface - accepts both Firebase User and AuthUser (3 errors) |
| `src/app/settings/page.tsx` | 2025-12-01 | Fixed isPremium undefined with ?? false, fixed strings.settings access (49 errors) |
| `src/i18n/locales/en/strings.ts` | 2025-12-01 | Added top-level settings section for Settings page translations (~46 errors across codebase) |
| `src/i18n/I18nContext.tsx` | 2025-12-01 | Changed strings type from union to TranslationKeys, added type assertion (fixes ~300 errors from union type) |
| `src/components/landing/PricingComparison.tsx` | 2025-12-01 | Added type assertions for nested i18n objects with NonNullable (62 errors) |
| `src/app/vocabulary/page.tsx` | 2025-12-01 | Fixed isPremium ?? false, replaced strings.reviewPrompts with fallbacks, fixed word.kanji\|\|word.kana (25 errors) |
| `src/app/dashboard/page.tsx` | 2025-12-01 | Simplified stats i18n, fixed case statements (16 errors fixed, 2 streak-related errors LEFT PENDING - requires careful review) |
| `src/app/api/gamification/streak/save/route.ts` | 2025-12-01 | Fixed db null narrowing in transaction callback using local const |
| `src/components/gamification/StreakSaveModal.tsx` | 2025-12-01 | Fixed LoadingButton prop: loading → isLoading |
| `src/hooks/useGamification.ts` | 2025-12-01 | Fixed GamificationData interface: lastActivityDate Date → string (ISO format) |
| `src/hooks/__tests__/useStreakSaveDetection.test.tsx` | 2025-12-01 | Fixed 18+ mock return values to match StreakValidationResult interface (isActive→removed, status→removed, statusMessage→reason, added effectiveStreak, isWithinGracePeriod) |
| `src/lib/conjugation/wordTypeDetector.ts` | 2025-12-02 | Changed import WordType from drill.ts (includes verb classifications), added GodanEndingPattern interface, fixed VERB_ENDING_PATTERNS typing, changed fallback 'verb' to 'other' (14 errors) |
| `src/lib/review-engine/progress/UniversalProgressManager.ts` | 2025-12-02 | Changed Date objects to ISO strings (.toISOString()), fixed generic T type assertions for ReviewProgressData, fixed duration calculation with ISO string parsing, removed .toISOString() calls on already-ISO strings (16 errors) |
| `src/utils/kanaProgressManagerV2.ts` | 2025-12-02 | Fixed Date/string conversions for ISO strings, renamed saveProgress→saveLegacyProgress and getProgress→getLegacyProgress to avoid base class conflict, fixed by-composite→by-composite-key index name (10 errors) |
| `src/lib/review-engine/progress/KanjiMasteryProgressManager.ts` | 2025-12-02 | Fixed kanji.id→kanji.kanji, kanji.character→kanji.kanji to match Kanji interface (3 errors) |
| `src/lib/drill/question-generator.ts` | 2025-12-02 | Fixed 'adverbial'→'taiAdverbial', added type guards for filter, made generateQuestionsForWord async with await, added EnhancedJapaneseWord type assertions, updated DrillQuestion.targetForm to string (13 errors) |
| `src/types/drill.ts` | 2025-12-02 | Changed DrillQuestion.targetForm from keyof ConjugationForms to string for ExtendedConjugationForms compatibility |
| `src/lib/review-engine/core/interfaces.ts` | 2025-12-02 | Changed `export { ReviewMode }` to `export type { ReviewMode }` for isolatedModules compatibility |
| `src/lib/review-engine/session/manager.ts` | 2025-12-02 | Imported ReviewableContentWithSRS, added type assertion for srsData access (6 errors) |
| `src/lib/review-engine/monitoring/performance-monitor.ts` | 2025-12-02 | Changed startTimer() return type from `() => void` to `() => number` (2 errors) |
| `src/lib/review-engine/api/session-entitlement-validator.ts` | 2025-12-02 | Changed policyVersion: '1.0' to 1 (number), 'invalid_request' to 'no_permission', added type cast for usage Record (4 errors) |
| `src/lib/review-engine/adapters/KanjiMasteryAdapter.ts` | 2025-12-02 | Changed `private calculateDifficulty` to `override calculateDifficulty` for proper base class extension |
| `src/lib/review-engine/validation/KanjiMasteryValidator.ts` | 2025-12-02 | Rewrote to properly extend BaseValidator with correct imports and validate() signature |
| `src/hooks/useFeature.ts` | 2025-12-02 | Added `limit?: number` and `usageBefore?: number` to Decision interface |
| `src/components/review-engine/cards/KanjiCard.tsx` | 2025-12-02 | Fixed Kanji type - added meanings, strokeCount, examples, fixed jlptLevel access |
| `src/hooks/useTTS.ts` | 2025-12-02 | Added isPlaying alias property for component compatibility (2 interface + return object changes) |
| `src/i18n/locales/en/strings.ts` | 2025-12-02 | Added 17 vocabulary display i18n strings to common: searchPlaceholder, allLessons, lesson, lessons, showing, of, words, shuffle, japanese, reading, meaning, examples, partOfSpeech, totalVocabulary, srsReview, audioSupport, interactive |
| `src/app/textbook-vocabulary/page.tsx` | 2025-12-02 | Fixed DoshiMascot props: removed invalid mood prop, added valid variant prop |
| `src/app/textbook-vocabulary/TextbookVocabularyPage.tsx` | 2025-12-02 | Fixed DoshiMascot props: removed invalid mood prop, added valid variant prop |
| `src/app/textbook-vocabulary/components/VocabularyDisplay.tsx` | 2025-12-02 | Fixed by useTTS isPlaying alias and i18n common strings (14 errors) |
| `src/app/tools/textbook-vocabulary/page.tsx` | 2025-12-02 | Fixed DoshiMascot props: removed invalid mood prop, added valid variant prop |
| `src/app/tools/textbook-vocabulary/TextbookVocabularyPage.tsx` | 2025-12-02 | Fixed DoshiMascot props: removed invalid mood prop, added valid variant prop |
| `src/app/tools/textbook-vocabulary/components/VocabularyDisplay.tsx` | 2025-12-02 | Fixed by useTTS isPlaying alias and i18n common strings (14 errors) |
| `src/lib/ai/cache/PersistentCacheManager.ts` | 2025-12-02 | Added `&& db` null checks to all persistenceEnabled conditionals (11 errors) |
| `src/app/resources/page.tsx` | 2025-12-02 | Added `as string[]` type assertion for categories, changed strings.resources to t() calls (16 errors) |
| `src/lib/conjugation/engine.ts` | 2025-12-02 | Added match:string type, jlpt undefined, naideForm→naiDeForm, imported WordType/JapaneseWord, fixed generateTaiForms return type (12 errors) |
| `src/types/entitlements.ts` | 2025-12-02 | Re-exported FeatureId from FeatureId.ts to consolidate duplicate type definitions (~12 errors across multiple files) |
| `src/app/api/ai/process/route.ts` | 2025-12-02 | Fixed checkAdminRole(request) calls, authResult.userId→uid (7 errors) |
| `src/app/api/debug/firebase-test/route.ts` | 2025-12-02 | Added FirebaseTestResults interface for dynamic test properties (7 errors) |
| `src/app/api/blog/[id]/route.ts` | 2025-12-02 | Added BlogPostData interface with status, views properties (3 errors) |
| `src/app/api/blog/public/route.ts` | 2025-12-02 | Added BlogPostData interface, typed doc.data() cast (2 errors) |
| `src/app/api/blog/slug/[slug]/route.ts` | 2025-12-02 | Added BlogPostData interface with status, views, dates (3 errors) |
| `src/app/api/kanji-mastery/session/route.ts` | 2025-12-02 | Changed getUserTier to tierCache.getUserTier, removed .plan access, fixed user.uid→session.uid (6 errors) |
| `src/app/api/todos/route.ts` | 2025-12-02 | Added .toISOString() to Date conversions (3 errors) |
| `src/app/api/news/articles/route.ts` | 2025-12-02 | Added types to doc and article filter parameters (2 errors) |
| `src/app/api/wanikani/proxy/route.ts` | 2025-12-02 | Added type to item parameter in map (1 error) |
| `src/app/api/user/profile/route.ts` | 2025-12-02 | Added fallback for session.tier (1 error) |
| `src/app/api/user/export-data/route.ts` | 2025-12-02 | Added fallback for session.tier (1 error) |
| `src/app/api/usage/[featureId]/increment/route.ts` | 2025-12-02 | Added null coalescing for decision.limit (1 error) |

---

## Summary by Category

| Category | Count | Status |
|----------|-------|--------|
| **⚠️ Stripe Routes (PRIORITY)** | **0** | ✅ Fixed |
| **Admin Routes** | **0** | ✅ Fixed |
| **i18n / UI (shared)** | **0** | ✅ Fixed (t() signature, Tabs component, I18nContext union type) |
| **Settings Page** | **0** | ✅ Fixed (49 errors - preferencesManager type, strings.settings) |
| **Dashboard Page** | **2** | ⚠️ Partial (16 fixed, 2 streak-related PENDING - needs careful review) |
| **Vocabulary Page** | **0** | ✅ Fixed (25 errors - isPremium, reviewPrompts fallbacks) |
| **PricingComparison** | **0** | ✅ Fixed (62 errors - NonNullable type assertions) |
| API Routes (other) | ~42 | In progress |
| Pages (`src/app/**/page.tsx`) | ~69 | Pending (3 pages fixed this session) |
| Components (`src/components/`) | ~64 | Pending |
| Library (`src/lib/`) | ~60 | Pending |
| Hooks (`src/hooks/`) | ~18 | Pending |
| **i18n (`src/i18n/`)** | **0** | ✅ Fixed (101 duplicate key errors across 6 locale files) |
| Services (`src/services/`) | 3 | Pending |
| Utils (`src/utils/`) | 5 | Pending |
| Other | ~14 | Pending |

---

## API Routes (121 files)

### ✅ STRIPE ROUTES (COMPLETE)
> **All Stripe payment routes have been fixed!** See Fixed Files section above.

---

### Admin Routes
> **All admin routes have been fixed!** See Fixed Files section above.

### Auth Routes
> **All auth routes have been fixed!** See Fixed Files section above.

### Blog Routes
- `src/app/api/blog/[id]/comments/route.ts`
- `src/app/api/blog/comments/[commentId]/route.ts`
- `src/app/api/blog/public/route.ts`
- `src/app/api/blog/route.ts`
> *Note: Some blog routes already fixed - see Fixed Files section*

### Other API Routes
- `src/app/api/ai/process/route.ts`
- `src/app/api/clear-session/route.ts`
- `src/app/api/debug/firebase-test/route.ts`
- `src/app/api/drill/session/route.ts`
- `src/app/api/flashcards/decks/[id]/cards/route.ts`
- `src/app/api/flashcards/decks/[id]/route.ts`
- `src/app/api/flashcards/decks/route.ts`
- `src/app/api/gamification/load/route.ts`
- `src/app/api/gamification/streak/break/route.ts`
- `src/app/api/gamification/streak/save/route.ts`
- `src/app/api/grammar/explain/route.ts`
- `src/app/api/kanji/add-to-review/route.ts`
- `src/app/api/kanji/bookmarks/route.ts`
- `src/app/api/kanji/browse/route.ts`
- `src/app/api/kanji/by-radical/route.ts`
- `src/app/api/kanji/progress/route.ts`
- `src/app/api/kanji-mastery/session/route.ts`
- `src/app/api/leaderboard/opt-out/route.ts`
- `src/app/api/leaderboard/route.ts`
- `src/app/api/leaderboard/user-rank/route.ts`
- `src/app/api/lists/[listId]/items/route.ts`
- `src/app/api/lists/[listId]/route.ts`
- `src/app/api/lists/route.ts`
- `src/app/api/lists/sync/route.ts`
- `src/app/api/news/articles/route.ts`
- `src/app/api/news/status/route.ts`
- `src/app/api/newsletter/subscribe/route.ts`
- `src/app/api/newsletter/unsubscribe/route.ts`
- `src/app/api/newsletter/verify/route.ts`
- `src/app/api/nhk/live-schedule/route.ts`
- `src/app/api/notifications/daily-reminder/route.ts`
- `src/app/api/notifications/test/route.ts`
- `src/app/api/notifications/unsubscribe/route.ts`
- `src/app/api/notifications/weekly-progress/route.ts`
- `src/app/api/progress/track/route.ts`
- `src/app/api/resources/[id]/route.ts`
- `src/app/api/resources/public/route.ts`
- `src/app/api/resources/related/route.ts`
- `src/app/api/review/activity/route.ts`
- `src/app/api/review/migrate-srs/route.ts`
- `src/app/api/review/progress/studied/route.ts`
- `src/app/api/review/scheduled/route.ts`
- `src/app/api/review/stats/route.ts`
- `src/app/api/review/user-sessions/route.ts`
- `src/app/api/sessions/save/route.ts`
- `src/app/api/srs/update/route.ts`
- `src/app/api/todos/[id]/route.ts`
- `src/app/api/todos/route.ts`
- `src/app/api/usage/[featureId]/check/route.ts`
- `src/app/api/usage/[featureId]/increment/route.ts`
- `src/app/api/usage/[featureId]/route.ts`
- `src/app/api/user/export-data/route.ts`
- `src/app/api/user/profile/route.ts`
- `src/app/api/vocabulary/history/route.ts`
- `src/app/api/wanikani/proxy/route.ts`
- `src/app/api/word/explain/route.ts`
- `src/app/api/youtube/extract/route.ts`
- `src/app/api/youtube/native-transcript/[videoId]/route.ts`
- `src/app/api/youtube/popular/route.ts`
- `src/app/api/youtube/series/route.ts`
- `src/app/api/youtube/transcript/[videoId]/route.ts`

---

## Pages (75 files)

### Admin Pages
- `src/app/admin/entitlements/page.tsx`
- `src/app/admin/firebase-monitoring/components/FirebaseUsageChart.tsx`
- `src/app/admin/gamification-xp-config/page.tsx`
- `src/app/admin/page.tsx`
- `src/app/admin/resources/page.tsx`
- `src/app/admin/stories/edit/[id]/page.tsx`
- `src/app/admin/youtube-series/page.tsx`

### Account & Auth Pages
- `src/app/account/AccountPage.tsx`
- `src/app/account/page.tsx`
- `src/app/auth/action/page.tsx`

### Feature Pages
- `src/app/achievements/page.tsx`
- `src/app/blog/[slug]/page.tsx`
- `src/app/blog/sitemap.ts`
- `src/app/contact/ContactPage.tsx`
- `src/app/contact/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/demo/nhk/page.tsx`
- `src/app/drill/page.tsx`
- `src/app/flashcards/page.tsx`
- `src/app/leaderboard/page.tsx`
- `src/app/lists/[listId]/page.tsx`
- `src/app/lists/page.tsx`
- `src/app/my-videos/MyVideos.tsx`
- `src/app/news/NewsPage.tsx`
- `src/app/news/NewsPageClient.tsx`
- `src/app/news/page.tsx`
- `src/app/privacy/page.tsx`
- `src/app/privacy/PrivacyPage.tsx`
- `src/app/resources/[id]/page.tsx`
- `src/app/resources/page.tsx`
- `src/app/review/ReviewPage.tsx`
- `src/app/review/session/page.tsx`
- `src/app/review-dashboard/page.tsx`
- `src/app/settings/page.tsx`
- `src/app/stories/page.tsx`
- `src/app/stories/StoriesPage.tsx`
- `src/app/terms/page.tsx`
- `src/app/terms/TermsPage.tsx`
- `src/app/test-entitlements/page.tsx`
- `src/app/test-notifications/page.tsx`
- `src/app/vocabulary/components/SearchHistory.tsx`
- `src/app/vocabulary/components/VocabularySearch.tsx`
- `src/app/vocabulary/components/WordDetailsModal.tsx`
- `src/app/vocabulary/page.tsx`
- `src/app/youtube-shadowing/page.tsx`

### Games Pages
- `src/app/games/kana-drop/components/GameCanvas.tsx`
- `src/app/games/kana-drop/components/GameStats.tsx`
- `src/app/games/kana-drop/components/KanaDropGame.tsx`
- `src/app/games/kana-drop/components/KanaDropModal.tsx`
- `src/app/games/kanji-simon/[boardId]/page.tsx`
- `src/app/games/kanji-simon/components/GameOverScreen.tsx`
- `src/app/games/kanji-simon/components/KanjiSimonBoardSelection.tsx`
- `src/app/games/kanji-simon/components/KanjiSimonGame.tsx`
- `src/app/games/kanji-simon/components/KanjiSimonGameWrapper.tsx`
- `src/app/games/kanji-simon/page.tsx`
- `src/app/games/page.tsx`
- `src/app/games/reading-routes/components/GameOverScreen.tsx`
- `src/app/games/reading-routes/page.tsx`
- `src/app/games/reading-routes/types/reading-routes.ts`
- `src/app/games/stroke-order/components/GameControls.tsx`
- `src/app/games/stroke-order/components/GameOverModal.tsx`
- `src/app/games/stroke-order/components/ScoreDisplay.tsx`
- `src/app/games/stroke-order/components/StrokeOrderGame.tsx`
- `src/app/games/stroke-order/page.tsx`

### Kanji Pages
- `src/app/kanji-browser/KanjiBrowserPage.tsx`
- `src/app/kanji-browser/page.tsx`
- `src/app/kanji-connection/families/KanjiFamiliesPage.tsx`
- `src/app/kanji-connection/families/page.tsx`
- `src/app/kanji-connection/radicals/KanjiRadicalsPage.tsx`
- `src/app/kanji-connection/radicals/page.tsx`
- `src/app/kanji-connection/visual-layout/page.tsx`
- `src/app/kanji-connection/visual-layout/VisualLayoutPage.tsx`
- `src/app/kanji-moods/[boardId]/page.tsx`

### Learn Pages
- `src/app/learn/word-learning/complete/page.tsx`
- `src/app/learn/word-learning/page.tsx`
- `src/app/learn/word-learning/session/page.tsx`

### Tools Pages
- `src/app/textbook-vocabulary/components/TextbookSelector.tsx`
- `src/app/textbook-vocabulary/components/VocabularyDisplay.tsx`
- `src/app/textbook-vocabulary/page.tsx`
- `src/app/textbook-vocabulary/TextbookVocabularyPage.tsx`
- `src/app/tools/kanji-mastery/components/SessionCompleteModal.tsx`
- `src/app/tools/kanji-mastery/KanjiMasteryPage.tsx`
- `src/app/tools/kanji-mastery/learn/components/Round1Learn.tsx`
- `src/app/tools/kanji-mastery/learn/components/Round2Test.tsx`
- `src/app/tools/kanji-mastery/learn/components/Round3Evaluate.tsx`
- `src/app/tools/kanji-mastery/learn/LearnContent.tsx`
- `src/app/tools/kanji-mastery/page.tsx`
- `src/app/tools/textbook-vocabulary/components/TextbookSelector.tsx`
- `src/app/tools/textbook-vocabulary/components/VocabularyDisplay.tsx`
- `src/app/tools/textbook-vocabulary/page.tsx`
- `src/app/tools/textbook-vocabulary/TextbookVocabularyPage.tsx`

---

## Components (64 files)

### Admin Components
- `src/components/admin/BlogEditor.tsx`
- `src/components/admin/MoodBoardEditor.tsx`
- `src/components/admin/RegenerateImageModal.tsx`

### Common Components
- `src/components/anki/AnkiImportModal.tsx`
- `src/components/common/BuyMeACoffeeButton.tsx`

### Conjugation Components
- `src/components/conjugation/ConjugationDisplay.tsx`
- `src/components/conjugation-help/HelpBanner.tsx`
- `src/components/conjugation-help/HelpModal.tsx`

### Dashboard Components
- `src/components/dashboard/LearningVillage.tsx`

### Flashcard Components
- `src/components/flashcards/BulkOperations.tsx`
- `src/components/flashcards/ComebackMessage.tsx`
- `src/components/flashcards/DeckCreator.tsx`
- `src/components/flashcards/FlashcardViewer.tsx`
- `src/components/flashcards/SessionSettingsModal.tsx`
- `src/components/flashcards/StatsDashboard.tsx`
- `src/components/flashcards/StudySession.tsx`
- `src/components/flashcards/VirtualCardList.tsx`

### Game Components
- `src/components/games/kanji-quest/KanjiQuest.tsx`
- `src/components/games/kanji-quest/KanjiQuestTutorial.tsx`
- `src/components/games/MatchingGame/index.tsx`
- `src/components/games/MatchingGame/VictoryScreen.tsx`
- `src/components/games/sentence-scramble/SentenceScrambleGame.tsx`
- `src/components/games/WordAssembly/WordAssemblyGame.tsx`

### Gamification Components
- `src/components/gamification/StreakSaveModal.tsx`

### Kanji Components
- `src/components/kanji/ExamplesModal.tsx`
- `src/components/kanji/KanjiDetailsModal.tsx`
- `src/components/kanji/KanjiStudyMode.tsx`
- `src/components/kanji-moods/KanjiCard.tsx`

### Layout Components
- `src/components/landing/PricingComparison.tsx`
- `src/components/layout/Navbar.tsx`
- `src/components/layout/PageHeader.tsx`

### Learn Components
- `src/components/learn/KanaDetailsModal.tsx`
- `src/components/learn/KanaLearningComponent.tsx`
- `src/components/learn/KanaStudyMode.tsx`

### List Components
- `src/components/lists/CreateListModal.tsx`

### News Components
- `src/components/news/CompactSettingsToolbar.tsx`
- `src/components/news/EnhancedArticleReaderFinal.tsx`
- `src/components/news/TranslationAssistance.tsx`
- `src/components/news/TranslationWrapper.tsx`

### Notification Components
- `src/components/notifications/InAppNotificationProvider.tsx`
- `src/components/notifications/NotificationSettings.tsx`

### Pokedex Components
- `src/components/pokedex/PokedexCard.tsx`
- `src/components/pokedex/PokedexContent.tsx`
- `src/components/pokedex/TestPokemonCatch.tsx`

### Reading Components
- `src/components/reading/GrammarHighlightedText.tsx`

### Review Components
- `src/components/review/dashboard/StatsOverview.tsx`
> *Note: KanjiCard.tsx and EntitlementGate.tsx fixed 2025-12-02 - see Fixed Files*

### Story Components
- `src/components/story/StoryReader.tsx`

### Sync Components
- `src/components/sync/SyncStatusIndicator.tsx`
- `src/components/sync/SyncStatusMenuItem.tsx`

### Todo Components
- `src/components/todos/CreateTodoForm.tsx`
- `src/components/todos/TodoItem.tsx`
- `src/components/todos/TodoList.tsx`

### UI Components
- `src/components/ui/AudioPlayer.tsx`
- `src/components/ui/DoshiMascot.tsx`

### Word Components
- `src/components/word/EnhancedWordExplanationModal.tsx`

### YouTube Components
- `src/components/youtube-shadowing/EnhancedShadowingPlayer.basic.tsx`
- `src/components/youtube-shadowing/TranscriptDisplay.tsx`
- `src/components/youtube-shadowing/TranscriptViewer.tsx`
- `src/components/youtube-shadowing/TranscriptViewerNew.tsx`
- `src/components/youtube-shadowing/YouTubePlayerNew.tsx`

---

## Library (80 files)

### Admin
- `src/lib/admin/adminAuth.ts`
- `src/lib/admin/auditLogger.ts`

### AI
- `src/lib/ai/AIService.ts`
- `src/lib/ai/cache/PersistentCacheManager.ts`
- `src/lib/ai/config/PromptManager.ts`
- `src/lib/ai/processors/GrammarExplainerProcessorHybrid.ts`
- `src/lib/ai/processors/ImageProcessor.ts`
- `src/lib/ai/processors/MoodboardProcessor.ts`
- `src/lib/ai/processors/MultiStepStoryProcessor.ts`
- `src/lib/ai/processors/ReviewQuestionProcessor.ts`
- `src/lib/ai/processors/ReviewQuestionProcessorHybrid.ts`
- `src/lib/ai/processors/StoryProcessor.ts`
- `src/lib/ai/processors/TranscriptProcessor.ts`
- `src/lib/ai/processors/TranscriptProcessorHybrid.ts`
- `src/lib/ai/types.ts`

### Anki
- `src/lib/anki/importer.ts`
- `src/lib/anki/parser.ts`

### API
- `src/lib/api/storage-helper.ts`

### Auth
- `src/lib/auth.ts`
- `src/lib/auth/tier-cache.ts`

### Conjugation
- `src/lib/conjugation/engine.ts`
- `src/lib/conjugation/wordTypeDetector.ts`
- `src/lib/conjugation-help/error-analyzer.ts`
- `src/lib/conjugation-help/error-classifier.ts`

### Drill
- `src/lib/drill/question-generator.ts`
- `src/lib/drill/srs-word-selector.ts`

### Email
- `src/lib/email/resend.ts`
- `src/lib/email/sendgrid.ts`

### Entitlements
- `src/lib/entitlements/adminEvaluator.ts`
- `src/lib/entitlements/evaluator.ts`
- `src/lib/entitlements/firestore-helpers.ts`
- `src/lib/entitlements/policy.ts`

### Features
- `src/lib/features/runtimeFeatureFlags.ts`

### Firebase
- `src/lib/firebase/auth-admin.ts`

### Flashcards
- `src/lib/flashcards/ErrorMonitor.ts`
- `src/lib/flashcards/FlashcardManager.ts`
- `src/lib/flashcards/IndexedDBOptimizer.ts`
- `src/lib/flashcards/MigrationManager.ts`
- `src/lib/flashcards/PerformanceTracker.ts`
- `src/lib/flashcards/SRSHelper.ts`

### Gamification
- `src/lib/gamification/services/gamification-coordinator.ts`

### IDB
- `src/lib/idb/client.ts`
- `src/lib/idb/index.ts`
- `src/lib/idb/sync-worker.ts`

### Lists
- `src/lib/lists/ListManager.ts`

### Logger
- `src/lib/logger/debug-logger.ts`
- `src/lib/logger/pino-logger.ts`

### Monitoring
- `src/lib/monitoring/firebase-tracker.ts`

### Notifications
- `src/lib/notifications/browser/BrowserNotificationService.ts`
- `src/lib/notifications/notification-service.ts`
- `src/lib/notifications/orchestrator/NotificationOrchestrator.ts`
- `src/lib/notifications/orchestrator/NotificationQueue.ts`
- `src/lib/notifications/preferences/PreferenceManager.ts`
- `src/lib/notifications/push/FCMManager.ts`
- `src/lib/notifications/push/PushNotificationService.ts`
- `src/lib/notifications/push/ServiceWorkerManager.ts`
- `src/lib/notifications/utils/RateLimiter.ts`
- `src/lib/notifications/utils/sanitizer.ts`
- `src/lib/notifications/utils/TimerManager.ts`

### PWA
- `src/lib/pwa/notificationHandler.ts`
- `src/lib/pwa/notifications.ts`

### Redis
- `src/lib/redis/invalidation/tier-change-handler.ts`

### Review Engine
> **Core review-engine files fixed 2025-12-02!** See Fixed Files section above.
> Remaining files with errors:
- `src/lib/review-engine/adapters/AnkiAdapter.ts`
- `src/lib/review-engine/adapters/FlashcardAdapter.ts`
- `src/lib/review-engine/adapters/KanjiBrowserAdapter.ts`
- `src/lib/review-engine/adapters/registry.ts`
- `src/lib/review-engine/adapters/UserListAdapter.ts`
- `src/lib/review-engine/progress/DrillProgressManager.ts`
- `src/lib/review-engine/progress/statistics-aggregator.ts`
- `src/lib/review-engine/validation/validator-factory.ts`

### Schemas
- `src/lib/schemas/gamification.schema.ts`

### Services
- `src/lib/services/StoryService.ts`

### Theme
- `src/lib/theme/ThemeContext.tsx`

### TTS
- `src/lib/tts/cache.ts`
- `src/lib/tts/providers/kokoro.ts`
- `src/lib/tts/service.ts`
- `src/lib/tts/utils.ts`

---

## Hooks (18 files)

> *Note: useFeature.ts fixed 2025-12-02 - see Fixed Files*

- `src/hooks/useAutoSync.ts`
- `src/hooks/useContentTranslation.ts`
- `src/hooks/useDrill.ts`
- `src/hooks/useEntitlementModal.ts`
- `src/hooks/useGamification.ts`
- `src/hooks/useKanjiDetails.ts`
- `src/hooks/useKeyboardShortcuts.ts`
- `src/hooks/useNotificationIntegration.ts`
- `src/hooks/useNotificationPreferences.ts`
- `src/hooks/usePokemonCatch.ts`
- `src/hooks/useProgressiveTranscript.ts`
- `src/hooks/useReviewData.ts`
- `src/hooks/useStorageDecision.ts`
- `src/hooks/useStreakSaveDetection.ts`
- `src/hooks/useTodos.ts`
- `src/hooks/useTTS.ts`

---

## i18n (6 files)

> **All i18n locale files have been fixed!** See Fixed Files section above.
>
> Fixed 101 TS1117 (duplicate property keys) errors across all 6 locale files:
> - en/strings.ts: 30 errors (dashboard, kana, settings, flashcards duplicates)
> - fr/strings.ts: 23 errors (dashboard, kana, settings, shadowing duplicates)
> - es/strings.ts: 19 errors (landing, kana, flashcards, pwa duplicates)
> - ja/strings.ts: 15 errors (landing, flashcards, checkout, pwa duplicates)
> - de/strings.ts: 8 errors (landing, kana 3→1 merge, settings, pwa duplicates)
> - it/strings.ts: 6 errors (landing, flashcards, checkout, settings duplicates)

---

## Services (3 files)

- `src/services/kanjiEnrichmentService.ts`
- `src/services/practiceHistory/FirebaseStorage.ts`
- `src/services/youtube/FirebaseStorage.ts`

---

## Utils (5 files)

- `src/utils/kanaProgressManager.ts`
- `src/utils/kanaProgressManagerV2.ts`
- `src/utils/kuromojiService.ts`
- `src/utils/scrapers/scraper-utils.ts`
- `src/utils/textUtils.ts`

---

## Other (14 files)

- `src/middleware/storage-guard.ts`
- `src/test-utils/progressive-transcript-mocks.ts`

---

## Notes

- Test files (`*.test.ts`, `*.spec.ts`, `__tests__/`) are excluded from this list
- To regenerate this list, run: `npx tsc --noEmit 2>&1 | grep -E "^src/.*\(" | grep -v "\.test\." | grep -v "\.spec\." | grep -v "__tests__" | sed 's/(.*//' | sort -u`
- Current config in `next.config.ts` has `typescript.ignoreBuildErrors: true`
