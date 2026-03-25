# Kanji Browser Study Gating Plan

**Status:** Proposed  
**Date:** 2026-03-25

## Decision Summary

Kanji Browser browsing remains free.

Kanji Browser study should be gated as a **unique kanji unlock** model, not a raw session-count model.

Proposed product rule:

- guests can browse but cannot study
- signed-in free users can unlock and study up to **N unique kanji** in Kanji Browser
- once a kanji is unlocked for study, that user can re-study it without consuming another unit
- premium users can unlock and study **unlimited** kanji

Suggested user-facing wording:

- **Free users can unlock and study up to 10 kanji in Kanji Browser**
- **Unlocked kanji stay available to re-study**
- **Premium unlocks unlimited kanji study**

This is intentionally different from:

- daily session caps
- per-click session consumption
- page-level premium blocking

## Why This Model

This model is better than counting every study session because it:

- feels fairer to learners
- makes interrupted/retried sessions non-punitive
- encourages deeper study of unlocked kanji
- creates a durable free-tier value proposition
- still creates a clean premium upgrade moment

It is also more aligned with the object the user cares about:

- **kanji unlocked for study**

not:

- abstract session units

## Gating Pattern To Use

This should follow the app's **mixed-access / action-level** entitlement pattern.

Do **not** use `EntitlementGate` for this.

Why:

- the Kanji Browser page itself should remain accessible
- only the **Start Study** action should be gated
- this matches the documented pattern in:
  - `02-PRODUCTION_DOCS/entitlements/FEATURE_GUIDE.md`

Implementation style should resemble:

- Kanji Mastery start gating
- Stories list browsing with action-level use
- News item gating with persisted access memory

## New Entitlement

Add a new feature id, separate from the existing `kanji_browser` browse feature.

Recommended id:

- `kanji_browser_study`

Reason:

- `kanji_browser` already describes the browser surface
- study is a different economic object
- browsing and studying must be independently configurable

Recommended limits:

- `guest`: `0`
- `free`: `10` (or configurable)
- `premium_monthly`: `-1`
- `premium_yearly`: `-1`

Recommended limit type:

- `monthly`

Reason:

- this is effectively a **catalog size / unlock cap**
- monthly is the closest fit in the current entitlement system
- daily would be misleading

Note:

- the generic entitlement limit still helps with messaging and policy
- but the actual allow/reuse logic must also consult the user's unlocked kanji set

## Canonical Behavior

### Guest

- can browse the Kanji Browser
- cannot start study
- show sign-in or upgrade/login UX when they tap study

### Free user, studying an already unlocked kanji

- allowed immediately
- no quota consumed

### Free user, studying a new kanji, under limit

- allowed
- atomically:
  - add kanji to unlocked study set
  - increment usage for `kanji_browser_study`

### Free user, studying a new kanji, at limit

- denied
- show upgrade CTA
- still allow study on already unlocked kanji

### Premium user

- always allowed
- no meaningful unlock cap

## Firestore Requirement

This feature should write durable study-unlock state to Firestore for **free and premium users**.

That is an intentional product decision.

Reason:

- fairness depends on remembering which kanji are already unlocked
- local-only storage would be fragile and easy to lose
- cross-device consistency is valuable even for free users here

This is acceptable and consistent with other app areas that already write meaningful learning state for non-premium users.

Reference:

- `src/services/practiceHistory/PracticeHistoryService.ts`
  - explicitly documents Firebase writes for all authenticated users

## Data Model Recommendation

Use a dedicated Firestore doc for Kanji Browser study unlock state.

Recommended shape:

- collection path:
  - `users/{uid}/progress/kanji_browser_study`

Suggested document fields:

```ts
{
  unlockedKanji: string[]
  unlockedCount: number
  lastUnlockedAt: string
  updatedAt: string
}
```

Alternative:

- one doc per unlocked kanji

Not recommended initially because:

- the cap is small for free users
- array-based reads are simpler
- we mainly need fast membership checks and a count

## Atomicity Requirement

For a **new kanji unlock**, the system must atomically do both:

1. increment `kanji_browser_study` usage
2. add the kanji to the unlocked set

This should happen on the server.

Do **not** rely on:

- client-only sequencing
- two independent writes

Otherwise race conditions can:

- spend quota without unlocking the kanji
- unlock the kanji without spending quota
- double-count the same kanji

## Recommended API Flow

Introduce a server route specifically for Kanji Browser study access, for example:

- `POST /api/kanji-browser/study/access`

Request:

```json
{
  "kanji": "見"
}
```

Server behavior:

1. require auth
2. load user plan from Firestore
3. load current unlocked-kanji study state
4. if premium:
   - allow
   - mark unlocked if not already present
5. if kanji already unlocked:
   - allow
   - do not increment usage
6. if kanji not unlocked:
   - evaluate entitlement for `kanji_browser_study`
   - if denied: return deny decision
   - if allowed: atomically increment usage and add kanji to unlocked set

Suggested response:

```json
{
  "allow": true,
  "alreadyUnlocked": false,
  "unlockedCount": 4,
  "remaining": 6,
  "plan": "free"
}
```

## Client Flow Recommendation

At the Kanji Browser study entry point:

1. user taps `Study`
2. client calls Kanji Browser study access API with selected kanji
3. if allowed:
   - start study session
4. if denied:
   - show standard entitlement toast / upgrade CTA

Important:

- do **not** use `checkAndTrack()` directly on the client for this feature
- the server must own the unlock + increment logic because this is a hybrid entitlement + state mutation

## Interaction With Existing Session Model

This gating model should happen **before** the study session is created.

Once a kanji is unlocked:

- refresh
- resume
- revisit
- multi-session restudy

should all work without additional quota consumption.

This is independent of:

- current session persistence in localStorage
- vocabulary exposure tracking
- reading-match completion

Those systems remain unchanged.

## Multi-Kanji Session Rule

If the user selects multiple kanji:

- already unlocked kanji should always be allowed
- new kanji in the selection should count against remaining unlock quota

Recommended initial rule:

- validate the whole selected set up front
- determine:
  - already unlocked
  - newly unlockable
  - denied because over cap

If the number of new kanji exceeds remaining allowance:

- block session start
- tell the user how many additional new kanji they can still unlock

Do **not** partially start a mixed session unless product explicitly wants that.

## UX Copy Recommendations

Avoid talking about “sessions” here.

Prefer:

- **kanji unlocked for study**
- **study slots**
- **unlocked kanji**

Best short copy:

- “Free users can unlock up to 10 kanji for study in Kanji Browser.”
- “Unlocked kanji remain available to re-study.”
- “Upgrade to unlock unlimited kanji study.”

## Comparison To Other Patterns

### Flashcards

- page accessible
- some actions premium-only
- mixed-access model

### Stories / Books / Comics / News

- browsing/list pages accessible
- content access checked with unique-item semantics

### Kanji Mastery / Drill

- action-level start gating
- session-oriented quotas

Kanji Browser study should combine:

- action-level start gating
- unique-item memory

That makes it closest to:

- **news/books/stories unique access**

but applied to:

- **kanji unlocks for study**

## Rollout Recommendation

1. add new feature id to entitlements config
2. regenerate entitlement types
3. add server-side unlock/access API
4. gate Kanji Browser study start on that API
5. show remaining unlock count in browser UI
6. add admin/debug visibility later if needed

## Open Product Questions

1. Is the free cap exactly `10`, or configurable in admin/config only?
2. Should selecting 12 new kanji when 3 remain:
   - hard block
   - auto-trim
   - prompt user to reduce selection?
3. Should premium users also persist unlocked kanji for analytics/history?
   - recommended: yes

## Recommendation

Implement this model.

It is:

- fairer than session charging
- more valuable than a daily cap
- more legible to users
- still monetizable
- consistent with the app's entitlement architecture
