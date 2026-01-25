# Entitlement Enforcement Audit

Generated from `config/features.v1.json` with codebase scanning for `useFeature`, `EntitlementGate`, and API `evaluate(...)` usage.

| Feature | Limit Type | Free | Premium Monthly | Premium Yearly | UI Enforcement | API Enforcement |
| --- | --- | --- | --- | --- | --- | --- |
| hiragana_practice | daily | 5 | -1 | -1 | useFeature (1) | NONE |
| katakana_practice | daily | 5 | -1 | -1 | NONE | NONE |
| kanji_browser | daily | 5 | -1 | -1 | useFeature (1) | evaluate (1) |
| kanji_connection | daily | 0 | -1 | -1 | EntitlementGate (1) | NONE |
| kanji_mastery | daily | 5 | -1 | -1 | NONE | NONE |
| drawing_practice | daily | 5 | -1 | -1 | useFeature (5) | NONE |
| custom_lists | monthly | 3 | -1 | -1 | useFeature (1) | evaluate (1) |
| conjugation_drill | daily | 5 | -1 | -1 | useFeature (3) | evaluate (1) |
| grammar_explanations | daily | 3 | -1 | -1 | useFeature (2) | evaluate (1) |
| youtube_shadowing | daily | 3 | 20 | 20 | useFeature (1) | NONE |
| media_upload | daily | 2 | -1 | -1 | useFeature (1) | NONE |
| save_items | monthly | 50 | -1 | -1 | NONE | evaluate (1) |
| todos | monthly | 100 | -1 | -1 | useFeature (1) | NONE |
| flashcard_decks | monthly | 0 | 15 | 15 | NONE | NONE |
| anki_imports | monthly | 0 | 15 | 15 | NONE | NONE |
| flashcard_daily_reviews | daily | 0 | -1 | -1 | NONE | NONE |
| stall_layout_customization | daily | 1 | -1 | -1 | NONE | NONE |
| pwa_push | daily | 0 | -1 | -1 | NONE | NONE |
| pwa_bg_sync | daily | 0 | -1 | -1 | NONE | NONE |
| pwa_periodic_sync | daily | 0 | -1 | -1 | NONE | NONE |
| pwa_share_target | daily | 0 | -1 | -1 | NONE | NONE |
| pwa_fs_access | daily | 0 | -1 | -1 | NONE | NONE |
| pwa_badging | daily | 0 | -1 | -1 | NONE | NONE |
| pwa_media_session | daily | 0 | -1 | -1 | NONE | NONE |
| word_lookup | daily | 15 | -1 | -1 | NONE | evaluate (1) |
| news | daily | 2 | -1 | -1 | NONE | NONE |
| story | daily | 2 | -1 | -1 | NONE | NONE |
| books | daily | 2 | -1 | -1 | NONE | NONE |
| kanji_mood_board | daily | 5 | -1 | -1 | NONE | NONE |
| drill | daily | 5 | -1 | -1 | NONE | NONE |
| my_list | daily | 5 | -1 | -1 | NONE | NONE |
| textbook_vocabulary | daily | 0 | -1 | -1 | EntitlementGate (1) | NONE |
| flashcards | daily | 0 | -1 | -1 | EntitlementGate (1) | NONE |
| resources | daily | -1 | -1 | -1 | NONE | NONE |
| blogs | daily | -1 | -1 | -1 | NONE | NONE |
| vocabulary | daily | -1 | -1 | -1 | NONE | NONE |
| comics | daily | 0 | -1 | -1 | EntitlementGate (1) | evaluate (3) |

## Known Scan Gaps

- `useFeature(FEATURE_ID)` with `as FeatureId` casting may be undercounted in the table.
- API routes that enforce entitlements without calling `evaluate(...)` are not detected.
- Client-only gating via `src/lib/pwa/entitlements.ts` is not reflected in the table.

## Enforcement Gaps (Limit != unlimited, missing or inconsistent enforcement)

- `todos` uses `useFeature('todos')` but server uses `save_items` (`src/hooks/useTodos.ts`, `src/app/api/todos/route.ts`); free-tier limits diverge (100 vs 50).
- `youtube_shadowing` server uses a hard-coded quota map, not config/evaluator (`src/app/api/youtube/extract/route.ts`).
- `hiragana_practice`/`katakana_practice` are only enforced in review-session validation (no useFeature on actual pages); review validation only maps kana content types (`src/lib/review-engine/api/session-entitlement-validator.ts`).
- PWA entitlements use localStorage tier fallback and are not tied to subscription state (`src/lib/pwa/entitlements.ts`).
- `kanji_mastery` has limits in config but no entitlement checks in `src/app/api/kanji-mastery/session/route.ts`.
- `kanji_browser` is only enforced when adding to review (`src/app/api/kanji/add-to-review/route.ts`), not on browse/read endpoints.
- `kanji_connection`, `flashcards`, `textbook_vocabulary` are gated only via `EntitlementGate` (client), no server checks (`src/app/[locale]/kanji-connection/page.tsx`, `src/app/[locale]/flashcards/page.tsx`, `src/app/[locale]/tools/textbook-vocabulary/page.tsx`).
- `media_upload` is gated only via `useFeature` in UI, no server enforcement for upload APIs (search for upload routes).
- `news`, `story`, `books` have free-tier limits but public APIs allow unrestricted access (`src/app/api/news/**`, `src/app/api/stories/route.ts`, `src/app/api/library/books/**`).
- `flashcard_decks`, `anki_imports`, `flashcard_daily_reviews`, `stall_layout_customization`, `kanji_mood_board`, `drill`, `my_list` appear only in config/registry (no enforcement located in UI or server).

## Unlimited Features (No enforcement required)

- `resources`, `blogs`, `vocabulary` are unlimited for all plans in `config/features.v1.json`.
