# Notification System Release Checklist

Use this checklist before and during production release of the reminder notification system.

## 1. Preflight

- [ ] Confirm branch:
  - `git branch --show-current`
- [ ] Confirm working tree:
  - `git status`

## 2. Code Quality Gate

- [ ] Lint:
  - `npm run lint`
- [ ] Type-check:
  - `npm run type-check`
- [ ] Notifications tests:
  - `npm run test -- __tests__/notifications --runInBand`
- [ ] Campaign service tests:
  - `npm run test -- __tests__/email-campaigns/campaign-service.test.ts --runInBand`

## 3. Deploy Web App (Next.js)

- [ ] Deploy app to production using your normal deploy flow.
- [ ] Confirm this endpoint exists and responds in prod:
  - `GET /api/notifications/reminder-summary`

## 4. Production Environment Variables

- [ ] `CRON_SECRET` is set (strong secret).
- [ ] `APP_URL=https://moshimoshi.app` (or `SERVER_APP_URL=https://moshimoshi.app`).
- [ ] `REMINDER_SUMMARY_TEMPLATE_ID=<prod-template-id>`.
- [ ] `EMAIL_JOURNAL_HASH_SALT=<random-secret-salt>`.

## 5. Seed/Update Reminder Template in Production

- [ ] Point to production service account:
  - `export GOOGLE_APPLICATION_CREDENTIALS='/home/beano/Dev/nextjs/moshimoshi/moshimoshi-service-account.json'`
- [ ] Seed template:
  - `node scripts/seed-reminder-summary-template.mjs`
- [ ] Verify Firestore `email_templates` contains slug:
  - `reminder-summary-daily`
- [ ] Copy that template doc id into `REMINDER_SUMMARY_TEMPLATE_ID`.

## 6. Preferences Migration

- [ ] Dry run migration:
  - `npm run migrate:notifications:feature-reminders -- --dry-run`
- [ ] Execute migration:
  - `npm run migrate:notifications:feature-reminders`
- [ ] Verify `notifications_preferences/{uid}` includes:
  - `feature_reminders.enabled`
  - `feature_reminders.features.{kana,kanji_mastery,flashcards_srs,news,stories,library,vocabulary}`

## 7. Deploy Firebase Functions

- [ ] Deploy scheduler jobs:
  - `firebase deploy --only functions:dailyReminderEligibilityJob,functions:cleanupEmailSendJournal`

## 8. Scheduler Configuration Verification

- [ ] `dailyReminderEligibilityJob` is deployed.
- [ ] Schedule is `0 18 * * *` UTC.
- [ ] Region and secret bindings are correct.
- [ ] `CRON_SECRET` is available to scheduler function.

## 9. API Auth Smoke Test (Prod)

- [ ] Dry-run call succeeds with `200`:
  - `curl -i -H "Authorization: Bearer $CRON_SECRET" "https://moshimoshi.app/api/notifications/reminder-summary?dryRun=1&maxUsers=50"`
- [ ] Response returns non-error JSON counters.

## 10. Controlled End-to-End Send

- [ ] Trigger one small real run:
  - `curl -i -H "Authorization: Bearer $CRON_SECRET" "https://moshimoshi.app/api/notifications/reminder-summary?maxUsers=1"`
- [ ] Verify campaign doc in `email_campaigns`.
- [ ] Verify email delivered and content is correct.
- [ ] Verify CTA links to production:
  - `https://moshimoshi.app/dashboard`

## 11. Privacy Journal Verification

- [ ] `email_send_journal` receives new entries.
- [ ] Entries include minimized fields only:
  - `recipient.emailHash`, `recipient.emailMasked`, `notificationType`, `status`, `sentAt`
- [ ] No raw full recipient email and no full email body stored.

## 12. Retention Verification

- [ ] `cleanupEmailSendJournal` is deployed and scheduled.
- [ ] Optional manual run/log check confirms no runtime errors.

## 13. UX Verification (Prod)

- [ ] Settings master toggle controls feature reminders globally.
- [ ] Per-feature bell respects global gate.
- [ ] Bell appears in both headers where expected.
- [ ] Admin page visible and working:
  - `/admin/email-send-journal`

## 14. Rollback Preparedness

- [ ] Note release commit hash.
- [ ] Note previous stable deploy target.
- [ ] Rollback procedure confirmed for both web app and Firebase Functions.

---

## Final Go/No-Go

- [ ] All sections above checked.
- [ ] Release approved.

