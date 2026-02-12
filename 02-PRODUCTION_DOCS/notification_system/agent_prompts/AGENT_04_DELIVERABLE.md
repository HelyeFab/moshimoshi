# Agent 04 Deliverable — Email Template + Campaign

## 1) Where the template lives
- Storage: Firestore collection `email_templates`.
- Canonical slug: `reminder-summary-daily`.
- Seed script added: `scripts/seed-reminder-summary-template.mjs`.
- Job expectation: `src/lib/notifications/reminder-summary/job.ts` reads `REMINDER_SUMMARY_TEMPLATE_ID` and creates campaigns with `template: 'custom'` + `templateId`.

## 2) Template variables + sample payload
Required variables:
- `userName` (string)
- `topFeatures` (stringified JSON array of `{ name, url }`)
- `ctaUrl` (url)

Supporting variables (auto-derived or optional override):
- `topFeaturesHtml` (string, auto-built from `topFeatures` if omitted)
- `topFeaturesText` (string, auto-built from `topFeatures` if omitted)
- `summaryDate` (string/date)
- `unsubscribeUrl` (system variable)

Sample `templateVariables` payload:
```json
{
  "userName": "Learner",
  "topFeatures": "[{\"name\":\"Kana Practice\",\"url\":\"https://moshimoshi.app/learn/hiragana\"},{\"name\":\"Flashcards & SRS\",\"url\":\"https://moshimoshi.app/review\"}]",
  "ctaUrl": "https://moshimoshi.app/review",
  "summaryDate": "2026-02-12"
}
```

## 3) How campaign is created with `templateId` + variables
Reminder summary job path:
1. Eligibility is computed from `page_visits`.
2. Job creates per-user campaign docs in `email_campaigns`.
3. Campaign payload includes:
   - `template: 'custom'`
   - `templateId: process.env.REMINDER_SUMMARY_TEMPLATE_ID`
   - `templateVariables` (payload above + user-specific values)
   - `segment.type: 'custom_emails'` with one recipient.
4. `CampaignService` renders the custom template and substitutes variables.

Files:
- `src/lib/notifications/reminder-summary/job.ts`
- `src/lib/email/campaigns/service.ts`
- `src/lib/email/campaigns/template-variables.ts` (new variable normalization for `topFeatures`)

## 4) Admin UI changes required
Implemented in campaign modal:
- Added JSON editor for `templateVariables` when custom template is selected.
- Added template required-variable hints based on selected Firestore template schema.
- Added reminder-summary helper banner with one-click sample payload insert.

Files:
- `src/app/[locale]/admin/email-campaigns/page.tsx`
- `src/app/api/admin/campaigns/[id]/email-preview/route.ts` (uses normalized variables in preview)
- `src/app/api/admin/campaigns/[id]/send-test/route.ts` (uses normalized variables in test-send)
