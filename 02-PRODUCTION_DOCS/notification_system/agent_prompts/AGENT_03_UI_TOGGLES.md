# Agent 03 — UI Toggles in Headers

Read `02-PRODUCTION_DOCS/notification_system/agent_prompts/AGENTS_CONTEXT.md` first.

## Mission
Add feature reminder toggle UI to both `pageHeader` and `learningPageHeader` components and wire them to `notifications_preferences`.

## Scope
- Locate `pageHeader` and `learningPageHeader` components.
- Add a feature-specific toggle in each, default ON.
- Ensure toggles read/write `notifications_preferences.feature_reminders.features[featureKey]`.
- Feature key should be derived from the page context or passed in.

## Constraints
- Follow existing UI patterns (settings toggle, switches).
- Do not introduce new libraries.
- Avoid breaking existing header layouts.

## Required Outputs
- File paths + key component changes.
- How featureKey is determined.
- Any i18n string additions.

