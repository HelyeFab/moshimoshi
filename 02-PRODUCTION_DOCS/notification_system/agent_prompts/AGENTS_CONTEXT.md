# Notification System - Agent Context (Reminder Summary Project)

## Mission
Build a unified reminder notification system that can be wired into every major feature. The system sends a single daily summary email to users who used a feature yesterday but not today, respecting both a global notification setting and per-feature toggles.

## Requirements (Locked)
- Trigger: user used a feature **yesterday** and **not today** (calendar day in user timezone).
- Cadence: **max 1 email per day per user**.
- Send time: **18:00 UTC** daily job.
- Channel: **email only**.
- Summary email: **top 5 most recently used eligible features**, single CTA "Continue learning".
- Toggles: user must have **global notifications ON** AND **feature toggle ON** for each feature.
- Preferences storage: **`notifications_preferences`** (Firestore).
- UI: add toggles to **both** `pageHeader` and `learningPageHeader`.
- Existing users: **migrate to ON** defaults.
- Email delivery: must use **admin/email-campaigns** flow (create campaign + send).
- Template: create **new email template** in `email_templates`.

## Existing System Anchors
- Page visits are tracked in Firestore collection `page_visits` via `POST /api/analytics/page-visit`.
- Campaign system:
  - UI: `src/app/[locale]/admin/email-campaigns/page.tsx`
  - API: `src/app/api/admin/campaigns/*`
  - Service: `src/lib/email/campaigns/service.ts`
  - Type: `src/lib/email/campaigns/types.ts`
- Notification prefs API: `src/app/api/notifications/preferences/route.ts` (currently stores prefs in `notifications_preferences`).

## Proposed Feature Buckets (Draft)
- Kana: `/learn/hiragana`, `/learn/katakana`
- Kanji mastery: `/tools/kanji-mastery` (and subroutes)
- Flashcards/SRS: `/flashcards`, `/review`, `/anki-study`
- News: `/news/[id]`
- Stories: `/stories/[id]`
- Books/Library: `/library/[id]`
- Vocabulary/Word learning: `/learn/word-learning/session`, `/vocabulary`

## Non-Negotiables
- No new libraries.
- Follow existing patterns (campaigns service, notification prefs).
- Keep changes minimal and local.

## Deliverables by agents
- Clear file references in updates.
- Tests if a natural seam exists.
- Avoid duplicating sending logic; use campaign creation + send.

