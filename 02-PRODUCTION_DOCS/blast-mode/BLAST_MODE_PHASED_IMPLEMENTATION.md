# Blast Mode Phased Implementation

**Status:** COMPLETE
**Last Updated:** 2026-02-01
**Owner:** Tech Lead

---

## Phase 0 — Discovery + Spec Lock (1–2 days)

**Goal:** Freeze requirements and edge-case policy.

**Deliverables**
- Finalized screen sequence + adaptive rules.
- Data model (`BlastItem`, `BlastStep`) agreed.
- Content source priority matrix (kanji/vocab/list/sentence).

**Decisions**
- Separate flow like Kanji Mastery.
- No typing, no timers in v1.
- Onyomi/kunyomi mandatory when available.

---

## Phase 1 — Foundation (Core Flow) (3–5 days)

**Goal:** Working flow with minimal UX, single content type.

**Scope**
- New routes:
  - `src/app/[locale]/tools/blast-mode/page.tsx`
  - `src/app/[locale]/tools/blast-mode/learn/page.tsx`
- Step generator (fixed sequence + adaptive skips).
- Simple MCQ renderer + tile renderer.
- Event Hub emission for session completion.

**Minimum Content**
- Kanji only (uses kanjiService + readings).

**Acceptance Criteria**
- Can complete a full kanji session end-to-end.
- Screens adapt (skip missing readings).
- Session completion emits event with accuracy stats.

---

## Phase 2 — Content Expansion (5–8 days)

**Goal:** Support vocab, lists, kana-only items.

**Scope**
- Adapters:
  - Vocabulary -> BlastItem
  - List item -> BlastItem
- Distractor pool service:
  - Kanji pool by JLPT/grade
  - Vocab pool via JMdict
  - List pool via list context
- Tile splitter service:
  - Morpheme split (heuristic)
  - Kana chunk fallback
  - Kanji character fallback

**Acceptance Criteria**
- Vocab and list items run with valid screens.
- Reading screens only appear when onyomi/kunyomi available.
- MCQ distractors non-trivial and stable.

---

## Phase 3 — UX + Polish (3–6 days)

**Goal:** Make it feel fast, clear, and consistent.

**Scope**
- Visual step indicator (e.g., 1/6).
- Tile interactions: drag + click reorder.
- Accessibility (keyboard support for tiles + options).
- Improved feedback (correct/incorrect states, subtle hints).

**Acceptance Criteria**
- Fully navigable without mouse.
- Clear feedback on correctness.
- No layout shifts across screens.

---

## Phase 4 — Analytics + Optimization (2–4 days)

**Goal:** Measure effectiveness and stabilize.

**Scope**
- Completion metrics per screen.
- Drop-off tracking per step type.
- Distractor error rate logging.

**Acceptance Criteria**
- Analytics emitted per step type and per item.
- Admin dashboards can view blast session stats.

---

## Optional Phase 5 — Extensions

- Audio hints or listening mode.
- Adaptive difficulty scaling.
- Per-item mastery suggestions.

---

## Testing Strategy

- Unit tests: step generation, tile splitting, distractor selection.
- Integration tests: kanji/vocab/list adapter pipelines.
- E2E: 1 full session per content type.

---

## Technical Lead Notes

- Favor adapter-driven design over branching logic in UI.
- Keep step generation deterministic for testability.
- Avoid coupling Blast Mode to ReviewSessionUI internals; only use Event Hub.

