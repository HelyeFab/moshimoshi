# Kanji Mastery SRS Test Order Randomization Plan

**Status:** DRAFT (for approval)
**Owner:** Engineering
**Last Updated:** 2026-01-28

## 1) Business Need

### Problem
The current Kanji Mastery Round 2 test sequence uses a fixed order per kanji:
`meaning → on'yomi → kun'yomi → recognition` (filtered if readings are missing). This predictable order:
- Encourages pattern-based guessing instead of true recall
- Creates clumping of reading types (on/kun back-to-back)
- Reduces desirable variability across a session
- Can lower long-term retention in spaced repetition contexts

### Objective
Introduce controlled randomization of test order to increase recall fidelity and learner engagement without compromising accuracy scoring or session stability.

### Success Criteria
- Test order varies across kanji but remains stable within a kanji.
- No regression in SRS data integrity (results mapped correctly by test type).
- No UI or state flakiness across re-renders.
- Feature remains backward compatible with existing session flows and analytics.

---

## 2) Proposed Approach (Decision: Option C)

Two viable designs were evaluated; **Option C is selected for implementation**.

### Option C — Session‑Level De‑Clumping (Chosen)
Enforce a rule: the next kanji’s first test must not equal the previous kanji’s last test. This requires session‑level state to track last test type.

**Additional constraint (confirmed):** forbid on'yomi + kun'yomi adjacency within a single kanji’s sequence.

**Pros**
- Stronger variability across the entire session
- Avoids “same first test” streaks
- Better prevents clumped reading‑type tests

**Cons**
- More state coupling across kanji
- Higher risk of regressions if session state resets
- More complex testing and constraints

---

## 3) Implementation Plan (Code Changes)

### Primary Modification Target
`src/app/[locale]/tools/kanji-mastery/learn/components/Round2Test.tsx`

### Option C (Session‑Level De‑Clumping)
1. Add a session‑level state to `LearnContent.tsx` or a session context for `lastTestType`.
2. Pass `lastTestType` into `Round2Test` to influence ordering.
3. After completing a kanji, update `lastTestType` to the final test in that kanji’s sequence.
4. Ensure order is stable within kanji, even if user re-renders or navigates.

### Additional Considerations
- Only randomize in Round 2. Round 1/3 can remain fixed (or be addressed in a follow‑up).
- Must preserve `results` type attribution to ensure correct scoring.

---

## 3a) Implementation Phases (Production Rollout)

### Phase 0 — Design & Alignment
- **Decision:** Ship Option C (session‑level de‑clumping).
- **Constraint:** Forbid on/kun adjacency within a kanji’s test order.
- **Feature flag:** Required for staged rollout (`NEXT_PUBLIC_KANJI_TEST_RANDOMIZE=true`).

### Phase 1 — Core Logic (Non‑UI)
- Extract a pure test sequence builder function.
- Add seeded RNG injection for deterministic tests.
- Add adjacency or de‑clumping constraints based on the chosen option.

### Phase 2 — UI Integration
- Wire the sequence builder into `Round2Test.tsx`.
- Ensure the sequence is generated once per kanji and persisted in state or ref.
- For Option C, thread `lastTestType` through `LearnContent.tsx` or session state.

### Phase 3 — Automated Testing
- Unit tests for the sequence builder (determinism + constraints + edge cases).
- Component tests for order stability and results mapping.
- Optional E2E sanity test in Playwright.

### Phase 4 — QA & Validation
- Manual verification that order changes across kanji.
- Confirm no regressions in scoring and SRS data updates.
- Validate behavior with missing readings (onyomi/kunyomi).

### Phase 5 — Rollout & Monitoring
- Enable feature flag for internal users first.
- Monitor session results for unexpected error spikes.
- Remove flag once validated (if desired).

---

## 4) Testing Strategy

### Unit Tests (Required)
Create a dedicated test suite for sequence generation.

**Target:** `src/app/[locale]/tools/kanji-mastery/learn/__tests__/testOrder.test.ts`

Test cases:
- Meaning + recognition only (no readings) → valid sequence
- Meaning + on + kun + recognition → all types included once
- Deterministic ordering with seeded RNG
- (Optional) no on/kun adjacency if constraint enabled
- (Option C) no repeat of prior kanji’s last test as next kanji’s first

### Component Tests (Recommended)
Target `Round2Test` with a seeded RNG:
- Order is stable across re‑renders
- Order changes when kanji changes
- Results recorded in the same order as displayed

### E2E (Optional)
Playwright smoke test to confirm order varies in a session without errors.

---

## 5) Double‑Check List (Breakage Risks)

- **State stability:** ensure the sequence is generated once per kanji and not reshuffled on re‑render.
- **Result attribution:** make sure `results[i].type` matches the displayed question at that step.
- **Missing readings:** no crashes or empty test arrays when onyomi/kunyomi are missing.
- **Recognition question flow:** if recognition appears first, UI and input flow must still work.
- **Analytics assumptions:** ensure no downstream code expects meaning to be test #1.
- **Session reset:** order should reset only on new kanji, not on minor state updates.

---

## 6) Rollout Plan

1. Implement Option C behind a feature flag (e.g. `NEXT_PUBLIC_KANJI_TEST_RANDOMIZE=true`).
2. Validate in dev + QA with seeded RNG for repeatability.
3. Add unit tests before enabling by default.
4. Remove the flag after Phase 4 validation, if desired.

---

## 7) Owner Notes

Ensure `lastTestType` is stored in session state or a ref that survives component re-renders and doesn’t reset between kanji transitions.

---

## Change Log
- 2026-01-28: Initial plan drafted.
- 2026-01-28: Option C selected, adjacency constraint and feature flag confirmed.
