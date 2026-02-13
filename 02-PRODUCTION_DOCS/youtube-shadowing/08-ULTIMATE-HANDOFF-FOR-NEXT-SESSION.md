# YouTube Shadowing — Ultimate Handoff For Next Session

Last updated: 2026-02-13
Owner context: moshimoshi YouTube Shadowing reliability + Miraa-grade segmentation/sync

## 1) Mission (Non-Negotiable)
Ship a production-safe YouTube shadowing pipeline with:
1. Repeat-friendly Japanese segmentation (no orphan particles, no broken words like `結 | ばれる`).
2. Tight audio/text loop sync (no segment N text with segment N+1 audio bleed).
3. Deterministic fallback always safe.
4. AI enhancement that improves quality measurably, not cosmetically.

## 2) What the user explicitly wants
- Miraa-grade quality for segmentation and loop practice.
- OpenAI-first is acceptable; cost is NOT the constraint.
- Stability first: no regressions in playback sync.
- No per-video hacks; solutions must generalize.

## 3) Ground truth from real debugging (important)
Two reference videos used extensively:
- `t9U8QfOxMMw` (travel vlog, long transcript)
- `Xs0Lxif1u9E` (RADWIMPS lyrics)

Observed in production-like manual tests:
- Standalone orphan `ね。` and duplicated tail fragments existed and were partly fixed.
- Broken boundary like `結 | ばれる` appeared.
- Major sync bug: repeat UI on segment N while audio had moved to segment N+1.
- AI resegment often returned deterministic fallback due to:
  - invalid OpenAI key (fixed by user)
  - cache hits from deterministic path
  - alignment failure (`openai_alignment_failed`)
  - timeouts on large transcripts (`openai_timeout`)

Confirmed API outcomes shared by user:
- `Xs0Lxif1u9E`: `aiProcessed: true`, `aiMethod: deterministic`, `aiReason: openai_alignment_failed`, quality unchanged.
- `t9U8QfOxMMw`: `aiProcessed: true`, `aiMethod: deterministic`, `aiReason: openai_timeout`, quality unchanged.

Conclusion: AI path existed but mostly not accepted in real workloads.

## 4) What has been implemented so far (code state)

### 4.1 Deterministic segmentation/sync base
- `src/lib/transcript/mergeSegments.ts`
  - stronger sentence boundary behavior
  - lonely fragment handling
- `src/lib/transcript/chunkSegments.ts`
  - Japanese-aware splitting with `Intl.Segmenter` fallback
- `src/lib/transcript/segmentQuality.ts`
  - quality score and breakdown
- `src/utils/youtubePlayerUtils.ts`
  - `verifySeekLanding()` correction loop
- `src/app/[locale]/youtube-shadowing/page.tsx`
  - SYNC v2 hooks, polling/re-entry improvements, AI resegment button

### 4.2 AI resegmentation endpoint + cache
- `src/app/api/youtube/resegment/route.ts`
  - feature-gated AI route, deterministic fallback
  - timeout behavior + timer cleanup
  - cache bypass support via `forceRefresh`

### 4.3 Transcript API became the critical runtime path
The actual player consumes:
- `GET /api/youtube/transcript/[videoId]`

Major additions there:
- tiny duplicate/orphan cleanup
- overlap/timeline normalization
- word boundary healing
- AI shadowing pipeline + metadata in response `processing`
- pipeline versioned cache metadata

### 4.4 New AI timing alignment helper
- `src/lib/transcript/aiTimingAlignment.ts`
  - text-anchor alignment from AI text list to source timeline
  - rejects low-match scenarios
- Tests:
  - `src/lib/transcript/__tests__/aiTimingAlignment.test.ts`

## 5) Latest patch before pause (critical)
File updated:
- `src/app/api/youtube/transcript/[videoId]/route.ts`

Current active controls:
- `AI_PIPELINE_VERSION = '2.2.0'`
- `EMERGENCY_DISABLE_AI_SHADOWING = false`
- `AI_MIN_QUALITY_DELTA = 0.03`
- `AI_MAX_SEGMENT_DURATION_SECONDS = 10`
- `AI_SKIP_SEGMENTATION_SEGMENT_COUNT = 260`
- `AI_SKIP_SEGMENTATION_TEXT_LENGTH = 6000`

Behavior now:
1. Build deterministic baseline.
2. Skip AI on very large transcripts (`openai_skipped_large_transcript`).
3. For smaller transcripts, AI segmentation only (correction pass disabled for now to improve alignment stability).
4. Anchor AI texts to source timeline (`alignAiTextsToSourceTimeline`, match threshold 0.9).
5. Reject AI output unless:
   - validation passes
   - no unsafe long segments
   - quality improvement >= 0.03
6. Otherwise return deterministic with explicit reason.

Timeout cleanup also added for OpenAI calls to avoid timer leaks.

## 6) Why this is still not final Miraa-grade
This patch is stability-first, not peak quality:
- Large transcripts still skip AI entirely.
- No chunked AI pipeline for long videos yet.
- No per-chunk alignment reconciliation.
- Quality metric can still miss linguistic quality dimensions.

So this is a safe floor, not the finish line.

## 7) Exact next-session implementation plan (do this)

### Phase A — Build the real AI pipeline for long transcripts
Goal: AI works on long videos without timeout and without sync drift.

Implement:
1. Sentence-window chunker for baseline transcript in `route.ts` or `src/lib/transcript/*`:
   - chunk by time and punctuation
   - target 80-180 source segments per AI call
   - preserve chunk start/end boundaries
2. For each chunk:
   - call AI segmentation
   - anchor to chunk-local source timeline using `alignAiTextsToSourceTimeline`
   - validate output strictly
3. Recombine chunks:
   - enforce monotonic global timeline
   - small epsilon gap normalization
4. Accept/reject policy:
   - if ANY chunk fails badly, fallback only that chunk to deterministic (not whole video)

### Phase B — Persist accepted AI transcripts as first-class cache
Goal: reload gives same improved transcript.

Implement:
1. Store final accepted segments and metadata in transcript cache document.
2. Cache key must include pipeline version + model + chunk strategy version.
3. On read: if cache pipeline version is stale, recompute and overwrite.

### Phase C — Add real observability for decision quality
Goal: stop guessing.

Add metrics fields:
- ai_attempted
- ai_chunks_total
- ai_chunks_failed
- ai_accept_ratio
- ai_latency_ms_total
- quality_before / quality_after
- reject_reason histogram

### Phase D — Final sync verification harness
Goal: verify no loop bleed regressions.

Use/extend existing tests:
- `src/lib/shadowing/__tests__/repeat-sync-integration.test.ts`
- `src/utils/__tests__/verifySeekLanding.test.ts`

Add regression cases:
- near-boundary reentry with async verify seek
- overlapping segment timestamps from AI output
- short orphan segment after punctuation

## 8) Acceptance criteria (must pass before saying “done”)
1. On `Xs0Lxif1u9E`, first load should produce `processing.aiMethod = "ai"` OR deterministic with a high-confidence reason that is rare after fixes.
2. On `t9U8QfOxMMw`, no global timeout fallback; long transcript must process via chunked AI or partial AI acceptance.
3. No visible `結 | ばれる` type broken boundary in sampled segments.
4. No standalone duplicate `ね。` tail artifact in sampled segments.
5. Playback repeat must not play next-segment audio while current segment is highlighted.
6. Typecheck + relevant tests pass.

## 9) How to validate quickly in next session

### 9.1 API checks
Run and inspect `processing`:
```bash
curl -sS 'http://localhost:3000/api/youtube/transcript/Xs0Lxif1u9E?lang=ja&forceRefresh=true'
curl -sS 'http://localhost:3000/api/youtube/transcript/t9U8QfOxMMw?lang=ja&forceRefresh=true'
```

### 9.2 Browser check
In DevTools console:
```js
performance.getEntriesByType('resource')
  .filter(e => e.name.includes('/api/youtube/transcript/'))
  .slice(-3)
  .map(e => e.name)
```

### 9.3 UI manual check
- Load video.
- Confirm segment text transitions align to heard audio at repeat boundary.
- Watch for mixed sentence content in one card while audio ends earlier.

## 10) Known pitfalls to avoid
- Do not redistribute timings globally by text length; causes drift.
- Do not run correction+segmentation blindly on very large source text.
- Do not accept AI output with weak alignment match.
- Do not cache deterministic fallback as if AI succeeded.

## 11) Immediate TODO list for Future You
1. Implement chunked AI segmentation pipeline in transcript API.
2. Add partial chunk fallback instead of whole-pipeline fallback.
3. Persist accepted AI chunked result with versioned metadata.
4. Add debug UI pill showing `aiMethod` + `aiReason` for faster QA.
5. Calibrate quality acceptance threshold from real corpus (not static guess).

## 12) Files most relevant next session
- `src/app/api/youtube/transcript/[videoId]/route.ts`
- `src/lib/transcript/aiTimingAlignment.ts`
- `src/lib/transcript/chunkSegments.ts`
- `src/lib/transcript/mergeSegments.ts`
- `src/lib/transcript/segmentQuality.ts`
- `src/app/[locale]/youtube-shadowing/page.tsx`
- `src/utils/youtubePlayerUtils.ts`

## 13) Final note to Future You
Current state is intentionally conservative to protect sync. The next step is not another heuristic tweak; it is robust chunked AI with strict local anchoring and selective fallback. Do that, and this feature can genuinely approach Miraa-grade behavior while staying production-safe.
