# TypeScript Error Files

**Generated:** 2025-11-30
**Last Updated:** 2025-11-30
**Total Files with Errors:** 386 (excluding test files)

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

---

## Summary by Category

| Category | Count |
|----------|-------|
| **⚠️ Stripe Routes (PRIORITY)** | **0** ✅ |
| API Routes (`src/app/api/`) | 103 |
| Pages (`src/app/**/page.tsx`) | 74 |
| Components (`src/components/`) | 64 |
| Library (`src/lib/`) | 76 |
| Hooks (`src/hooks/`) | 18 |
| i18n (`src/i18n/`) | 6 |
| Services (`src/services/`) | 3 |
| Utils (`src/utils/`) | 5 |
| Other | 14 |

---

## API Routes (121 files)

### ⚠️ STRIPE ROUTES (PRIORITY) ⚠️
> **These files handle payment processing and should be fixed first**

| File | Description |
|------|-------------|
| `src/app/api/admin/stripe/cleanup/route.ts` | Admin Stripe cleanup |
| `src/app/api/admin/stripe/test-renewal/route.ts` | Admin Stripe test renewal |
| `src/app/api/stripe/create-checkout-session/route.ts` | Checkout session creation |
| `src/app/api/stripe/donate/route.ts` | Donation processing |

---

### Admin Routes
- `src/app/api/admin/backup/check-status/route.ts`
- `src/app/api/admin/backup/list/route.ts`
- `src/app/api/admin/backup/status/route.ts`
- `src/app/api/admin/backup/trigger/route.ts`
- `src/app/api/admin/blog/route.ts`
- `src/app/api/admin/decision-logs/route.ts`
- `src/app/api/admin/evaluate/route.ts`
- `src/app/api/admin/feature-flags/route.ts`
- `src/app/api/admin/generate-audio/route.ts`
- `src/app/api/admin/generate-image/route.ts`
- `src/app/api/admin/generate-moodboard/route.ts`
- `src/app/api/admin/generate-story/route.ts`
- `src/app/api/admin/init/route.ts`
- `src/app/api/admin/leaderboard/trigger/route.ts`
- `src/app/api/admin/logs/route.ts`
- `src/app/api/admin/monitoring/firebase-usage/route.ts`
- `src/app/api/admin/monitoring/quota/route.ts`
- `src/app/api/admin/news/trigger-scraping/route.ts`
- `src/app/api/admin/override/route.ts`
- `src/app/api/admin/resources/[id]/route.ts`
- `src/app/api/admin/resources/analytics/route.ts`
- `src/app/api/admin/resources/route.ts`
- `src/app/api/admin/resources/stats/route.ts`
- `src/app/api/admin/scraping-logs/route.ts`
- `src/app/api/admin/scraping-progress/route.ts`
- `src/app/api/admin/scripts/run/route.ts`
- `src/app/api/admin/set-admin/route.ts`
- `src/app/api/admin/stats/route.ts`
- `src/app/api/admin/stats-consistency/route.ts`
- `src/app/api/admin/streak-config/route.ts`
- `src/app/api/admin/subscriptions/upgrade/route.ts`
- `src/app/api/admin/users/[uid]/route.ts`
- `src/app/api/admin/users/route.ts`
- `src/app/api/admin/youtube-series/sync/route.ts`

### Auth Routes
- `src/app/api/auth/google/route.ts`
- `src/app/api/auth/invalidate-all-caches/route.ts`
- `src/app/api/auth/invalidate-tier-cache/route.ts`
- `src/app/api/auth/refresh-session/route.ts`
- `src/app/api/auth/session-check/route.ts`
- `src/app/api/auth/signin/route.ts`

### Blog Routes
- `src/app/api/blog/[id]/comments/route.ts`
- `src/app/api/blog/[id]/route.ts`
- `src/app/api/blog/comments/[commentId]/route.ts`
- `src/app/api/blog/debug/route.ts`
- `src/app/api/blog/public/route.ts`
- `src/app/api/blog/route.ts`
- `src/app/api/blog/slug/[slug]/route.ts`

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
- `src/app/api/notifications/pending/route.ts`
- `src/app/api/notifications/preferences/route.ts`
- `src/app/api/notifications/send-push/route.ts`
- `src/app/api/notifications/test/route.ts`
- `src/app/api/notifications/unsubscribe/route.ts`
- `src/app/api/notifications/weekly-progress/route.ts`
- `src/app/api/practice/track/route.ts`
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
- `src/app/review-dashboard/ReviewDashboard.tsx`
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
- `src/components/review-engine/cards/KanjiCard.tsx`
- `src/components/review-engine/EntitlementGate.tsx`

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
- `src/lib/review-engine/adapters/AnkiAdapter.ts`
- `src/lib/review-engine/adapters/FlashcardAdapter.ts`
- `src/lib/review-engine/adapters/KanjiBrowserAdapter.ts`
- `src/lib/review-engine/adapters/KanjiMasteryAdapter.ts`
- `src/lib/review-engine/adapters/registry.ts`
- `src/lib/review-engine/adapters/UserListAdapter.ts`
- `src/lib/review-engine/api/session-entitlement-validator.ts`
- `src/lib/review-engine/monitoring/performance-monitor.ts`
- `src/lib/review-engine/progress/DrillProgressManager.ts`
- `src/lib/review-engine/progress/KanjiMasteryProgressManager.ts`
- `src/lib/review-engine/progress/statistics-aggregator.ts`
- `src/lib/review-engine/progress/UniversalProgressManager.ts`
- `src/lib/review-engine/session/manager.ts`
- `src/lib/review-engine/validation/KanjiMasteryValidator.ts`
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

- `src/i18n/locales/de/strings.ts`
- `src/i18n/locales/en/strings.ts`
- `src/i18n/locales/es/strings.ts`
- `src/i18n/locales/fr/strings.ts`
- `src/i18n/locales/it/strings.ts`
- `src/i18n/locales/ja/strings.ts`

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
