# Drill AI Fallback: QA Runbook and Troubleshooting

**Status:** Reference document for QA and ops
**Last updated:** 2026-02-26

> All components are implemented and integrated. The AI fallback + Firebase cache path is live in `POST /api/drill/session` focus mode.

---

## 0. Today's Additions (2026-02-26)

These items were implemented after the initial AI fallback rollout and are part of the current production-ready Focus Word flow:

- **Rules modal now has two explanation layers**
  - `📐 Pattern` (mechanical transformation) from `ExtendedConjugationEngine.getConjugationRule(...)`
  - `🧠 When it's used` (pedagogical usage note) from `getConjugationUsageNote(...)`
- **Usage-note coverage is now full (104/104 forms)**
  - No drill forms are excluded due to missing usage explanations
  - `RAW_USAGE_NOTES` now contains explicit reviewed entries for all 104 forms
- **QuestionGenerator type-trust fix**
  - When the Focus pipeline has already resolved a valid `word.type` (e.g. `Godan`), question generation now trusts it instead of re-detecting and potentially flipping the type
  - This fixed the `灯る` -> `Ichidan` regression in the Rules modal path
- **Focus input UX no longer shows a premature “No conjugatable words found” panel**
  - No suggestions while typing is not treated as failure
  - Failure is determined only by the server resolution pipeline (JMdict -> cache -> AI -> confidence gate)
- **Firestore session write sanitization**
  - The route now sanitizes the `drillSession` document before saving to Firestore
  - This fixed a local/runtime `500` caused by `wordTypeFilter: undefined` in Focus sessions
- **Focus mode entitlement split**
  - Focus Word now uses a dedicated entitlement feature: `drill_focus_mode`
  - Quotas: `guest=5/day`, `free=5/day`, `premium=-1` (unlimited)
  - Other drill modes continue using `conjugation_drill`
  - Client drill-start denial uses the standard entitlement toast + upgrade action CTA

---

## 0.1 Entitlement Wiring (Focus Mode)

Focus mode is enforced as a separate daily quota from the main conjugation drill entitlement.

### Feature mapping

- `mode === 'focus'` -> `drill_focus_mode`
- `mode !== 'focus'` -> `conjugation_drill`

### Where enforced

- **Client pre-check + usage indicator switching:** `src/app/[locale]/drill/page.tsx`
- **Server entitlement check + usage increment:** `src/app/api/drill/session/route.ts`

### Practical QA implications

- A user can exhaust `drill_focus_mode` while still having `conjugation_drill` quota remaining (and vice versa).
- Focus mode quota denial should show the standard entitlement toast with upgrade CTA (not just a generic alert).

---

## 1. Architecture: Resolution Order

When a user starts a Focus Word drill via `POST /api/drill/session` with `mode: 'focus'`, the route resolves the target word through these steps in order:

```
Step 1  focusWordSelection         Client sends exact JMdict entry           (route.ts:381)
        ↓ not available or invalid
Step 2  JMdict server search       searchJMdictWords() + detectWordType()   (route.ts:389)
        │                          Rejects low-confidence matches
        ↓ no conjugatable match with medium/high confidence
Step 3  Firebase cache lookup      resolutionCache.get(trimmedWord)          (route.ts:414)
        │                          ├─ unresolved → block immediately
        │                          └─ resolved + conjugatable + non-low → use it
        ↓ cache miss
Step 4  Live AI call               DrillWordResolverProcessorHybrid          (route.ts:453)
        │                          ├─ low confidence → skip (NOT cached)
        │                          ├─ conjugatable → use + cache via setResolved()
        │                          └─ non-conjugatable → cache via setUnresolved()
        ↓ still no target word
Step 5  Block                      Return NOT_CONJUGATABLE error             (route.ts:490)
```

Raw pattern detection (`detectWordType(input, input)` with no POS) is **not used** in the focus mode path. If JMdict cannot resolve the word, the system falls through to cache/AI rather than guessing.

### Source provenance labels

Each focus mode resolution is logged with a `resolutionSource` label:

| Label | Meaning | Logged at |
|-------|---------|-----------|
| `selected_jmdict` | Client sent a `focusWordSelection` and it was valid | route.ts:384 |
| `searched_jmdict` | Server JMdict search produced a conjugatable, non-low-confidence match | route.ts:408 |
| `firebase_ai_cache` | Result served from `drill_word_resolutions` cache | route.ts:443 |
| `ai_live` | Fresh AI call via `DrillWordResolverProcessorHybrid` | route.ts:473 |

Log line format: `[Drill API] Focus word found: 灯る Godan (source: ai_live)`

---

## 2. Firebase Cache Schema

**Collection:** `drill_word_resolutions`

**Document ID:** SHA-256 hex hash of the normalized query (64-character lowercase hex string).

### Key normalization

Function: `normalizeKey()` in `src/lib/drill/server/drill-word-resolution-cache.ts`

```
Input: "  食べる  "
  → trim:      "食べる"
  → NFKC:      "食べる"       (collapses fullwidth katakana, etc.)
  → lowercase: "食べる"       (no-op for Japanese)
  → SHA-256:   "a1b2c3d4..."  (deterministic 64-char hex)
```

Important: identical words always produce the same key regardless of leading/trailing whitespace, fullwidth/halfwidth form, or Latin casing.

### Document fields

| Field | Type | Description |
|-------|------|-------------|
| `key` | `string` | The SHA-256 hex key (also the document ID) |
| `query` | `string` | Original user query string (before normalization) |
| `result` | `object \| null` | AI resolution output; `null` if `status === 'unresolved'` |
| `source` | `'ollama' \| 'openai'` | Which AI provider produced this result |
| `status` | `'resolved' \| 'unresolved'` | Whether AI successfully resolved the word |
| `cacheVersion` | `number` | Always `1` in phase 1 (for future migrations) |
| `hitCount` | `number` | How many times this entry has been used |
| `createdAt` | `Timestamp` | When this entry was first created (preserved on overwrite) |
| `updatedAt` | `Timestamp` | When the result was last written |
| `lastUsedAt` | `Timestamp` | When `touchHit()` was last called |

### Result fields (when `status === 'resolved'`)

| Field | Type | Description |
|-------|------|-------------|
| `surface` | `string` | Input surface form |
| `lemma` | `string` | Dictionary form (e.g. `食べる` not `食べて`) |
| `reading` | `string` | Hiragana reading of the lemma |
| `meaning` | `string?` | English meaning (optional) |
| `partOfSpeech` | `PartOfSpeech` | `verb \| i-adjective \| na-adjective \| noun \| adverb \| particle \| ...` |
| `conjugationType` | `WordType` | `Ichidan \| Godan \| Irregular \| i-adjective \| na-adjective \| ...` |
| `confidence` | `'high' \| 'medium' \| 'low'` | AI's self-assessed certainty |
| `alternatives` | `string[]?` | Other possible interpretations |
| `notes` | `string?` | Brief operational note |

### Caching behavior in the route

| AI result | Cached? | How |
|-----------|---------|-----|
| Conjugatable, medium/high confidence | Yes | `setResolved()` |
| Non-conjugatable (noun, adverb, etc.) | Yes | `setUnresolved()` |
| Low confidence | **No** | Skipped entirely — not cached, not used |
| AI call fails | No | Error logged; resolution continues to step 5 (block) |

Low-confidence results are intentionally not cached so the AI has a chance to produce a better result on a future attempt.

### Overwrite behavior

When `setResolved()` or `setUnresolved()` is called for an existing document:
- `createdAt` is **preserved** (keeps original creation time)
- `hitCount` is **preserved** (keeps accumulated count)
- `result`, `source`, `status`, `updatedAt`, `lastUsedAt` are **updated**

This ensures analytics stay accurate across re-resolution writes.

---

## 3. Troubleshooting

### Why might a word still fail in Focus mode?

| Symptom | Likely cause | What to check |
|---------|-------------|---------------|
| "This word cannot be conjugated" | Not in JMdict, AI could not resolve or returned low confidence | Check server logs for `[Drill API]` and `[DrillWordResolver]` entries |
| "This word cannot be conjugated" (repeat) | Cached as `unresolved` from a previous attempt | Check `drill_word_resolutions` for this query; delete the doc to retry |
| No suggestions while typing | Word not in local JMdict subset (expected for some words) | User can still start; server will try cache/AI fallback |
| Wrong conjugation type (e.g. Ichidan instead of Godan) | JMdict match had wrong POS, or AI returned wrong `conjugationType` | Check cache doc's `result.conjugationType`; compare to expected |
| Drill works but forms are wrong | Correct type detection but engine bug, or wrong lemma/reading | Compare detected type vs expected; check `ExtendedConjugationEngine` output |
| `灯る` classified as Ichidan | Downstream type re-detection overrode resolved type (old bug) | Verify `QuestionGenerator` trusts resolved `word.type`; check rules modal type source |

### How to tell which resolution path was used

Check server console logs for the focus mode session:

```
[Drill API] Focus mode - searching for: 灯る
[DrillWordResolver] Using ollama for: 灯る            ← AI was called
[Drill API] Focus word found: 灯る Godan (source: ai_live)
```

| Log pattern | Resolution path |
|-------------|-----------------|
| No `searchJMdictWords` call, `source: selected_jmdict` | `focusWordSelection` used directly |
| `searchJMdictWords` called, `source: searched_jmdict` | JMdict search succeeded |
| `[DrillResolutionCache]` or `source: firebase_ai_cache` | Cache hit |
| `[DrillWordResolver] Using ollama/openai`, `source: ai_live` | Live AI call |
| `AI returned low confidence` | AI called but confidence too low — blocked |
| `Cached unresolved word` | Previously cached as unresolvable — blocked |

### Inspecting Firestore cache documents

1. Open Firebase Console → Firestore → `drill_word_resolutions`
2. Documents are keyed by SHA-256 hex — not human-readable
3. To find a specific word's cache entry:
   - Use the `query` field to search/filter
   - Or compute the key: `normalizeKey('灯る')` → use that hash
4. Key fields to inspect:
   - `status`: `resolved` vs `unresolved`
   - `source`: which AI provider produced this
   - `result.confidence`: `high`/`medium`/`low`
   - `result.conjugationType`: is this correct?
   - `hitCount`: how often has this been served from cache?
   - `createdAt` vs `updatedAt`: was this re-resolved?

### Diagnosing repeated cache misses

If the same word keeps triggering live AI calls instead of cache hits:

1. **Check normalization**: different surface forms produce different keys
   - `灯る` and `ともる` are different queries and have different cache keys
   - Leading/trailing whitespace is trimmed (should not cause misses)
2. **Check low-confidence**: low-confidence AI results are **not cached** — each attempt triggers a new AI call
3. **Check for write errors**: look for `[Drill API] Cache write failed` or `[DrillResolutionCache] Failed to write` in server logs
4. **Check `touchHit` calls**: if `hitCount` stays at 1, `touchHit()` may be failing silently

### Latency and write-reliability guardrails

The route includes bounded operational guardrails so transient infrastructure issues do not break a successful drill session:

- `DRILL_FOCUS_AI_TIMEOUT_MS` (default `4500`) — max time allowed for AI resolution
- `DRILL_FOCUS_CACHE_WRITE_TIMEOUT_MS` (default `250`) — timeout for each background cache write attempt
- `DRILL_FOCUS_CACHE_WRITE_RETRIES` (default `1`) — number of retries after the first attempt

Operational behavior:

- AI resolution logs provider + latency + confidence
- JMdict and Firebase cache lookups log duration
- Cache writes (`setResolved`, `setUnresolved`, `touchHit`) are retried in the background with a bounded timeout
- Cache write failures are logged but do not fail a successful session creation

---

## 4. Manual QA Checklist

### 4.1 Common JMdict word (should NOT hit AI)

**Input:** `食べる` (common Ichidan verb, in JMdict)

| Step | Expected |
|------|----------|
| Type `食べる` in Focus Word input | Suggestions appear from JMdict |
| Select the `食べる` suggestion | `focusWordSelection` payload is set |
| Start drill | Session creates successfully |
| Check resolution path | `selected_jmdict` — no AI call, no cache check |
| Verify conjugation type | Ichidan |

### 4.2 Uncommon word missing from JMdict subset (should use AI/cache)

**Input:** A word not in `jmdict-eng-common.json` (test with a rare verb)

| Step | Expected |
|------|----------|
| Type the word; no suggestions appear | JMdict search returns nothing |
| Start drill | JMdict search fails |
| AI fallback triggers | Firebase cache checked first, then live AI if cache miss |
| Drill starts with correct type | AI-resolved metadata used |
| Check Firestore | New document in `drill_word_resolutions` with `status: 'resolved'` |
| Check logs | `source: ai_live` logged |

### 4.3 Repeated same uncommon word (should hit Firebase cache)

| Step | Expected |
|------|----------|
| Start another drill with the same uncommon word | Firebase cache hit |
| No AI call made | `hitCount` incremented, `lastUsedAt` updated |
| Same conjugation type as first run | Consistent behavior |
| Check logs | `source: firebase_ai_cache` logged |

### 4.4 Ambiguous input with low confidence (should block)

**Input:** A deliberately ambiguous or nonsense word

| Step | Expected |
|------|----------|
| Enter ambiguous word and start drill | AI returns `confidence: 'low'` |
| Drill does NOT start | Error message shown (not silently Ichidan-defaulted) |
| Check Firestore | **No cache entry created** — low-confidence results are not cached |
| Check logs | `AI returned low confidence for: X` logged |
| Retry same word | AI is called again (not cached, so each attempt is fresh) |

### 4.5 `灯る` regression check

**Input:** `灯る` (Godan -ru verb, historically misclassified)

| Step | Expected |
|------|----------|
| Type `灯る` in Focus Word | Check if JMdict suggestions include it |
| If JMdict match exists | Should classify as Godan via POS `v5r` |
| If JMdict match missing | AI fallback should resolve as Godan with `ともる` reading |
| Start drill | Godan conjugation forms (NOT Ichidan) |
| Check rules modal | Should show Godan verb pattern, not Ichidan |
| Check rules modal usage note | `🧠 When it's used` section appears for the current form |
| Verify no `灯たい` form | `たい` form for Godan `灯る` should be `灯りたい` (ともりたい) |

### 4.6 Focus typing UX (no premature failure UI)

| Step | Expected |
|------|----------|
| Type a word that has no local JMdict suggestions | No suggestion list entries |
| Observe Focus UI while typing | No blocking “not conjugatable” panel shown |
| Start drill | Server performs JMdict -> cache -> AI fallback resolution |
| If AI resolves confidently | Drill starts successfully |
| If AI fails/low confidence | User sees server-side `NOT_CONJUGATABLE` error only then |

### 4.7 Live smoke script (real Firebase + real AI)

Use the smoke script to validate the AI resolver and Firebase cache against a live environment.

Resolver + cache smoke:

```bash
npm run smoke:drill-ai-fallback -- \
  --service-account /home/beano/Dev/nextjs/moshimoshi/moshimoshi-service-account.json \
  --word 灯る \
  --negative-word テーブル
```

Optional authenticated route smoke (`POST /api/drill/session`):

```bash
npm run smoke:drill-ai-fallback -- \
  --service-account /home/beano/Dev/nextjs/moshimoshi/moshimoshi-service-account.json \
  --word 灯る \
  --route-url https://YOUR_DOMAIN/api/drill/session \
  --route-cookie 'YOUR_AUTH_COOKIE_HEADER'
```

What it validates:

- live AI provider path (Ollama first, OpenAI fallback)
- Firebase cache read/write/touchHit behavior
- unresolved cache writes for non-conjugatable input
- optional authenticated route request path end-to-end

---

## 5. Developer Notes

### AI resolves metadata only; engine still conjugates

This is the most critical safety invariant. The AI processor (`DrillWordResolverProcessor`) returns:
- lemma, reading, partOfSpeech, conjugationType, confidence

It does **NOT** return:
- Conjugated forms
- Te-form, past, negative, or any other form
- Question options or distractors

The `ExtendedConjugationEngine` remains the sole source of truth for conjugation forms. If conjugation output is wrong but the type is correct, the bug is in the engine. If the type is wrong, the bug is in the resolution pipeline.

### Conjugation engine bug vs word-resolution bug

| Symptom | Resolution bug? | Engine bug? |
|---------|----------------|-------------|
| Wrong verb type shown (e.g. Ichidan for Godan verb) | Yes | No |
| Correct type but wrong te-form | No | Yes |
| Missing reading causes wrong type | Yes | No |
| All forms consistently wrong for the type | No | Likely yes |
| One specific form wrong, others correct | No | Yes (form-specific) |

### Schema validation catches common AI errors

The Zod schema at `src/lib/ai/schemas/drill-word-resolver.schema.ts` enforces:

- `verb` must have `conjugationType` in `{Ichidan, Godan, Irregular}` — rejects `null` or `other`
- `noun` must have `conjugationType === null` — rejects if AI hallucinates a conjugation type
- `reading` is required — rejects empty or missing
- `partOfSpeech` is an enum — rejects freeform strings like `"動詞"` or `"v5r"`

If schema validation fails for an Ollama response, the system falls back to OpenAI (which uses Structured Outputs for guaranteed schema compliance).

### JMdict low-confidence filtering

Agent 3 added `detected.confidence !== 'low'` to the JMdict search loop (route.ts:398). This means JMdict matches that `detectWordType` classifies with low confidence are skipped, allowing the system to fall through to the AI path for a better resolution. Previously, a low-confidence JMdict match would be accepted and potentially produce wrong conjugations.

### Rules modal: mechanical vs usage explanations

The Rules modal now intentionally separates:

- **Mechanical rule** (`📐 Pattern`) from the conjugation engine's static rule lookup
- **Usage explanation** (`🧠 When it's used`) from the usage-note dataset

This split makes debugging easier:

- Wrong `📐 Pattern` with correct type -> likely engine rule table issue
- Wrong `🧠` note but correct form generation -> usage-note dataset issue
- Wrong type badge / wrong pattern family -> resolution pipeline or type propagation issue

### Session write sanitization (Firestore)

After Focus Word AI/cache integration, a runtime `500` was found in local route E2E:

- Firestore rejected `wordTypeFilter: undefined` when saving `drillSession`

The route now sanitizes the full session document before `adminDb.collection('drill_sessions').doc(sessionId).set(...)`.

This is separate from the AI/cache logic but was exposed by Focus mode sessions where `wordTypeFilter` is often unset.

---

## 6. File Reference

| Purpose | File |
|---------|------|
| Drill session API | `src/app/api/drill/session/route.ts` |
| AI helper functions | `src/app/api/drill/session/route.ts:639` (`resolveWordViaAI`), `:664` (`mapAIResultToCacheFormat`) |
| Focus Word UI | `src/app/[locale]/drill/page.tsx` |
| AI Processor (OpenAI) | `src/lib/ai/processors/DrillWordResolverProcessor.ts` |
| AI Processor (Hybrid) | `src/lib/ai/processors/DrillWordResolverProcessorHybrid.ts` |
| AI Output Schema | `src/lib/ai/schemas/drill-word-resolver.schema.ts` |
| Firebase Cache Helper | `src/lib/drill/server/drill-word-resolution-cache.ts` |
| Word Type Detector | `src/lib/conjugation/wordTypeDetector.ts` |
| JMdict Search | `src/utils/jmdictLocalSearch.ts` |
| Question Generator | `src/lib/drill/question-generator.ts` |
| Conjugation Engine | `src/lib/conjugation/engine.ts` |
| Usage Note Dataset | `src/lib/conjugation/usage/conjugation-usage-notes.ts` |
| Usage Note Accessor | `src/lib/conjugation/usage/getConjugationUsageNote.ts` |
| Usage Note Schema | `src/lib/conjugation/usage/schema.ts` |
| Drill Types | `src/types/drill.ts` |
| Drill Schema | `src/lib/schemas/drill.schema.ts` |
| Full Plan Doc | `02-PRODUCTION_DOCS/content-generation/DRILL_WORD_RESOLVER_AI_FALLBACK_PLAN.md` |
| Focus Mode Guide | `02-PRODUCTION_DOCS/conjugation-drill/FOCUS_MODE_AND_CONJUGATION_ENGINE.md` |
| Usage Notes Coverage Guide | `02-PRODUCTION_DOCS/conjugation-drill/CONJUGATION_USAGE_NOTES_MISSING_FORMS_CHECKLIST.md` |
