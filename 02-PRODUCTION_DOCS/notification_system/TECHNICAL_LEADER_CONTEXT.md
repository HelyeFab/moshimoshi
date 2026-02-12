# Technical Leader Context - Notification System

## Purpose
Single-source handover for technical leadership on the notification initiative. This document captures where the project stands, what remains, constraints, and release gates.

## Current Branch Reality
- Primary implementation branch: `feature/notification-system`
- Current working branch during cleanup: `main`
- Backup branch exists: `backup/pre-notification-split`

## Scope We Designed
Build a unified reminder system that:
- Detects feature usage from `page_visits`
- Evaluates: used yesterday, not today (user timezone)
- Respects global + per-feature preferences
- Sends one daily summary email (top 5 features)
- Runs on Google/Firebase scheduled functions (18:00 UTC)
- Uses admin email-campaign flow (`email_campaigns`, template-driven)

## What Is Already Built (Feature Branch Work)
1. Scheduled execution
- Firebase scheduled function for daily eligibility trigger exists in `functions/` flow.

2. Reminder job and eligibility engine
- Reminder summary API route and server job exist.
- Eligibility logic for per-user feature summary exists.

3. Preferences model
- `notifications_preferences.feature_reminders` shape was introduced:
  - `enabled`
  - `features` map (`kana`, `kanji_mastery`, `flashcards_srs`, `news`, `stories`, `library`, `vocabulary`)
- Migration/backfill script for existing users was created.

4. UI integration
- Per-feature bell toggle was integrated into shared headers on feature branch.
- Settings gained a master switch for feature reminders.

5. Campaign + template integration
- Reminder summary template seeding path exists for `email_templates`.
- Campaign variable normalization utilities were introduced.

## Where We Stand Now
- Notification documentation set has been imported into `02-PRODUCTION_DOCS/notification_system`.
- Codebase on `main` was partially cleaned to remove direct reminder-toggle coupling from shared headers.
- Some non-notification mixed changes remain on `main` (expected from broader split activity).

## Critical Release Gate
**We have not run a full notification-system test pass end-to-end yet.**

Interpretation for leadership:
- Targeted tests have been run in isolated areas during iteration, but
- No full, explicit, release-grade validation pass has been completed for the notification system as an integrated feature.

Do not mark production-ready until the validation checklist below is completed.

## What Still Needs To Be Accomplished
1. Branch hygiene and deployment source of truth
- Confirm which branch is deploy candidate for notification system.
- Ensure no accidental coupling remains on non-target branches.

2. End-to-end validation (mandatory)
- Run notification-system test suite and adjacent impacted suites.
- Validate scheduler -> API -> eligibility -> campaign creation -> send path.
- Validate settings master toggle and per-feature bell behavior in runtime.

3. Data integrity checks
- Verify migration script behavior in staging snapshot.
- Verify defaults for existing users and new users.
- Verify no preference clobbering.

4. UX verification
- Confirm mobile tooltip rendering in real devices/sizes.
- Confirm disabled-state semantics for bells when master is off.
- Confirm settings labels are final and not duplicated/conflicting.

5. Operational readiness
- Confirm required env vars are set in target environments:
  - `CRON_SECRET`
  - `REMINDER_SUMMARY_TEMPLATE_ID`
  - app URL env used by scheduler/job
- Confirm Firebase scheduler deployment and run logs.

## Known Risks
- Branch split complexity can leak mixed changes into release branch.
- Preference storage architecture differs by user tier; migration correctness must be verified with real data.
- Campaign throughput and scan limits may require tuning under production volume.
- UI state can appear stale without realtime preference propagation if not consistently wired.

## Immediate Next Actions (Recommended Order)
1. Freeze a release candidate branch for notification system.
2. Run full validation checklist (below) and record outcomes.
3. Fix any failures and rerun until green.
4. Only then approve for production.

## Validation Checklist (Must Be Green)
1. Unit/integration tests
- Notification eligibility logic tests
- Campaign service tests
- Preferences route tests (including feature_reminders)

2. API path checks
- `GET/POST /api/notifications/reminder-summary` auth and behavior
- `GET/PUT/POST /api/notifications/preferences` behavior for relevant settings

3. Functional checks (manual)
- Master OFF disables per-feature bell interaction everywhere
- Per-feature ON/OFF preserved when master toggled OFF then ON
- One summary email max/day/user
- Eligible features capped to top 5 and correctly ordered

4. Scheduler checks
- Scheduled function triggers at 18:00 UTC
- No duplicate daily sends per user (campaign idempotency)

5. Template checks
- Reminder template exists and resolves all required variables
- Unsubscribe URL behavior verified

## Definition of Done
Production-ready only when:
- Notification release branch is clean and intentional
- Full validation checklist is green
- Env + scheduler deployment verified
- Leadership review sign-off recorded

