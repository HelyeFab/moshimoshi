# Notification System — New Developer Onboarding

**Status:** ACTIVE
**Last Updated:** 2026-02-12

## 0) Purpose and Scope
The notification system keeps learners engaged and on‑track using multiple channels:
- Email notifications (daily reminders, weekly progress, achievements).
- In‑app review toasts (foreground).
- Browser/system notifications (background).
- Push notifications via FCM (infrastructure ready and partially active).

This guide explains how the system is designed, where it lives in the codebase, how data flows, and how to safely extend or fix it without breaking production behaviors.

## 1) System Map (Mental Model)
At a high level, think in four layers:
1. Preferences and eligibility
2. Scheduling and queueing
3. Delivery (email, browser, push, in‑app)
4. Logging and compliance (unsubscribe, suppression)

Core flow (review reminders):
1. Review Engine emits events (`reviewEngine:itemAnswered`, `reviewEngine:sessionCompleted`).
2. `useReviewNotifications` listens and schedules notifications via `ReviewNotificationManager`.
3. `NotificationScheduler` persists schedules in IndexedDB and triggers at runtime.
4. `NotificationOrchestrator` chooses channel based on visibility, permissions, and preferences.
5. In‑app toast or system notification is dispatched.

Core flow (email reminders):
1. Cron or manual API call triggers `/api/notifications/*` endpoints.
2. `NotificationService` loads user data + preferences, renders templates, sends via Resend.
3. Notification log is written to Firestore.

Core flow (push):
1. `FCMManager` registers SWs and obtains FCM token.
2. Token is stored in Firestore (`notifications_tokens`).
3. `/api/notifications/send-push` or `/api/notifications/test` sends push payload.
4. `public/firebase-messaging-sw.js` displays notification and routes click actions.

## 2) Key Concepts and Invariants (Do‑Not‑Break)
1. Respect quiet hours in scheduling and delivery paths.
2. Never send if the user has disabled the channel or blocked permission.
3. Unsubscribe must be honored for email categories.
4. Avoid spam: rate limiting and circuit breaker behavior must remain intact.
5. Keep “foreground = in‑app toast, background = system notification” behavior intact.
6. Preserve the entitlements gates for push and periodic sync.
7. Preserve storage exceptions in `preferences` routes (privacy requirements).

## 3) Data Model and Storage
**Production reality:** The system uses several collections and not all docs are consistent. Be careful when changing anything in storage or docs.

Primary collections (code‑level):
- `notifications_preferences` (top‑level): channel/timing/quiet hours preferences.
- `notifications_tokens` (top‑level): FCM token and permission metadata.
- `notifications_queue` (top‑level): scheduled notification queue for server‑side tasks.
- `users/{uid}/notificationLogs` (subcollection): log of sent/failed/unsubscribe actions.
- `users/{uid}/preferences/settings` and `users/{uid}.preferences`: legacy/expanded preferences.

Notable doc mismatches (existing in repo):
- Docs refer to `notification_queue` and `users/{uid}/notification_preferences` while code uses `notifications_queue` and `notifications_preferences`.
- Docs describe `notification_unsubscribes` but current unsubscribe route updates `users/{uid}/preferences/settings` and logs to `notificationLogs`.

Action rule: do not rename collections or normalize docs unless explicitly requested. If you touch storage, document the change and audit all call sites.

## 4) Key Entry Points (Read These First)
1. `src/lib/notifications/notification-service.ts:1`
2. `src/lib/notifications/orchestrator/NotificationScheduler.ts:1`
3. `src/lib/notifications/preferences/PreferenceManager.ts:1`
4. `src/lib/notifications/preferences/QuietHours.ts:1`
5. `src/hooks/useReviewNotifications.ts:1`
6. `src/app/api/notifications/preferences/route.ts:1`
7. `src/components/notifications/ReviewNotificationSettings.tsx:1`
8. `src/lib/notifications/push/FCMManager.ts:1`

## 5) End‑to‑End Data Flow (Detailed)
### 5.1 Review Notifications
1. `ReviewEngine` dispatches `reviewEngine:itemAnswered` with `nextReviewAt`.
2. `useReviewNotifications` schedules for the item if the review is in the future.
3. `ReviewNotificationManager` builds a `ScheduledNotification`.
4. `NotificationScheduler` persists to IndexedDB (`moshimoshi_notifications`) and sets timers.
5. At trigger time, the scheduler calls `NotificationOrchestrator.sendNotification`.
6. Orchestrator decides channels based on preferences, app visibility, and permissions.
7. In‑app toast uses `ReviewNotificationToast`, system uses `BrowserNotificationService`.

### 5.2 Email Reminders
1. Cron or API POST triggers `daily-reminder` or `weekly-progress` routes.
2. `NotificationService` reads user data, preferences, and composes template data.
3. Resend delivers email. Errors are logged in `notificationLogs`.

### 5.3 Push (FCM)
1. `FCMManager.initialize` registers `/service-worker.js` and `/firebase-messaging-sw.js`.
2. `getToken()` requests permission and stores token in Firestore.
3. `PushNotificationService` or `/api/notifications/send-push` sends payload.
4. `firebase-messaging-sw.js` displays notification + handles action routing.

## 6) Preferences and Quiet Hours
Preferences are loaded and cached client‑side by `PreferenceManager`:
- Cache TTL: 5 minutes.
- Firestore collection: `notifications_preferences`.

Quiet hours are enforced via `QuietHours` and `notificationManager`:
- Accepts `start`, `end`, `timezone`, optional days and exceptions.
- Handles cross‑midnight windows.

Always respect quiet hours at both scheduling and delivery time for user‑facing channels.

## 7) Feature Flags and Entitlements
- Feature flag: `NOTIFICATIONS` (from `src/lib/features/featureFlags.ts`).
- PWA entitlements: `push`, `periodicSync`, `bgSync` (from `src/lib/pwa/entitlements.ts`).

Action rule: if you add a new channel or delivery path, wire it to both feature flags and entitlements where appropriate.

## 8) Service Workers and PWA Constraints
- Main SW: `public/service-worker.js` (strict cache discipline).
- Push SWs: `public/firebase-messaging-sw.js`, `public/push-sw.js`.

Rules:
1. Do not cache user data in SW.
2. Push SW must be at root scope to receive notifications.
3. Do not request permissions on first load.

## 9) Environment Variables (Minimum Set)
You will typically need:
- `RESEND_API_KEY`
- `CRON_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY`
- Firebase Admin credentials (`FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`)

Reference: `02-PRODUCTION_DOCS/ENV_LOCAL_BACKUP.md`.

## 10) Local Testing Playbook
### UI and in‑app
- Use `/notifications-demo` for review reminder simulation.
- Use `/test-notifications` for SW + FCM testing.

### API routes (manual)
```bash
curl -X POST http://localhost:3000/api/notifications/daily-reminder \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{"userId": "USER_ID"}'
```
```bash
curl -X POST http://localhost:3000/api/notifications/weekly-progress \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{"userId": "USER_ID"}'
```

### Browser permissions
1. Grant browser notification permission.
2. Toggle notification channels in settings.
3. Ensure quiet hours are not active.

## 11) Adding a New Notification Type (Safe Workflow)
1. Define the type in `notifications.types.ts`.
2. Add template (email) or content builder (in‑app/push).
3. Update `NotificationService` and/or `NotificationOrchestrator`.
4. Update `PreferenceManager` defaults if preference control is needed.
5. Add UI toggle in `ReviewNotificationSettings` or `NotificationSettings`.
6. Add tests for scheduler, validator, or route behavior.
7. Update docs and include migration notes if storage changes are required.

## 12) Common Pitfalls
1. **Collection mismatch**: docs say `notification_queue`, code uses `notifications_queue`.
2. **Dual storage confusion**: `preferences/route.ts` intentionally writes to Firebase for all users for privacy reasons.
3. **SW scope**: FCM SW must be registered at root (`/`).
4. **Permissions**: do not auto‑request; follow permission UX patterns.
5. **Timezone math**: always use timezone‑aware logic for scheduled emails.

## 13) Debugging Checklist
1. Confirm Notification permission status (`Notification.permission`).
2. Confirm FCM token exists in `notifications_tokens`.
3. Check quiet hours are disabled or outside window.
4. Verify channel toggles are enabled in `notifications_preferences`.
5. Check `notificationLogs` for failures.
6. Check Vercel cron / API logs for server‑side errors.

## 14) Security and Compliance
- Unsubscribe tokens expire after 24 hours.
- User data must not appear in public email links.
- Admin routes are protected with `withAdminAuth`.
- Do not log emails or tokens in plaintext for production.

## 15) Code References (Deep Links)
- `src/lib/notifications/notification-service.ts:1`
- `src/lib/notifications/orchestrator/NotificationScheduler.ts:1`
- `src/lib/notifications/preferences/PreferenceManager.ts:1`
- `src/lib/notifications/preferences/QuietHours.ts:1`
- `src/hooks/useReviewNotifications.ts:1`
- `src/app/api/notifications/preferences/route.ts:1`
- `src/components/notifications/ReviewNotificationSettings.tsx:1`
- `src/lib/notifications/push/FCMManager.ts:1`

## 16) When You Change Things, Update These
1. `02-PRODUCTION_DOCS/notification_system/NEW_DEVELOPER_ONBOARDING.md`
2. `02-PRODUCTION_DOCS/notification_system/README.md`
3. `02-PRODUCTION_DOCS/README.md` (index)
4. Any affected feature README in `02-PRODUCTION_DOCS/*`

