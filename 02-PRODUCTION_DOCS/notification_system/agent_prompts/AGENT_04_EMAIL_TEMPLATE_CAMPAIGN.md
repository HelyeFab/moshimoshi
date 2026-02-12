# Agent 04 — Email Template + Campaign Integration

Read `02-PRODUCTION_DOCS/notification_system/agent_prompts/AGENTS_CONTEXT.md` first.

## Mission
Create a new email template in `email_templates` for the reminder summary and align it with the campaign system.

## Scope
- Define the new template (HTML + text) with variables for:
  - userName
  - topFeatures (list of name + url)
  - ctaUrl
- Ensure it can be used by `email_campaigns` (templateId).
- Provide guidance for campaign creation variables.

## Constraints
- Follow existing template patterns and footer/unsubscribe conventions.
- No new libraries.

## Required Outputs
- Template file path(s) or Firestore schema changes if templates are stored in DB.
- Variable list and example payload.
- Any updates needed in admin UI for template selection.

