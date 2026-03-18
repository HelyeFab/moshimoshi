# Agent Research Report: YouTube Shadowing Segmentation & Sync Improvements

## 1. Executive Summary

- **Recommended option**: Option B — Hybrid deterministic + AI fallback
- **Why this option wins**: Deterministic client-side segmentation (BudouX + timestamp gap heuristics + existing `mergeSegments`/`chunkSegments`) handles the majority of transcripts adequately (estimate: 70-80%, needs measurement — see Section 10). For transcripts with poor punctuation or micro-fragments, a server-side AI resegmentation pass (GPT-4o-mini or Gemini Flash at ~$0.001/video) produces sentence-level output cached permanently per video. Under the business-weighted scoring model (Section 5), Option B scores highest because segmentation quality and sync accuracy — the two dimensions that directly affect learner pain — receive 2x weight, reflecting the product mission of sentence-level repetition practice.
- **Primary risks**: YouTube IFrame API seek precision is keyframe-based (50-250ms variance); AI resegmentation adds 1-3s latency on first load (cache miss); kuromoji.js dictionary is 20MB compressed if full morphological analysis is needed.

---

## 2. Problem Framing

- **Learner pain points**:
  1. Segments are too large for repetition practice — YouTube auto-captions split by 2-5s time windows, not by sentences. Learners get multi-sentence blocks they can't isolate.
  2. Audio and active segment highlighting drift out of sync — after seeks, loops, or buffering events, the highlighted segment no longer matches what's playing.
  3. Micro-segments (1-2 characters) from ASR noise break the rhythm of practice.

- **System failure modes**:
  1. `chunkSegments.ts` splits proportionally by character count but doesn't understand sentence boundaries — can split mid-word in Japanese.
  2. `mergeSegments.ts` threshold (35% short segments) doesn't activate on transcripts with medium-length but semantically incomplete fragments.
  3. `youtubePlayerUtils.ts` SeekRequestQueue coalesces seeks within 0.5s tolerance, but YouTube `seekTo()` lands on the nearest keyframe, not the exact timestamp — drift accumulates across loops.
  4. Progressive transcript loading (`useProgressiveTranscript.ts`) two-phase system (raw → AI-enhanced) has race conditions when AI formatting completes while the user has already started navigating.

- **Constraints**:
  - Web: Must work in all modern browsers (Chrome 87+, Firefox 125+, Safari 15.4+)
  - Mobile: Must work on iOS Safari (YouTube IFrame API has autoplay restrictions)
  - Performance: Initial transcript ready in <2s, segment navigation <50ms
  - Cost: AI processing budget <$50/month at current scale

---

## 3. Source Log

### Source 1
- **Title**: Inter-Sentence Segmentation of YouTube Subtitles Using LSTM
- **URL**: https://www.mdpi.com/2076-3417/9/7/1504
- **Source type**: Paper (Applied Sciences, 2019)
- **Reliability note**: Peer-reviewed academic paper; tested on 27,826 subtitles
- **Key takeaway**: YouTube auto-generated subtitles are "separated by time units rather than sentence units." LSTM approach achieved 70.84% accuracy for sentence boundary prediction — adequate but not production-grade alone.

### Source 2
- **Title**: Segment Any Text (SaT) — wtpsplit
- **URL**: https://github.com/segment-any-text/wtpsplit
- **Source type**: Repo + paper (EMNLP 2024)
- **Reliability note**: Published at top-tier NLP venue; MIT license; 85 languages including Japanese
- **Key takeaway**: State-of-the-art sentence segmentation specifically designed to be robust to missing punctuation. Outperforms all baselines including strong LLMs. ONNX runtime available (~150ms/page). Python-only — would need server-side deployment or ONNX-web integration.

### Source 3
- **Title**: BudouX (Google)
- **URL**: https://github.com/google/budoux
- **Source type**: Repo (Google open source)
- **Reliability note**: Maintained by Google; ~1,500 stars; Apache-2.0 license; active releases through 2024
- **Key takeaway**: ~15KB client-side Japanese phrase segmenter using AdaBoost. Segments at sub-sentence (phrase/clause) level — potentially better than full sentences for shadowing practice. Zero external dependencies, SSR-friendly since v0.7.0.

### Source 4
- **Title**: Intl.Segmenter (MDN)
- **URL**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter
- **Source type**: Docs (web standard)
- **Reliability note**: Web standard; Baseline since April 2024
- **Key takeaway**: Zero-cost browser-native word segmentation for Japanese. `sentence` granularity requires punctuation to be present. Use `word` granularity as a free baseline for Japanese tokenization without any bundle impact.

### Source 5
- **Title**: @sglkc/kuromoji — Modern kuromoji.js Fork
- **URL**: https://www.npmjs.com/package/@sglkc/kuromoji
- **Source type**: Repo/npm
- **Reliability note**: Fork of established kuromoji.js; replaced zlib.js with fflate, uses Fetch API; Apache-2.0
- **Key takeaway**: Full Japanese morphological analysis in the browser. Dictionary ~20MB compressed, ~130MB RAM when loaded. Best accuracy but heavy. Suitable for async/background loading with Service Worker caching.

### Source 6
- **Title**: WhisperX — Word-Level Timestamps via Forced Alignment
- **URL**: https://github.com/m-bain/whisperX
- **Source type**: Repo
- **Reliability note**: ~13k+ stars; BSD-4-Clause; very active. Known alignment regressions in v3.3.3+.
- **Key takeaway**: Combines Whisper ASR with wav2vec2 forced alignment to produce word-level timestamps. Japanese supported via `jonatasgrosman/wav2vec2-large-xlsr-53-japanese`. Server-side only (Python/PyTorch).

### Source 7
- **Title**: stable-ts — Forced Alignment to Existing Transcript
- **URL**: https://github.com/jianfch/stable-ts
- **Source type**: Repo
- **Reliability note**: Active development; MIT license
- **Key takeaway**: Can force-align audio to an existing YouTube transcript text. `refine()` method iteratively mutes audio portions and monitors probability fluctuations for precise timestamps. Ideal when you already have the transcript but need better timing.

### Source 8
- **Title**: ffsubsync — Subtitle Synchronization
- **URL**: https://github.com/smacke/ffsubsync
- **Source type**: Repo
- **Reliability note**: ~9k+ stars; MIT license; well-proven
- **Key takeaway**: VAD + FFT cross-correlation algorithm aligns subtitles to audio in 20-30 seconds. The algorithm is portable to JS in theory (WebRTC VAD has JS implementations, FFT is available in JS). Migaku uses this under the hood.

### Source 9
- **Title**: Trancy AI Subtitles
- **URL**: https://www.trancy.org/ai-subtitle
- **Source type**: Blog/product page
- **Reliability note**: Competitor product claim; "80% improvement" is marketing, not independently verified
- **Key takeaway**: Only major competitor performing AI-based resegmentation of YouTube captions. Uses Whisper for ASR + NLP-based sentence segmentation. Validates the approach of building a resegmentation pipeline.

### Source 10
- **Title**: sentence-splitter (azu)
- **URL**: https://github.com/azu/sentence-splitter
- **Source type**: Repo/npm
- **Reliability note**: MIT license; TypeScript native; maintained
- **Key takeaway**: Rule-based Japanese+English sentence splitting with AST output. Works well on punctuated text. Will NOT work on raw unpunctuated ASR output — needs a punctuation restoration step first.

### Source 11
- **Title**: OpenAI Batch API
- **URL**: https://platform.openai.com/docs/guides/batch
- **Source type**: Docs
- **Reliability note**: Official documentation
- **Key takeaway**: 50% discount on GPT-4o-mini for async batch processing. A 10-minute Japanese video transcript (~3,000-5,000 tokens) costs ~$0.0015 real-time or ~$0.00075 batch. At 1,000 videos/day: $0.75-$1.50/day.

### Source 12
- **Title**: Anthropic Message Batches API
- **URL**: https://platform.claude.com/docs/en/build-with-claude/batch-processing
- **Source type**: Docs
- **Reliability note**: Official documentation
- **Key takeaway**: 50% discount combinable with prompt caching for up to 93% total savings. Claude Haiku at $1.00/$5.00 per MTok batch is competitive for structured transcript output.

### Source 13
- **Title**: YouTube IFrame API Reference
- **URL**: https://developers.google.com/youtube/iframe_api_reference
- **Source type**: Docs
- **Reliability note**: Official Google documentation
- **Key takeaway**: `seekTo(seconds, allowSeekAhead)` seeks to nearest keyframe — NOT frame-accurate. `getCurrentTime()` returns a float but with polling-dependent precision. No event for "seek completed" — must poll `getPlayerState()`. This is the fundamental constraint for loop boundary precision.

### Source 14
- **Title**: @instructor-ai/instructor — Structured LLM Output
- **URL**: https://www.npmjs.com/package/@instructor-ai/instructor
- **Source type**: Repo/npm
- **Reliability note**: Active; TypeScript native; Zod-based validation
- **Key takeaway**: TypeScript library using Zod schemas to force LLM outputs to conform to typed structures. Ideal for ensuring AI resegmentation returns valid `{text, start, end}[]` arrays. Supports OpenAI, Ollama, and other providers.

### Source 15
- **Title**: react-player
- **URL**: https://github.com/cookpete/react-player
- **Source type**: Repo
- **Reliability note**: 7,545 stars; actively maintained
- **Key takeaway**: React component wrapping YouTube (and others) with `seekTo()` and `loop` props. `react-player/youtube` import for tree-shaking. However, Moshimoshi already uses the YouTube IFrame API directly, and react-player would add abstraction without solving the keyframe-seek limitation.

### Source 16
- **Title**: asbplayer — Open Source Subtitle Sentence Mining
- **URL**: https://github.com/killergerbah/asbplayer
- **Source type**: Repo
- **Reliability note**: Open source; active; browser extension + web app
- **Key takeaway**: Reference architecture for browser-based subtitle players. Supports condensed playback, auto-pause at subtitle events, and fast-forward. Works at subtitle-event level without resegmentation — confirms the gap Moshimoshi can fill.

---

## 3b. Dependency Due-Diligence Matrix

Complete evaluation of every library/tool proposed in this report. Only dependencies marked **ADOPT** are recommended for the implementation plan.

| Dependency | Role | Latest Release | Maintenance Signal | License | TypeScript Support | Bundle / Runtime Impact | Verdict |
|---|---|---|---|---|---|---|---|
| **budoux** (npm) | Client-side Japanese phrase segmenter | v0.7.0 (mid-2024) | Google-maintained; ~1,500 stars; ~11k weekly downloads; active issues/PRs | Apache-2.0 | Yes (includes type definitions) | **~15KB** gzipped including ML model; zero external dependencies; SSR-friendly | **ADOPT** (Phase 1) |
| **Intl.Segmenter** (browser API) | Client-side Japanese word tokenization | Baseline April 2024 | Web standard; maintained by browser vendors | N/A (web standard) | Built-in (`lib.es2022.intl.d.ts`) | **0KB** — browser built-in | **ADOPT** (Phase 1) |
| **@instructor-ai/instructor** (npm) | Zod-enforced structured LLM output | Active (2024-2025) | ~1,000+ stars; regular releases; supports OpenAI, Ollama, Mistral | MIT | First-class TypeScript + Zod | **~15KB** gzipped; peer deps: `openai`, `zod` | **ADOPT** (Phase 2) |
| **sentence-splitter** (npm) | Rule-based Japanese sentence splitting | v5.2.0 (~1 year ago) | MIT; azu (prolific OSS author); TypeScript native | MIT | Native TypeScript | Small (pure JS, no models) | **EVALUATE** — useful post-punctuation-restoration; not needed in Phase 1 |
| **@sglkc/kuromoji** (npm) | Full Japanese morphological analysis | v1.1.0 (~2 years ago) | Fork of unmaintained kuromoji.js; ~stable but low activity | Apache-2.0 | Via `@types/kuromoji` | **~20MB** dictionary download; **~130MB** RAM | **DEFER** — too heavy; try BudouX + Intl.Segmenter first |
| **wtpsplit / SaT** (PyPI) | Sentence segmentation for unpunctuated text | v2.1.7 (Nov 2025) | EMNLP 2024 paper; MIT; 85 languages; ONNX support | MIT | None (Python only) | Server-side only; ONNX model ~50-200MB | **EVALUATE** — strong candidate for server-side Phase 2 alternative to LLM |
| **WhisperX** (PyPI) | Word-level timestamp forced alignment | Active (2024-2025) | ~13k+ stars; BSD-4-Clause; known regressions in v3.3.3+ | BSD-4-Clause | None (Python/PyTorch) | Server-side only; requires GPU for reasonable speed | **DEFER** — only needed if word-level timestamps are required (Phase 3+) |
| **stable-ts** (PyPI) | Forced alignment to existing transcript | Active (2024-2025) | MIT; active development | MIT | None (Python only) | Server-side only | **DEFER** — same rationale as WhisperX |
| **ffsubsync** (PyPI) | Subtitle-to-audio synchronization | Active | ~9k+ stars; MIT; used by Migaku | MIT | None (Python only) | Server-side only; 20-30s per video | **DEFER** — not needed unless offline subtitle files are involved |
| **react-player** (npm) | React video player wrapper | Active (2024-2025) | ~7,545 stars; MIT | MIT | `@types/react-player` | ~41KB min (YouTube-only: smaller) | **REJECT** — Moshimoshi already uses YouTube IFrame API directly; adds abstraction without solving keyframe limitation |
| **subtitle.js** (npm) | SRT/VTT parsing | ~Dec 2025 | ~23k+ stars; MIT; TypeScript native; 100% coverage | MIT | Native TypeScript | ~110KB unpacked | **EVALUATE** — useful if SRT/VTT interop is needed; not required for current scope |
| **Vercel AI SDK** (npm) | Structured LLM output with Zod | Active (v6, 2025) | ~10k+ stars; Apache-2.0; Vercel-maintained | Apache-2.0 | First-class TypeScript | Tree-shakeable | **EVALUATE** — alternative to instructor-js; already used elsewhere in Moshimoshi? |

**Summary of proposed new dependencies for implementation:**
- **Phase 1**: `budoux` (15KB) + `Intl.Segmenter` (0KB) = 15KB total bundle increase
- **Phase 2**: `@instructor-ai/instructor` (~15KB) + `zod` (already in project) + `openai` (already in project) = ~15KB additional
- **Total new bundle impact**: ~30KB across both phases

---

## 4. Option Analysis

### Option A: Deterministic-only

**Approach**:
Enhance the existing `mergeSegments.ts` and `chunkSegments.ts` pipeline with smarter heuristics:
1. **Timestamp gap detection**: Gaps >300ms in YouTube data often indicate natural pauses between sentences. Use these as primary sentence boundary signals.
2. **BudouX phrase segmentation** (~15KB): Add `budoux` npm package for client-side Japanese phrase-level splitting within chunks. Aggregate phrases into sentence-sized units using punctuation + gap heuristics.
3. **Intl.Segmenter** (0KB): Use `new Intl.Segmenter('ja-JP', { granularity: 'word' })` for word tokenization to improve proportional splitting in `chunkSegments.ts`.
4. **Enhanced merge thresholds**: Lower the micro-segment threshold from 35% to 20% and add a "lonely fragment" rule (any segment <5 chars adjacent to a gap <0.3s gets merged with its neighbor).
5. **Sentence-terminator heuristics**: After merge, scan for Japanese sentence-ending particles (「。」「？」「！」「よ」「ね」「な」) as secondary boundary signals.

**Components/libraries**:
- `budoux` (npm): 15KB, Apache-2.0, TypeScript types, Google-maintained
- `Intl.Segmenter`: 0KB, browser native, built-in TypeScript types

**Expected quality impact**:
- Significant improvement for well-punctuated transcripts. [ESTIMATE: ~60% of YouTube Japanese content has usable punctuation — based on informal observation of 20 videos; needs systematic measurement on a 200+ video corpus]
- Moderate improvement for auto-generated captions. [ESTIMATE: ~25% improvement in segment quality — extrapolated from gap-detection heuristic applied to 5 sample transcripts; not statistically robust]
- No improvement for completely unpunctuated streams.

**Latency/cost impact**:
- Zero additional latency (all client-side)
- Zero API cost
- Bundle increase: ~15KB (BudouX)

**Risks**:
- Timestamp gaps are noisy — buffering events can create false gaps
- Heuristic rules are brittle across different content types (news vs conversation vs music)
- No improvement for the hardest cases (auto-generated, no punctuation, rapid speech)

---

### Option B: Hybrid deterministic + AI fallback (RECOMMENDED)

**Approach**:
Layer 1 (client-side, instant): All deterministic improvements from Option A.
Layer 2 (server-side, cached): AI resegmentation for transcripts that fail quality checks.

**Pipeline**:
```
1. Fetch transcript (existing pipeline)
2. Run deterministic segmentation (enhanced mergeSegments + chunkSegments + BudouX)
3. Quality check: compute segment quality score
   - % of segments with sentence-ending punctuation
   - % of segments < 3 chars or > 80 chars
   - Variance in segment duration
4. If quality score < threshold:
   - Check cache (Firestore by videoId + "resegmented")
   - Cache miss → Send to AI resegmentation API
   - Cache hit → Use cached resegmented transcript
5. Deliver segments to player
```

**AI invocation policy**:
- **When**: Quality score < 0.6 (calibrated threshold). [ESTIMATE: approximately bottom 30% of transcripts — based on informal observation; needs measurement on 200+ video corpus to calibrate]
- **Why**: Only spend AI budget on transcripts where deterministic approaches produce poor results
- **Estimated AI invocation rate**: [ESTIMATE: ~25-35% of unique videos — based on assumption that popular channels have manual captions; needs measurement]

**AI resegmentation prompt design**:
```typescript
const schema = z.array(z.object({
  text: z.string(),
  start: z.number(),
  end: z.number(),
}));

// Use @instructor-ai/instructor with Zod schema enforcement
// Prompt: "Resegment this Japanese transcript into natural sentences.
//          Each segment must contain exactly one complete sentence.
//          Preserve the original timestamps. Output must be valid JSON."
```

**Guardrails/fallback**:
1. Zod schema validation on AI output — reject malformed responses
2. Timestamp monotonicity check — start[n+1] >= end[n]
3. Duration sanity check — no segment > 30s or < 0.2s
4. If AI fails (timeout, malformed, or >3 retries): fall back to deterministic result
5. Cache AI results permanently (transcripts are immutable)

**Expected quality impact**:
- Deterministic layer: same as Option A (see estimates above).
- AI layer: [ESTIMATE: ~80-90% improvement for hard cases (unpunctuated, micro-fragmented) — based on Trancy's marketing claim of "80% improvement" and the assumption that LLM structured output with Zod validation can match or exceed Trancy's pipeline quality. Not independently measured; needs A/B test in Phase 2.]
- Combined: significant improvement expected across all content types, pending validation.

**Latency/cost impact**:
- First load (cache miss, AI needed): +1-3s for AI processing
- First load (cache miss, deterministic sufficient): 0ms additional
- Subsequent loads: 0ms (cached)
- Cost per AI-processed video: ~$0.001-$0.002 (GPT-4o-mini) or ~$0.0005-$0.001 (Gemini Flash)
- At 100 unique AI-processed videos/day: ~$0.10-$0.20/day ($3-$6/month)

**Risks**:
- AI model changes could alter output quality — mitigated by Zod schema + validation checks
- Quality score threshold needs calibration — start conservative (trigger AI more often), tune down
- Cache invalidation if AI model is upgraded — version the cache key

---

### Option C: AI-first with deterministic guardrails

**Approach**:
Send ALL transcripts through AI resegmentation. Use deterministic validation to catch and fix AI errors.

**Pipeline**:
```
1. Fetch transcript
2. Check cache (Firestore by videoId + "resegmented_v{version}")
3. Cache miss → Send entire transcript to AI
4. Validate AI output:
   - Zod schema check
   - Timestamp monotonicity
   - Coverage check (AI output covers same time range as input)
   - Duration distribution check
5. If validation fails → fall back to deterministic segmentation
6. Cache result permanently
```

**Validation/safety strategy**:
- Same Zod + monotonicity + duration checks as Option B
- Additional: text coverage check — ensure AI output contains all original text (no dropped content)
- Fallback to enhanced deterministic if AI fails

**Expected quality impact**:
- Highest quality: every transcript gets AI-level sentence segmentation
- Consistent user experience (no quality variance between AI-processed and deterministic-processed videos)

**Latency/cost impact**:
- First load: +1-3s for ALL new videos (not just poor quality ones)
- Cost per video: ~$0.001-$0.002
- At 300 unique videos/day (all): ~$0.30-$0.60/day ($9-$18/month)
- With batch API pre-processing of trending videos: costs reduced by 50%

**Risks**:
- Higher latency on first load for ALL videos, even those with good transcripts
- Higher cost (3-4x Option B) for marginal quality improvement on already-good transcripts
- Full dependency on AI provider availability — if API is down, all new videos degrade
- Over-engineering: spending AI budget on transcripts that don't need it

---

## 5. Tradeoff Matrix

### Weighting rationale

The product mission is sentence-level repetition practice. The two documented learner pain points (Section 2) are:
1. Segments too large for repetition → **Repeatability quality** is the primary outcome metric.
2. Highlight drifts out of sync → **Sync accuracy** is the secondary outcome metric.

Operational criteria (reliability, complexity, cost, latency, maintainability) are important but serve as constraints, not objectives. Therefore the scoring model applies **2x weight** to repeatability quality and sync accuracy, and **1x weight** to all operational criteria.

### Scores: 1 = Poor, 5 = Excellent

| Criterion              | Weight | Option A (Deterministic) | Option B (Hybrid) | Option C (AI-first) |
|------------------------|:------:|:------------------------:|:-----------------:|:-------------------:|
| Repeatability quality  | **2x** | 3                        | 4.5               | 5                   |
| Sync accuracy          | **2x** | 3                        | 4                 | 4                   |
| Reliability            | 1x     | 5                        | 4.5               | 3                   |
| Complexity             | 1x     | 5                        | 3.5               | 3                   |
| Cost                   | 1x     | 5                        | 4.5               | 3.5                 |
| Latency                | 1x     | 5                        | 4                 | 3                   |
| Maintainability        | 1x     | 5                        | 4                 | 3.5                 |

### Weighted totals

Calculation: `(2*repeatability + 2*sync + 1*reliability + 1*complexity + 1*cost + 1*latency + 1*maintainability) / 9`

| Option | Calculation | Weighted Total |
|--------|-------------|:--------------:|
| **A** | (2×3 + 2×3 + 5 + 5 + 5 + 5 + 5) / 9 | **4.1** |
| **B** | (2×4.5 + 2×4 + 4.5 + 3.5 + 4.5 + 4 + 4) / 9 | **4.2** |
| **C** | (2×5 + 2×4 + 3 + 3 + 3.5 + 3 + 3.5) / 9 | **3.8** |

Option B scores highest under the business-weighted model.

---

## 6. Metrics and Acceptance Thresholds

All targets below are aligned with `04-REVIEW-RUBRIC-AND-ACCEPTANCE-GATES.md`. Where this report's targets differ from the rubric's baseline values, an explicit rationale is provided.

### 6.1 Segment Duration Distribution (per rubric)
- **Median segment duration**: 2.5s to 6.0s
- **P90 segment duration**: ≤ 8.0s
- **P95 segment duration**: ≤ 10.0s
- **Oversized repeat units (>12s)**: < 1% of segments
- **Current (estimated)**: [ESTIMATE: median ~4s, P90 ~14s, P95 ~20s, oversized ~8% — estimated from manual inspection of 10 transcripts; needs automated measurement on 200+ video corpus]
- **Measurement**: Automated script over test corpus of ≥200 videos, computing percentiles from all segment durations

### 6.2 Segment Text Length Distribution (per rubric)
- **Target**: 30 to 110 characters per segment
- **Language tuning**: For Japanese, a narrower range of 15-80 characters is proposed because Japanese characters carry more semantic density per character than Latin scripts. [RATIONALE: A 50-character Japanese segment contains roughly the same spoken content as a 110-character English segment.]
- **Current (estimated)**: [ESTIMATE: ~50% of segments fall in the 15-80 char range — based on 10-video sample]
- **Pass threshold**: ≥70% of segments in the language-tuned range
- **Measurement**: Character count histogram over test corpus

### 6.3 Boundary Quality Proxy
- **Target**: ≥70% of segments end with a Japanese sentence-terminating character (。？！) or a natural pause gap (>300ms)
- **Current (estimated)**: [ESTIMATE: ~40% sentence-terminal — based on 10-video sample with regex scan]
- **Pass threshold**: ≥55% sentence-terminal segments
- **Measurement**: Regex scan + timestamp gap analysis over test corpus

### 6.4 Sync Error and Drift (per rubric)
- **Active segment highlight error (median absolute)**: ≤ 120ms desktop, ≤ 180ms mobile
- **P95 highlight error**: ≤ 250ms desktop, ≤ 350ms mobile
- **Hard drift incidents (>500ms for >1.5s)**: < 0.5% of playback minutes
- **Current (estimated)**: [ESTIMATE: median ~200ms desktop, P95 ~500-1000ms after repeated loops — based on manual observation, not instrumented measurement. Needs automated instrumentation in Phase 3.]
- **Measurement**: Automated test: seek to segment start, poll `getCurrentTime()` at 60Hz for 1s, compute |actual - expected|. Run across 20 videos × 10 segments × 3 browsers.

### 6.5 Loop Boundary Precision (per rubric)
- **Repeat loop boundary overshoot (median)**: ≤ 120ms
- **P95 overshoot**: ≤ 220ms
- **Current (estimated)**: [ESTIMATE: median ~250-500ms overshoot — based on keyframe-seek behavior documented in YouTube IFrame API. Not instrumented.]
- **Measurement**: Automated loop test: trigger 20 consecutive loops per segment, record `getCurrentTime()` at loop re-entry, compute overshoot = |actual_start - expected_start|. Run across 20 videos × 5 segments.

### 6.6 Stability Targets (per rubric)
- No increase in player stalls/rebuffer incidents attributable to feature changes
- No regression in transcript load success rate
- No new entitlement or tracking regressions
- **Measurement**: Compare error rates and load success rates pre/post deployment using existing analytics. Monitor for 7 days after each phase rollout.

### 6.7 User Outcome Proxy
- **Target**: Average repeat count per segment decreases by 15% (indicates better segment sizing)
- **Current**: Baseline to be established via analytics instrumentation
- **Pass threshold**: ≥10% decrease in average repeats per segment
- **Measurement**: Analytics event: `segment_repeat_count` per session, A/B test over 2 weeks

---

## 7. Recommended Architecture

### Final recommendation: Option B — Hybrid deterministic + AI fallback

**Architecture diagram**:
```
┌─────────────────────────────────────────────────┐
│                   CLIENT                         │
│                                                  │
│  YouTube Transcript (raw segments)               │
│          │                                       │
│          ▼                                       │
│  ┌──────────────────────┐                       │
│  │ Enhanced Deterministic│                       │
│  │  - mergeSegments v2   │                       │
│  │  - chunkSegments v2   │                       │
│  │  - BudouX phrases     │                       │
│  │  - Gap detection      │                       │
│  └──────────┬───────────┘                       │
│             │                                    │
│             ▼                                    │
│  ┌──────────────────────┐   quality ≥ 0.6       │
│  │  Quality Scorer       │──────────────► USE    │
│  └──────────┬───────────┘                       │
│             │ quality < 0.6                      │
│             ▼                                    │
│  ┌──────────────────────┐   cache hit           │
│  │  Cache Check          │──────────────► USE    │
│  │  (Firestore/local)    │                       │
│  └──────────┬───────────┘                       │
│             │ cache miss                         │
│             ▼                                    │
│  ┌──────────────────────┐                       │
│  │  API: /resegment      │                       │
│  └──────────────────────┘                       │
│                                                  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│                   SERVER                         │
│                                                  │
│  POST /api/youtube/resegment                     │
│          │                                       │
│          ▼                                       │
│  ┌──────────────────────┐                       │
│  │ LLM (GPT-4o-mini or  │                       │
│  │ Gemini Flash)         │                       │
│  │ + Zod schema enforce  │                       │
│  └──────────┬───────────┘                       │
│             │                                    │
│             ▼                                    │
│  ┌──────────────────────┐                       │
│  │ Validation Pipeline   │                       │
│  │  - Schema check       │                       │
│  │  - Monotonicity       │                       │
│  │  - Duration bounds    │                       │
│  │  - Text coverage      │                       │
│  └──────────┬───────────┘                       │
│             │                                    │
│             ▼                                    │
│  ┌──────────────────────┐                       │
│  │ Cache to Firestore    │                       │
│  └──────────────────────┘                       │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Why rejected options lose:

**Option A (Deterministic-only)**: Insufficient for transcripts with poor/missing punctuation [ESTIMATE: ~30% of videos — needs measurement]. These are precisely the transcripts where learners struggle most. The marginal cost of AI for hard cases [ESTIMATE: ~$5/month at current scale — based on GPT-4o-mini pricing × estimated invocation rate] is trivially small relative to the quality improvement.

**Option C (AI-first)**: Over-spends on transcripts that are already well-segmented. Introduces latency for all new videos. Creates a hard dependency on AI provider availability. The quality gap between B and C is small (~0.5 points on repeatability) but the cost/complexity/reliability gap is significant.

### Migration and rollout strategy:
1. Phase 1 ships enhanced deterministic only — no API changes needed, pure client-side improvement
2. Phase 2 adds the quality scorer and AI fallback behind a feature flag
3. A/B test Phase 2 against Phase 1 for 2 weeks
4. Phase 3 enables AI fallback for all users if metrics pass

### Rollback plan:

**Rollback triggers** — initiate rollback if any of these conditions are met within 7 days of deployment:

| Trigger | Threshold | Monitoring Source |
|---------|-----------|-------------------|
| Transcript load success rate regression | >2% drop vs pre-deployment baseline | Existing analytics |
| P95 segment highlight error regression | >50ms increase vs pre-deployment baseline | Phase 3 instrumentation |
| Hard drift incidents | >0.5% of playback minutes | Phase 3 instrumentation |
| AI resegmentation failure rate | >10% of AI invocations fail validation | Server-side logging (Phase 2) |
| AI resegmentation P95 latency | >5s | Server-side logging (Phase 2) |
| Player stall/rebuffer increase | Any measurable increase attributable to changes | Existing analytics |
| User-reported segment quality complaints | >3x baseline rate over 7-day window | Support channel monitoring |

**Rollback actions**:
- Phase 1: Revert `mergeSegments.ts` and `chunkSegments.ts` changes (git revert)
- Phase 2: Disable `ai_resegmentation` feature flag → instant rollback to deterministic-only
- Phase 3: Revert `youtubePlayerUtils.ts` seek/polling changes (git revert)
- Cache is append-only and harmless — no cache rollback needed
- All rollback actions are independently reversible per phase

---

## 8. Implementation Plan

### Phase 1: Enhanced Deterministic Segmentation (Low Risk)
**Scope**: Client-side only, no new APIs, no AI

1. Add `budoux` npm dependency (~15KB)
2. Enhance `mergeSegments.ts`:
   - Add timestamp gap detection (gap > 300ms = potential sentence boundary)
   - Lower micro-segment threshold from 35% to 20%
   - Add "lonely fragment" merge rule (<5 chars + gap <0.3s → merge)
3. Enhance `chunkSegments.ts`:
   - Use `Intl.Segmenter('ja-JP', { granularity: 'word' })` for word-aware splitting instead of pure character-count proportional splitting
   - Never split within a BudouX phrase boundary
4. Add segment quality scoring function:
   - `computeSegmentQuality(segments: TranscriptSegment[]): number` (0-1 scale)
   - Score based on: sentence-terminal ratio, duration distribution, text length distribution
5. Add tests for all new heuristics
6. Measure metrics on test corpus of 50 videos

**Estimated effort**: 3-5 days
**Risk**: Low — purely additive, existing behavior preserved as baseline

### Phase 2: AI Resegmentation Fallback (Quality Expansion)
**Scope**: New API route, Firestore cache, quality-gated AI invocation

1. Create `POST /api/youtube/resegment` route:
   - Input: `{ videoId, segments: {text, start, end}[] }`
   - AI provider: GPT-4o-mini (cheapest) with `@instructor-ai/instructor` for Zod enforcement
   - Output schema: `z.array(z.object({ text: z.string(), start: z.number(), end: z.number() }))`
   - Validation pipeline: schema → monotonicity → duration bounds → text coverage
   - Cache result to Firestore under `transcripts/{videoId}/resegmented_v1`
2. Add quality gate in `useProgressiveTranscript.ts`:
   - After deterministic segmentation, compute quality score
   - If score < 0.6, check cache then call resegment API
3. Add feature flag: `ai_resegmentation` (off by default)
4. Add observability: log quality scores, AI invocation rate, AI response times, validation failures
5. A/B test: 50/50 split for 2 weeks, measure segment metrics + user repeat behavior

**Estimated effort**: 5-8 days
**Risk**: Medium — new API route, new AI dependency, needs monitoring

### Phase 3: Sync Accuracy & Loop Precision (Optimization)
**Scope**: Player-level improvements to drift correction and loop precision

1. Enhance `youtubePlayerUtils.ts` SeekRequestQueue:
   - Add seek-landing verification: after `seekTo()`, poll `getCurrentTime()` at 60Hz for 500ms, measure actual landing time
   - If landing error > 200ms, micro-adjust playback with `seekTo(target + correction)`
   - Track seek accuracy histogram for observability
2. Improve segment highlight sync:
   - Replace polling-based segment detection with a predictive model:
     - Pre-compute next segment boundary, set a timer for (boundary - 100ms)
     - At timer fire, start polling at 60Hz until boundary is crossed
     - This reduces CPU usage (no continuous polling) while maintaining precision
3. Add loop warmup buffer:
   - On repeat mode activation, pre-seek to (segment.start - 0.3s) and pause
   - When loop triggers, the seek is shorter and more likely to land accurately
4. Measure drift metrics from production telemetry

**Estimated effort**: 5-7 days
**Risk**: Medium — touches critical playback path, needs careful testing

---

## 9. Open Risks and Unknowns

| # | Risk | Severity | Validation Plan |
|---|------|----------|-----------------|
| 1 | YouTube `seekTo()` keyframe precision varies by video codec and quality level | High | Benchmark seek accuracy across 20 videos at different quality levels (360p, 720p, 1080p). Measure landing variance. If >300ms, implement micro-correction loop. |
| 2 | BudouX phrase boundaries may not align with natural shadowing practice units | Medium | User study: compare shadowing performance with BudouX-segmented vs current segments on 10 users, 5 videos each. Measure completion rate and self-reported difficulty. |
| 3 | AI resegmentation may hallucinate timestamps (assign times that don't exist in original data) | High | Validation pipeline checks timestamp monotonicity and that all AI timestamps fall within the range of the original segments. Reject and fall back if violated. |
| 4 | Quality score threshold (0.6) may be miscalibrated | Medium | Start with conservative threshold (0.7 — triggers AI more often). Collect quality score distribution over 500 videos. Tune threshold to target ~30% AI invocation rate. |
| 5 | GPT-4o-mini pricing may change | Low | Abstract AI provider behind interface. Gemini Flash ($0.10/MTok) is a viable backup at even lower cost. |
| 6 | Progressive transcript two-phase loading race conditions | Medium | Add state machine to `useProgressiveTranscript`: `raw_loading → raw_ready → ai_loading → ai_ready`. Prevent user interaction during transitions. Test with artificial 5s AI delay. |
| 7 | kuromoji.js 20MB dictionary too heavy if morphological analysis is needed | Medium | Test BudouX + Intl.Segmenter first (Phase 1). Only consider kuromoji if word-level accuracy is insufficient. If needed, load dictionary via Service Worker + IndexedDB cache. |
| 8 | Mobile Safari YouTube IFrame API behavior differs from desktop | Medium | Test all Phase 1+3 changes on iOS Safari 16+ and Android Chrome. YouTube IFrame API has known autoplay and seek restrictions on mobile. |

---

## 10. Fact vs Inference

### Facts (source-backed)
1. YouTube auto-generated captions are split by time windows (2-5s), not by sentences. (Source: Song & Kim 2019, MDPI)
2. `Intl.Segmenter` has Baseline browser support since April 2024 (Chrome 87+, Firefox 125+, Safari 15.4+). (Source: MDN, web.dev)
3. BudouX is ~15KB, Apache-2.0, maintained by Google, supports Japanese phrase segmentation. (Source: GitHub)
4. YouTube `seekTo()` seeks to nearest keyframe, not exact timestamp. (Source: YouTube IFrame API docs)
5. GPT-4o-mini costs $0.15/$0.60 per million tokens. A 10-minute Japanese transcript is ~3,000-5,000 tokens. Cost per video: ~$0.001-$0.002. (Source: OpenAI pricing page)
6. OpenAI Batch API provides 50% discount. Anthropic Batch API provides 50% discount combinable with prompt caching for up to 93% savings. (Sources: OpenAI docs, Anthropic docs)
7. wtpsplit/SaT outperforms all baselines on sentence segmentation of poorly-formatted text across 85 languages including Japanese. Published at EMNLP 2024. (Source: EMNLP 2024 paper)
8. kuromoji.js dictionary is ~20MB compressed, ~130MB RAM when loaded. (Source: npm package docs, community benchmarks)
9. Trancy claims "improved segmentation by 80%" and uses NLP to reorganize subtitles into complete sentences. (Source: Trancy product page — marketing claim, not independently verified)
10. ffsubsync uses WebRTC VAD + FFT cross-correlation for subtitle synchronization. ~9k stars, MIT license. Migaku uses it. (Source: GitHub)
11. Current Moshimoshi `mergeSegments.ts` triggers at 35% micro-segment threshold with MAX_CHARS=45 and MAX_GAP=0.9s. (Source: codebase)
12. Current `chunkSegments.ts` splits proportionally by character count with MIN_CHUNK_DURATION=0.2s. (Source: codebase)

### Inferences (explicit assumptions)
1. **Only Trancy (among 8+ competitors analyzed) appears to perform AI-based resegmentation of YouTube captions.** Based on product page analysis and feature comparison of Migaku, Language Reactor, FluentU, YouGlish, CaptionPop, Speechling, asbplayer, InterSub. This is not a comprehensive scan of all products worldwide; smaller or regional competitors may also offer resegmentation. Methodology: checked product pages, help docs, and Chrome Web Store descriptions.
2. **~30% of YouTube Japanese transcripts will need AI resegmentation.** Based on the observation that many popular channels have manual captions, and auto-generated Japanese captions have improved over time. The exact percentage needs measurement.
3. **BudouX phrase-level segments may be better for shadowing than full sentences.** Shadowing practice often works at the phrase/clause level, and shorter segments improve repetition. This assumption needs user testing.
4. **A quality score of 0.6 is the right threshold for AI invocation.** This is a starting estimate. The actual threshold should be calibrated on a corpus of 500+ videos.
5. **Seek micro-correction (re-seeking after measuring landing error) will improve loop precision by ~50%.** Based on the assumption that the second seek is closer because the keyframe is likely already buffered. Needs benchmarking.
6. **Caching eliminates the cost concern for AI resegmentation.** Based on the assumption that most video views are concentrated on popular content. If there's a long tail of unique videos, costs could be higher. Needs monitoring.
7. **The current drift issues are primarily caused by keyframe-seek imprecision, not by timer/polling inaccuracy.** Based on code review of `youtubePlayerUtils.ts`. Could also be caused by browser-level event loop jank. Needs instrumentation to confirm.
