# Agent 02 — Preferences Schema + Migration

Read `02-PRODUCTION_DOCS/notification_system/agent_prompts/AGENTS_CONTEXT.md` first.

## Mission
Extend `notifications_preferences` to include feature reminder toggles and ensure existing users default to ON.

## Scope
- Update preference types and defaults in `/api/notifications/preferences`.
- Add migration path for existing users (server-side job or migration script) to ensure feature toggles exist and are ON.
- Ensure global notifications control interacts correctly with feature toggles.

## Constraints
- Follow existing patterns in `src/app/api/notifications/preferences/route.ts`.
- No new libraries.
- Minimal changes.

## Required Outputs
- Exact schema shape.
- Migration strategy and where it runs.
- File list + key diffs.

