# Notification System

**Status:** ACTIVE
**Last Updated:** 2026-02-12

## Overview
The notification system keeps learners engaged and on‑track across channels: email (daily/weekly/achievement), in‑app toasts, browser notifications, and push (FCM). It includes user preferences, quiet hours, scheduling, queueing, and unsubscribe flows. This folder is the production‑grade onboarding entry point for engineers working on notifications.

## Quick Start
1. Read `NEW_DEVELOPER_ONBOARDING.md` end‑to‑end.
2. Skim key code entry points (below) to build the data‑flow mental model.
3. Test locally with `/notifications-demo` and `/test-notifications` pages.

## Documentation
- [NEW_DEVELOPER_ONBOARDING.md](./NEW_DEVELOPER_ONBOARDING.md) - Full onboarding guide and system deep‑dive

## Architecture (High Level)
- **Email**: API routes schedule/send → template rendering → Resend → log.
- **Review reminders**: Review Engine events → ReviewNotificationManager → Orchestrator/Scheduler → in‑app or browser.
- **Push**: FCMManager registers token → Firestore `notifications_tokens` → send‑push endpoint → FCM SW displays.
- **Preferences**: Stored in `notifications_preferences`, cached client‑side, quiet hours enforced.

## Key Files
- `src/lib/notifications/notification-service.ts:1` - Core email notification sending + logging
- `src/lib/notifications/orchestrator/NotificationScheduler.ts:1` - Scheduling + persistence (IndexedDB)
- `src/lib/notifications/preferences/PreferenceManager.ts:1` - Preferences load/cache/update
- `src/lib/notifications/preferences/QuietHours.ts:1` - Quiet hours logic and validation
- `src/hooks/useReviewNotifications.ts:1` - Review engine event → notification scheduling
- `src/app/api/notifications/preferences/route.ts:1` - Preferences API (special storage rules)
- `src/components/notifications/ReviewNotificationSettings.tsx:1` - Settings UI for review notifications
- `src/lib/notifications/push/FCMManager.ts:1` - FCM token registration and SW wiring

## Related Docs
- `DOCS_ARCHIVE/docs/notifications/NOTIFICATION_SYSTEM.md`
- `DOCS_ARCHIVE/docs/firebase-collections/notifications.md`
- `DOCS_ARCHIVE/docs/pwa/` (PWA notifications, permission UX, SW patterns)

