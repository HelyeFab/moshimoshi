# Flashcards Changelog

## 2026-02-27
- Study mode mastery loop added (non-SRS):
  - `again` persists to weak cards + mistake replay + follow-up queue.
  - `hard` persists to weak cards + follow-up queue.
  - auto-chained Study follow-up rounds until queue clears.
- Study follow-up UI:
  - localized drill banner with round and cards-left count.
  - i18n keys: `flashcards.studyFollowUp.title`, `flashcards.studyFollowUp.cardsLeft`.
- Study reliability fixes:
  - duplicate-tap protection (idempotent response handling).
  - fixed >100% accuracy display edge case.
  - per-card-position answer tracking (resilient to duplicate card IDs).
  - Study completion fallback scoped to Study mode only.
- Study session UX:
  - "Guided practice..." mode hint auto-hides after ~4.5s.
- Study selection improvements:
  - large all-new decks now rotate cards across sessions using local cursor state:
    - key prefix: `flashcards_study_rotation_v1:`.

## 2026-02-25
- Introduced Preview and Study modes.
- Added new-deck recommendation defaulting to Preview.
- Added Preview-complete handoff dialog (Start Review / Back to Decks).
- Added local-only Japanese audio warmup with progress indicator.
- Added shared premium entitlements helper usage across flashcards sync routes.
- Added quota UX improvements for deck creation.
- Added Anki R2 delete reliability improvements (partial cleanup jobs + retries).

## 2026-02-22
- Documented and shipped deck creation quota UX copy improvements.
- Clarified quota policy behavior for premium (`flashcard_decks` monthly limit).

## Notes
- This changelog is append-only. Keep newest entries at the top.
- For deep implementation detail, link to an implementation note rather than duplicating long sections here.
