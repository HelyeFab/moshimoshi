# Kanji Browser Study: Agent Overview

**Status:** Implemented and active reference  
**Date:** 2026-03-25

This document is now the shared implementation overview for the live Kanji Browser study gating system.

Read this first, then read the agent-specific briefs only if you are extending or refactoring the system.

## Live Product Model

Kanji Browser study now uses this live model:

- guests can browse but cannot study
- signed-in free users can unlock and study up to 10 unique kanji
- once a kanji is unlocked, it can be re-studied without consuming another unit
- premium users can unlock and study unlimited kanji

Browsing the Kanji Browser remains free.

This is not a session cap.

It is a **unique kanji unlock model**.

## Primary Source Documents

All agents must read:

1. [README.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/entitlements/README.md)
2. [FEATURE_GUIDE.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/entitlements/FEATURE_GUIDE.md)
3. [KANJI_BROWSER_STUDY_GATING_PLAN.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/entitlements/KANJI_BROWSER_STUDY_GATING_PLAN.md)
4. [KANJI_BROWSER_STUDY_MARKETING.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/entitlements/KANJI_BROWSER_STUDY_MARKETING.md)

## Non-Negotiable Product Rules

- do not block the entire Kanji Browser page
- do not use `EntitlementGate` for Kanji Browser study
- gate only the study-start action
- do not use “session limit” language in UX
- use “unlock”, “study slots”, “unlocked kanji”, or “unlimited kanji study”
- do not charge again for already unlocked kanji
- do not rely on local-only storage for unlock state
- free and premium users both persist unlock state to Firestore

## Implemented Architecture

The system is now split across these concerns:

1. entitlement config
2. server/API unlock-or-reuse logic
3. client-side Kanji Browser study gating
4. tests
5. read-only study status for UI
6. Kanji Browser unlock visibility in the browse UI

Do not mix ownership casually.

## Shared Terminology

Use these terms consistently:

- **unlocked kanji**
- **new kanji unlock**
- **already unlocked kanji**
- **kanji study slots**

Avoid:

- session credit
- practice credit
- daily session count

## Live Server Contracts

The client does not decide whether a kanji is already unlocked.

The server must own:

- auth check
- plan check
- unlocked-kanji state lookup
- atomic unlock + usage increment for new kanji

Implemented routes:

- `POST /api/kanji-browser/study/access`
- `POST /api/kanji-browser/study/access/batch`
- `GET /api/kanji-browser/study/status`

Single-kanji request shape:

```json
{
  "kanji": "見"
}
```

Single-kanji response distinguishes:

- allowed
- already unlocked
- newly unlocked
- denied

Batch route behavior:

- accepts a full selected-kanji array
- evaluates all selected kanji together
- if the free cap would be exceeded, denies with zero partial unlocks
- if allowed, unlocks all new kanji atomically

Status route behavior:

- returns `plan`
- returns `unlockedCount`
- returns `unlockedKanji`
- returns `remaining`
- returns `limit`
- returns `isUnlimited`
- returns `canStudy`

The status route is used for:

- the study-slots indicator
- the `Unlocked` filter tab in Kanji Browser

## Multi-Kanji Sessions

This is implemented as all-or-nothing.

- the client asks the batch route for access before starting study
- if the selected set would exceed the free cap, start is blocked cleanly
- no partial unlocks occur on denied batch starts
- already unlocked kanji in the selection are reported separately from new unlocks

If a future implementation wants partial unlock behavior, that must be a deliberate product change, not an accident.

## Existing Patterns To Follow

Closest patterns in the codebase:

- Kanji Mastery: action-level start gating
- Stories: browse remains open, usage awareness at list level
- News: unique-item access model
- Drawing Practice: sub-action gating inside a broader free surface

## Existing Patterns To Avoid

- page-level `EntitlementGate` around the Kanji Browser
- client-only quota logic
- generic session-count gating

## Quality Bar

A correct implementation should satisfy:

- guests can browse but study is blocked
- free users can unlock new kanji until cap
- free users can re-study unlocked kanji after hitting cap
- premium users are effectively unlimited
- no double-consumption for the same kanji
- UX language matches the marketing framing

Additional live invariants:

- free-user cap must be revalidated **inside** the Firestore transaction, not just before it
- batch denial over cap must return without writing partial unlocks
- compact and expanded study-slot indicators must agree on the same server-owned numbers
- the browse UI must let users discover which kanji are unlocked, not just how many

## Files That Matter Most

- `config/features.v1.json`
- `src/app/api/kanji-browser/study/access/route.ts`
- `src/app/api/kanji-browser/study/access/batch/route.ts`
- `src/app/api/kanji-browser/study/status/route.ts`
- `src/app/[locale]/kanji-browser/KanjiBrowserPage.tsx`
- `src/components/kanji/KanjiStudySlotsIndicator.tsx`
- `src/components/learn/LearningPageHeader.tsx`
- `src/app/api/kanji-browser/study/access/__tests__/route.test.ts`
- `src/app/api/kanji-browser/study/access/batch/__tests__/route.test.ts`

## 2026-03-25 UI Follow-Through

The first entitlement implementation was not enough by itself. These follow-up UX changes are now live and should be preserved unless deliberately replaced:

- custom Kanji Study Slots indicator instead of generic quota wording
- compact pill inside `My Kanji Collection` when the collection exists
- full-size slots indicator shown above search when the user has no learned kanji yet
- `All / Unlocked / Learned` browse filter tabs
- `Unlocked` tab is driven by the persisted `unlockedKanji` set from the status route

Important distinction:

- `My Kanji Collection` means **learned**
- `Unlocked` means **re-studyable under the entitlement model**

Do not collapse those concepts into one UI bucket.

## Header Gap Note

There was a pre-existing empty space under the Kanji Browser page header.

Cause:

- `LearningPageHeader` always rendered a spacer for the fixed bottom mode bar when `mode` was present

Current fix:

- the spacer is no longer reserved in `browse` mode, while the fixed mode bar still remains available

If that gap reappears, inspect:

- `src/components/learn/LearningPageHeader.tsx`

before changing page-local margins again.

## Agent Coordination Rules

- do not revert work outside your brief
- do not rename the feature model or user-facing framing
- if your work depends on an API shape, state that shape clearly
- if you must make an assumption, keep it minimal and document it in your result
