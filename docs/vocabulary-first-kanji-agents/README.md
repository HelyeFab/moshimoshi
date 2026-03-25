# Vocabulary-First Kanji Docs

This folder now has three separate purposes:

- `TECHNICAL_ONBOARDING.md`
  - the fastest way to understand the live feature
  - start here if you need to work on the system today
- `CURATION_RULES.md`
  - editorial rules for choosing or overriding vocabulary examples
  - read before dispatching JLPT-level curation work
- `OVERRIDE_SCHEMA.md`
  - code-level contract for curated overrides
  - read before editing override data
- `briefs/`
  - original agent dispatch prompts used to build the feature
  - useful for historical intent and ownership boundaries
- `curation-briefs/`
  - JLPT-level editorial prompts for override work
- `curation-proposals/STATUS.md`
  - review tracker for JLPT-level curation proposals
  - records which proposals are approved, pending, or rejected for revision
- `qa/`
  - testing, rollout, and manual validation docs
- `implementation-history/`
  - agent deliverables, review notes, and revision history
  - archival reference, not the primary source of truth

## Read Order

If you are new to the subsystem:

1. `TECHNICAL_ONBOARDING.md`
2. `CURATION_RULES.md` if your work touches vocabulary quality
3. `OVERRIDE_SCHEMA.md` if your work touches curated overrides
4. `briefs/00-feature-overview.md`
5. the code files listed in the onboarding doc
6. `qa/QA_CHECKLIST.md` before manual testing

## Source Of Truth

For current behavior, prefer:

- live code in `src/`
- `TECHNICAL_ONBOARDING.md`

Do not assume older deliverable docs are fully current without checking code. Several files in `implementation-history/` document intermediate states and review cycles.
