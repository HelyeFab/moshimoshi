# Blast Mode Test Plan (v1)

**Status:** DRAFT
**Last Updated:** 2026-01-29
**Owner:** Tech Lead

---

## Scope & Goals

Ensure Blast Mode is correct across:
- **Core logic** (adapters + step generator)
- **UI components** (MCQ + tiles)
- **Integration** (learn data pipeline)
- **Smoke E2E** (happy path session)

---

## Work Breakdown (Assign to One Agent)

### A) Unit Tests — Core Logic

**Files to add**
- `src/lib/blast-mode/__tests__/step-generator.test.ts`
- `src/lib/blast-mode/__tests__/kanji.adapter.test.ts`
- `src/lib/blast-mode/__tests__/vocab.adapter.test.ts`

**Key cases**
- Step generator:
  - Kanji item with onyomi+kunyomi -> steps: 1,2,3,4,6
  - Kanji item with 3+ readings -> includes step 5
  - Kanji item missing onyomi -> skips onyomi step
  - Vocab item -> only steps 1,2,6
  - Sentence item -> skip reassemble unless `tokens` present
- Kanji adapter:
  - returns `BlastItem` with `contentType='kanji'`, readings set, id prefix
- Vocab adapter:
  - respects JLPT filter when `level` provided
  - falls back when insufficient matches
  - `tokens` is `undefined`

**Mocks required**
- `kanjiService.loadKanjiByLevel`
- `getCommonJMdictWords`

**Acceptance criteria**
- 100% passing tests
- Deterministic step counts
- No network or filesystem access in tests

---

### B) Integration Tests — Learn Data Pipeline

**File to add**
- `src/app/[locale]/tools/blast-mode/learn/__tests__/loadBlastData.test.ts`

**Key cases**
- `contentType=kanji` -> items length == size, steps not empty
- `contentType=vocabulary` -> items length == size, steps only 1,2,6
- `contentType=mixed` -> combines items and shuffles (validate total size)
- Bad level -> graceful fallback without throw

**Acceptance criteria**
- All tests pass
- No React rendering required (test pure async function)

---

### C) UI Component Tests — Agent D Screens

**Files to add**
- `src/components/blast-mode/screens/__tests__/BaseMcqScreen.test.tsx`
- `src/components/blast-mode/screens/__tests__/JpReassemble.test.tsx`

**Key cases**
- BaseMcqScreen:
  - clicking option triggers `onAnswer` after delay
  - keyboard 1–4 selects options
  - disabled state blocks selection
- JpReassemble:
  - duplicates render (tiles with repeated labels)
  - click-to-swap changes order
  - Enter triggers submit and `onAnswer`
  - Reset restores original order

**Acceptance criteria**
- All tests pass
- No act warnings / timer leaks
- Use fake timers for auto-advance

---

### D) E2E Smoke (Optional v1)

**File to add**
- `tests/e2e/blast-mode.spec.ts`

**Flow**
- Open `/tools/blast-mode`
- Start session (kanji, N5, size 2)
- Answer 2–3 steps
- Completion modal appears

**Acceptance criteria**
- End-to-end flow completes without errors

---

## Tooling Expectations

- **Unit/Integration**: Jest + React Testing Library
- **E2E**: Playwright
- Use mock timers for delayed callbacks

---

## Detailed Agent Prompt

```
You are implementing the Blast Mode test suite. Add unit, integration, and UI tests per the plan below. Keep changes minimal and follow existing testing patterns.

Tasks:
1) Unit tests
   - step-generator.test.ts: verify adaptive step sequencing for kanji/vocab/sentence cases.
   - kanji.adapter.test.ts: mock kanjiService and verify BlastItem shape.
   - vocab.adapter.test.ts: mock getCommonJMdictWords, verify JLPT filter and fallback.

2) Integration test
   - loadBlastData.test.ts: validate items length and step types for kanji/vocab/mixed.

3) UI tests
   - BaseMcqScreen.test.tsx: click + keyboard selection, disabled state, uses fake timers.
   - JpReassemble.test.tsx: duplicate tiles render, swap click changes order, Enter submits, Reset restores.

4) (Optional) E2E smoke
   - blast-mode.spec.ts: start session and complete a few steps.

Constraints:
- Use Jest/RTL; no network.
- Mock kanjiService and jmdictLocalSearch.
- Use fake timers for auto-advance.
- Keep tests deterministic.

Acceptance:
- All new tests pass.
- No lint errors.
- Clear naming and minimal fixtures.
```

---

## Suggested Test Data Fixtures (Minimal)

```ts
const mockKanji = {
  kanji: '日',
  meaning: 'sun; day',
  onyomi: ['ニチ'],
  kunyomi: ['ひ'],
  jlpt: 'N5',
  grade: 1
}

const mockVocab = {
  id: '1',
  kanji: '食べる',
  kana: 'たべる',
  meaning: 'to eat',
  jlpt: 'N5',
  type: 'verb'
}
```

---

## Done Definition

- All tests pass locally
- No flaky timers
- Coverage for all adaptive rules
- UI tests verify duplicate tiles safety

