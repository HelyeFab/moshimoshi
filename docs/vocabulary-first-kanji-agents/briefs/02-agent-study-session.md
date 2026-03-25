# Agent 2: Study Session Architecture And Persistence

## Overview

We are implementing a vocabulary-first kanji study mode with multiple cards per kanji. The current study session persistence is already sensitive and product-critical.

You own the session architecture for card-level study flow and persistence.

You are not alone in the codebase. Other agents may be working at the same time. Do not revert their changes. Stay inside your assigned files.

## Ownership

Primary ownership:

- `/home/helye/DevProjects/nextjs/moshimoshi/src/app/[locale]/kanji-browser/KanjiBrowserPage.tsx`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/components/kanji/KanjiStudyMode.tsx`

Allowed supporting files:

- `/home/helye/DevProjects/nextjs/moshimoshi/src/types/kanji-study.ts`

## Read First

- `/home/helye/DevProjects/nextjs/moshimoshi/docs/vocabulary-first-kanji-agents/00-feature-overview.md`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/app/[locale]/kanji-browser/KanjiBrowserPage.tsx`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/components/kanji/KanjiStudyMode.tsx`
- `/home/helye/DevProjects/nextjs/moshimoshi/src/components/learn/LearningPageHeader.tsx`
- `/home/helye/DevProjects/nextjs/moshimoshi/docs/kanji-system-architecture.md`

## Goal

Refactor the current kanji study session model so it can represent and persist card-level progress, not just kanji-level position.

## Requirements

- Replace the current “one kanji = one study step” assumption with card-level sequencing.
- Support `traditional` and `vocabulary-first` study modes in session state.
- Make the persisted session schema versioned.
- Preserve current guarantees:
  - refresh survives
  - browser close survives
  - manual exit can resume
  - completion clears the saved session
- Ensure collection study and manual-selection study both behave correctly.
- Avoid corrupting or silently discarding older saved study sessions.

## Non-Goals

- Do not own vocabulary word lookup logic.
- Do not own long-term progress analytics schema beyond what is necessary for session flow.
- Do not own review mode changes.

## Deliverables

1. Card-level session state structure.
2. Persistence / restore logic for the new schema.
3. Migration handling for previous persisted sessions if needed.
4. Clear separation between:
  - saved session exists
  - study UI currently active

## Design Guidance

- Do not rely on partially loaded JLPT level data to restore a session.
- Persist enough card/session payload to restore deterministically.
- Keep the state machine explicit:
  - idle
  - study selection
  - active study
  - suspended saved session

## Questions To Answer In Your Final Notes

- What is the new persisted session schema?
- How are old study sessions handled?
- What are the exact semantics of exit, refresh, resume, and completion?

## Parallelization

This agent can run in parallel with:

- Agent 1
- Agent 6

This agent should finish before:

- Agent 3
- Agent 4
- Agent 5
