# Drill Word Resolver AI Fallback (Plan + Implementation Status)

**Status:** Implemented (All agents complete)
**Owner:** Conjugation Drill / AI Infrastructure
**Scope:** Add AI-assisted word resolution fallback for drill `Focus Word` mode (and other uncertain drill resolution paths) with Firebase cache
**Last Updated:** 2026-02-26

---

## 1. Problem Statement

`Focus Word` mode (and potentially other drill flows) can fail to resolve uncommon words when local JMdict subset lookup fails.

Example failure mode:

- User enters a valid conjugatable word not present in `jmdict-eng-common.json`
- System falls back to raw pattern detection
- Ambiguous `-る` verbs can be misclassified (e.g. defaulted to Ichidan)
- Conjugation engine receives wrong type and generates wrong forms

### Key Insight

The conjugation engine is usually correct **given correct metadata**.

The weak link is **word resolution / type detection under incomplete dictionary coverage**.

---

## 2. Goal

Add a **minimal dedicated AI processor** that resolves drill words when JMdict results are missing or uncertain, and cache results in **Firebase** so the same word does not trigger repeated AI calls.

---

## 3. Non-Goals (for phase 1)

- Replacing JMdict as the primary source
- Generating conjugation forms via AI
- Building a generic “AI dictionary” product feature
- Backfilling all vocabulary with AI metadata
- UI redesign for focus mode (only small messaging changes if needed)

---

## 4. Minimal Architecture (Recommended)

### New components

1. **`DrillWordResolverProcessor`**
- Dedicated AI processor (small structured output)
- Resolves:
  - reading (hiragana)
  - POS classification
  - conjugation type
  - confidence
  - optional meaning

2. **`DrillWordResolverProcessorHybrid`** (recommended in phase 1)
- Uses provider selection / fallback pattern similar to `WordExplainerProcessorHybrid`
- Keeps operations consistent with existing AI processor ecosystem

3. **Firebase cache helper (server utility)**
- Reads/writes cached AI drill word resolutions
- Shared by drill API

4. **Drill API integration**
- Insert into `/api/drill/session` `focus` fallback path only when JMdict result is missing or uncertain

### Existing components reused

- `BaseProcessor`
- AI provider config / health / Ollama client
- `QuestionGenerator`
- `ExtendedConjugationEngine`
- `detectWordType`

---

## 5. Resolution Order (Final Behavior)

For `Focus Word` mode in `POST /api/drill/session`:

1. Use `focusWordSelection` (exact user-selected JMdict entry) if valid
2. Search local JMdict + classify with `detectWordType(..., partsOfSpeech)`
3. If unresolved or low-confidence:
   - Check Firebase cache (`drill_word_resolutions`)
4. If cache miss:
   - Call AI `DrillWordResolverProcessor(Hybrid)`
   - Validate structured output
   - Write result to Firebase cache
5. If still low-confidence / ambiguous:
   - Return safe error or warning instead of silently guessing

---

## 6. What “Uncertain” Means (Phase 1 Rules)

Trigger AI fallback when any of these are true:

- No JMdict match
- JMdict matches exist but none classify as conjugatable
- Result is conjugatable but detector confidence is `low`
- Ambiguous `-る` verb with no reliable reading/POS
- Selected or searched word lacks usable kana

Do **not** call AI when:

- Selected JMdict entry is present and classification is valid/high-confidence
- Search returns a valid conjugatable match with reliable kana/POS and medium/high confidence

---

## 7. AI Processor Contract (Phase 1)

## Input (minimal)

```ts
type DrillWordResolverRequest = {
  surface: string;              // user input
  mode: 'focus_word_fallback';
  contextSentence?: string;     // optional future support
  locale?: string;              // optional, mostly for debugging
};
```

## Output (strict structured JSON)

```ts
type DrillWordResolverResult = {
  surface: string;
  lemma: string;                // dictionary form
  reading: string;              // hiragana
  meaning?: string;
  partOfSpeech: 'verb' | 'i-adjective' | 'na-adjective' | 'other';
  conjugationType: 'Ichidan' | 'Godan' | 'Irregular' | 'i-adjective' | 'na-adjective' | null;
  confidence: 'high' | 'medium' | 'low';
  alternatives?: Array<{
    lemma: string;
    reading: string;
    conjugationType: 'Ichidan' | 'Godan' | 'Irregular' | 'i-adjective' | 'na-adjective' | null;
    meaning?: string;
  }>;
  notes?: string;               // short operational note, optional
};
```

### Safety rule

AI result is **metadata only**.

The system must continue to generate conjugations using the existing conjugation engine.

---

## 8. Firebase Cache Design (Phase 1)

## Collection

- `drill_word_resolutions`

## Document ID

Use a deterministic normalized key from user input (example):

- `focus:灯る`
- `focus:ともる`

Normalization (recommended):

- trim
- Unicode normalize (`NFKC`)
- preserve Japanese case (no lowercase transform for Japanese)
- lowercase only Latin text

## Suggested document shape

```ts
{
  key: "focus:灯る",
  query: {
    surface: "灯る",
    mode: "focus_word_fallback"
  },
  result: {
    surface: "灯る",
    lemma: "灯る",
    reading: "ともる",
    meaning: "to be lit; to come on (a light)",
    partOfSpeech: "verb",
    conjugationType: "Godan",
    confidence: "high",
    alternatives: [],
    notes: "AI fallback due to missing JMdict common entry"
  },
  source: {
    type: "ai",
    provider: "ollama" | "openai",
    model: "..."
  },
  cacheVersion: 1,
  status: "resolved",           // or "unresolved"
  hitCount: 3,
  createdAt: serverTimestamp,
  updatedAt: serverTimestamp,
  lastUsedAt: serverTimestamp
}
```

### Negative cache (optional in phase 1)

Allow storing unresolved results:

- `status: "unresolved"`
- short TTL behavior enforced by app logic (e.g. ignore if older than 7 days)

This prevents repeated expensive calls for junk input.

---

## 9. API Integration Points

Primary target:

- `src/app/api/drill/session/route.ts`

Integration branch:

- `mode === 'focus'`
- after JMdict resolution path fails or returns only uncertain candidates
- before final raw pattern fallback (or replacing raw fallback for ambiguous cases)

### Recommended session debug metadata (optional)

Add internal logging and/or debug metadata for source provenance:

- `selected_jmdict`
- `searched_jmdict`
- `firebase_ai_cache`
- `ai_live`
- `raw_fallback`

This dramatically improves support/debugging.

---

## 10. Testing Strategy (Phase 1)

## Unit tests

1. **Cache key normalization**
- Japanese input
- Latin input casing
- whitespace normalization

2. **Firebase cache helper**
- hit / miss / write / hitCount increment

3. **AI result validation**
- reject malformed output
- reject invalid `conjugationType`
- reject missing reading when `verb`/adjective claimed with high confidence

## API route tests (`/api/drill/session`)

1. Uses Firebase cache result when JMdict fails
2. Calls AI and writes cache on cache miss
3. Rejects low-confidence ambiguous result (no silent Ichidan fallback)
4. Still bypasses AI when selected JMdict entry is valid

## Optional integration tests (later)

- `灯る` end-to-end Focus mode flow (search fail -> AI cache/live -> correct Godan)

---

## 11. Rollout Plan

### Phase 1 (Minimal production-safe)

- Implement processor + hybrid wrapper
- Implement Firebase cache helper
- Wire into `Focus Word` fallback only
- Add route tests + cache helper tests
- Add logging and source provenance

### Phase 2 (Expansion)

- Reuse resolver for `My Lists` / `Random` edge-case unknown words
- Add admin/debug tooling to inspect `drill_word_resolutions`
- Add pre-warm / batch enrichment for frequently failed focus queries

---

## 12. Risks and Mitigations

### Risk: AI hallucinated reading/type
Mitigation:
- strict schema validation
- confidence gating
- no AI-generated conjugations
- optional human-review logging for low-confidence cases

### Risk: Cost / latency spikes
Mitigation:
- Firebase cache first
- small prompt / minimal output schema
- provider fallback
- negative caching for repeated invalid inputs

### Risk: Silent regressions
Mitigation:
- source provenance logging
- route tests for resolution order
- explicit “unverified” / error path for low confidence

---

## 13. Agent Work Split (Recommended)

Use **4 agents**. This is enough to parallelize effectively without fragmenting ownership.

### Agent 1: AI Processor Implementation

**Scope**
- Create `DrillWordResolverProcessor`
- Create `DrillWordResolverProcessorHybrid` (recommended)
- Add schema/type definitions for structured output
- Keep prompts minimal and deterministic

**Deliverables**
- Processor files
- Zod schema(s)
- Unit tests for parse/validation behavior
- Brief docs/comments on prompt contract

**Acceptance Criteria**
- Structured output validates strictly
- Supports provider fallback (if hybrid implemented)
- No conjugation generation in processor output
- Returns confidence and reading

**Out of Scope**
- Firebase cache
- Drill API integration
- UI changes

### Agent 2: Firebase Cache + Server Utility Layer

**Scope**
- Implement `drill_word_resolutions` cache helper(s)
- Deterministic cache key normalization
- Read/write/update hit count
- Optional unresolved/negative cache support

**Deliverables**
- Server utility module(s)
- Unit tests for cache key + read/write behavior (mocked Firestore)
- Documentation comments for schema/versioning

**Acceptance Criteria**
- Stable cache key generation
- Handles cache miss/hit/update cleanly
- Safe merges (no undefined values written)

**Out of Scope**
- AI processor prompt logic
- Drill API route behavior changes

### Agent 3: Drill API Integration + Behavior Guardrails

**Scope**
- Integrate resolver + Firebase cache into `POST /api/drill/session` focus mode path
- Implement “uncertain -> AI” trigger logic
- Add safe handling for low-confidence ambiguous AI responses
- Add source provenance logging/debug metadata

**Deliverables**
- Route changes
- Route tests (cache hit, cache miss + AI call, low-confidence reject, JMdict bypass)

**Acceptance Criteria**
- No repeated AI call when cache exists
- Correct resolution order preserved
- Raw fallback no longer silently defaults ambiguous `-る` words in focus mode when AI/cache can resolve

**Out of Scope**
- Processor internals
- Cache helper implementation details (except usage)

### Agent 4: Documentation + QA/Review Harness

**Scope**
- Update production docs in `02-PRODUCTION_DOCS/content-generation/`
- Add drill-specific integration doc (AI fallback architecture, cache schema, ops)
- Add runbook/troubleshooting notes
- Optional test matrix / manual QA checklist

**Deliverables**
- This plan doc updated to “implemented” sections after merge
- New/updated docs in `content-generation/` and/or `conjugation-drill/`
- QA checklist for focus mode uncommon words

**Acceptance Criteria**
- Docs reflect actual final code paths and file references
- Includes operational debugging steps (cache hit/miss, provider source)
- Includes failure handling behavior

**Out of Scope**
- Code implementation (except doc-only changes)

---

## 14. Review / Approval Workflow (Lead Agent)

As lead reviewer, approve/reject per agent using this checklist:

### General reject conditions (all agents)

- Adds AI-generated conjugation forms into drill runtime path
- No schema validation for AI output
- Writes `undefined` to Firestore
- Breaks existing JMdict-first resolution order
- No tests for changed behavior

### Agent-specific review focus

**Agent 1**
- Output schema is minimal and useful
- Prompt does not over-request irrelevant fields
- Confidence semantics are clear and enforced

**Agent 2**
- Cache key normalization is deterministic and documented
- Firestore writes are merge-safe and versioned
- Hit count / timestamps updated correctly

**Agent 3**
- AI is only called on uncertain cases
- Cache checked before AI call
- Low-confidence responses do not silently proceed
- Existing focus-selection path still wins

**Agent 4**
- Docs match code realities (not aspirational)
- Troubleshooting covers cache + provider + route branches

---

## 15. Suggested Execution Order

To minimize blocking while maximizing parallel work:

1. **Agent 1** and **Agent 2** in parallel
2. **Agent 3** starts once Agent 1+2 contracts are stable
3. **Agent 4** drafts docs early, finalizes after Agent 3 merge

---

## 16. Decisions (Locked for Phase 1)

1. **Failure behavior:** Block with an error on low-confidence ambiguous AI resolution (no user override in phase 1)
2. **Provider order:** `Ollama/Qwen` first, fallback to `OpenAI`
3. **Cache scope:** Global shared Firebase cache
4. **Retention:** Indefinite (no TTL cleanup in phase 1)
5. **Scope:** `Focus Word` mode only

---

## 17. Final Phase 1 Decision Summary

Phase 1 implementation is locked to:

- `Focus Word` only
- `DrillWordResolverProcessorHybrid`
- `Ollama/Qwen` primary, `OpenAI` fallback
- Global Firebase cache (`drill_word_resolutions`)
- Indefinite cache retention
- Strict confidence gating (block low-confidence ambiguous cases)

This is the smallest implementation that materially improves correctness for real users while keeping runtime cost under control.

---

## 18. Implementation Status (2026-02-26)

### Agent 1: AI Processor — COMPLETE

Delivered files:

| File | Purpose |
|------|---------|
| `src/lib/ai/processors/DrillWordResolverProcessor.ts` | OpenAI processor (structured outputs, temp 0.3, 500 max tokens) |
| `src/lib/ai/processors/DrillWordResolverProcessorHybrid.ts` | Hybrid wrapper — Ollama/Qwen primary, OpenAI fallback |
| `src/lib/ai/schemas/drill-word-resolver.schema.ts` | Zod schemas with `superRefine` semantic consistency checks |
| `src/lib/ai/processors/__tests__/DrillWordResolverProcessor.test.ts` | Unit tests for validation, parsing, schema rejection |

Key implementation details:

- **Schema enforces POS ↔ conjugationType consistency** via `superRefine`:
  - `verb` requires `Ichidan | Godan | Irregular`
  - `i-adjective` requires `i-adjective`
  - `na-adjective` requires `na-adjective`
  - `noun/adverb/particle/other` requires `null`
- **Two schema variants**:
  - `DrillWordResolverResultSchema` — strict, `.nullable()` for OpenAI Structured Outputs compatibility
  - `DrillWordResolverResultLenientSchema` — `.nullish()` for Ollama (missing fields tolerated)
- **Request type**: `{ word: string; context?: string }` (simplified from plan's `surface`/`mode`)
- **Processor validates**: word must be non-empty string, ≤100 characters
- **System prompt explicitly forbids conjugation generation**

### Agent 2: Firebase Cache — COMPLETE

Delivered files:

| File | Purpose |
|------|---------|
| `src/lib/drill/server/drill-word-resolution-cache.ts` | Cache helper with `get`, `setResolved`, `setUnresolved`, `touchHit` |
| `src/lib/drill/server/__tests__/drill-word-resolution-cache.test.ts` | 25 tests covering key normalization, CRUD, overwrite preservation |

Key implementation details vs plan:

| Plan assumption | Actual implementation |
|---|---|
| Key format: `focus:灯る` | SHA-256 hex of normalized query (64-char hex string) |
| Key normalization preserves Japanese case | Full lowercase applied (Japanese casing is not meaningful) |
| `query` field is an object `{ surface, mode }` | `query` is a plain string (the raw user input) |
| `source` is an object `{ type, provider, model }` | `source` is a typed union: `'ollama' \| 'openai'` |
| Negative cache has short TTL | Indefinite retention (no TTL, as locked for phase 1) |
| `hitCount` resets on overwrite | `createdAt` and `hitCount` preserved on re-resolve writes |

Actual Firestore document shape (collection: `drill_word_resolutions`):

```ts
interface DrillWordResolutionDoc {
  key: string                              // SHA-256 hex of normalized query
  query: string                            // Original user query string
  result: DrillWordResolutionResult | null // AI output (null if unresolved)
  source: 'ollama' | 'openai'             // Provider that produced the result
  status: 'resolved' | 'unresolved'
  cacheVersion: 1
  hitCount: number                         // Preserved across overwrites
  createdAt: Timestamp                     // Preserved across overwrites
  updatedAt: Timestamp
  lastUsedAt: Timestamp
}

interface DrillWordResolutionResult {
  surface: string
  lemma: string
  reading: string
  meaning?: string
  partOfSpeech: PartOfSpeech              // Typed union, not raw string
  conjugationType: WordType               // Reuses WordType from drill types
  confidence: 'high' | 'medium' | 'low'
  alternatives?: string[]
  notes?: string
}
```

Cache key normalization steps:
1. Trim whitespace
2. NFKC Unicode normalize (collapses fullwidth → halfwidth katakana, etc.)
3. Lowercase
4. SHA-256 hex digest

### Agent 3: Drill API Integration — COMPLETE

Delivered changes in `src/app/api/drill/session/route.ts`:

- **Source provenance tracking** via `resolutionSource` variable (line 378)
- **JMdict low-confidence filtering**: `detected.confidence !== 'low'` rejects uncertain JMdict matches (line 398)
- **Firebase cache lookup** (step 3, line 414): checks `drill_word_resolutions` before calling AI
  - `status === 'unresolved'` → blocks immediately with `NOT_CONJUGATABLE`
  - `status === 'resolved'` with valid conjugatable result and non-low confidence → uses cached metadata
  - Calls `touchHit()` fire-and-forget on cache hit
- **Live AI call** (step 4, line 453): invokes `resolveWordViaAI()` → `DrillWordResolverProcessorHybrid`
  - Low-confidence results: **not cached, not used** (line 461)
  - Conjugatable results: used and cached via `setResolved()` (line 475)
  - Non-conjugatable results: cached as unresolved via `setUnresolved()` (line 483)
- **Block** (step 5, line 490): returns `NOT_CONJUGATABLE` if no resolution succeeded
- **Raw pattern detection removed** from focus mode path — no longer falls back to `detectWordType(input, input)`
- Helper functions added: `resolveWordViaAI()` (line 639), `mapAIResultToCacheFormat()` (line 664)
- Resolution source logged on success: `[Drill API] Focus word found: X Godan (source: ai_live)` (line 504)

### Agent 4: Documentation — COMPLETE

Delivered:
- `02-PRODUCTION_DOCS/conjugation-drill/FOCUS_MODE_AND_CONJUGATION_ENGINE.md` — updated with implemented AI fallback section and resolution order
- `02-PRODUCTION_DOCS/conjugation-drill/DRILL_AI_FALLBACK_RUNBOOK.md` — new QA checklist, cache schema reference, and troubleshooting guide
- `02-PRODUCTION_DOCS/content-generation/README.md` — updated index with runbook link
- This file (section 18) — implementation status for all agents
