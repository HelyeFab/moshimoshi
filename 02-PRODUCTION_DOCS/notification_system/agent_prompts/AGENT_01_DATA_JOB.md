# Agent 01 — Eligibility & Daily Job

Read `02-PRODUCTION_DOCS/notification_system/agent_prompts/AGENTS_CONTEXT.md` first.

## Mission
Design and implement the daily eligibility job that:
- Runs at 18:00 UTC.
- Determines users who used a feature yesterday (calendar day in user timezone) and not today.
- Produces per-user eligible feature list (top 5 most recent).
- Hands eligible users to the campaign system (custom emails).

## Scope
- Implement server-side batch logic for eligibility.
- Use `page_visits` collection for usage evidence.
- Respect `notifications_preferences` toggles.

## Constraints
- No new libraries.
- Follow existing patterns for scheduled jobs (check `functions/` or existing cron jobs).
- Prefer minimal writes.

## Required Outputs
- Identify the best place for scheduling (Firebase Functions vs Vercel cron).
- File list + key functions added/modified.
- Clear Firestore query strategy (indexes if needed).
- Notes on performance risks.

## Deliverable
A PR-ready change set or patch notes with exact file references.

