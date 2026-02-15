# YouTube Shadowing Production Delivery Plan

Last updated: 2026-02-15
Scope: segmentation + sync reliability, benchmark-driven quality, and production readiness.

## 1. Business Need

### 1.1 User value
- Users need repeat-loop shadowing that feels natural and trustworthy.
- If segmentation is unnatural or loop audio bleeds, users lose confidence and drop sessions.
- Reliable shadowing quality directly impacts retention and paid conversion for listening/speaking practice.

### 1.2 Product objective
- Reach Miraa-grade practical quality for sentence loops while preserving playback stability.
- Provide a safe fallback path on hard videos (lyrics, noisy ASR, long transcripts).
- Minimize support cost by making failures diagnosable and reversible.

### 1.3 Success signals
- Higher repeat-loop completion and longer shadowing session duration.
- Lower user complaints about “wrong loop” / “bleeding into next sentence.”
- Stable AI acceptance on long transcripts without timeout-based global fallback.

## 2. Technical Reasoning

### 2.1 Why this is hard
- Transcript quality varies heavily by source and caption style.
- Lyrics and auto-captions produce timing/text mismatches and micro-fragments.
- Playback loop timing is sensitive to seek landing and polling jitter.

### 2.2 Design principles
- Safety-first playback invariants: no overlap timeline, no unsafe segment durations.
- AI as enhancer, never as single point of failure.
- Deterministic fallback must stay usable even when AI fails.
- Benchmark/eval-driven iteration, not one-off manual tuning.

### 2.3 Core architecture decisions
- Keep chunked AI pipeline with selective per-chunk fallback.
- Enforce final timeline normalization in all API output paths.
- Track decision metadata (`aiMethod`, `aiReason`, chunk stats, quality deltas).
- Validate against fixed benchmark corpus before promoting changes.

## 3. Attempts Made So Far

### 3.1 Implemented
- AI chunk pipeline for long transcripts with per-chunk fallback.
- Alignment/validation/safety checks and reject-reason histograms.
- Fragmentation rejection gates for bad AI micro-splits.
- Final timeline normalization for transcript route and resegment route.
- Playback trigger-buffer adjustments and seek verification hardening.
- Benchmark harness and docs (`09-BENCHMARK-HARNESS.md`).
- Phase C editor MVP delivered on YouTube Shadowing page:
  - transcript edit menu (`⋮`) using app UI component
  - segment text editing, split, merge prev/next
  - boundary token transfer (`Take/Give`, including 2-token variants)
  - timing boundary nudges (`Start-/Start+/End-/End+`)
  - per-video override save and reload via transcript cache
- Reset behavior hardened:
  - `Reset Edits` now restores from Firebase-backed original transcript backup (not local-only reset).
- Audio shadowing parity started in `MoshiShadowingPlayer`:
  - same edit menu and sentence-boundary editing controls for article/story/book shadowing sessions.

### 3.2 Observed outcomes
- Long video (`t9U8QfOxMMw`) improved materially with chunked AI acceptance.
- Lyrics video (`Xs0Lxif1u9E`) often falls back to deterministic for safety.
- Some regressions introduced by over-aggressive deterministic segmentation and boundary timing; partially mitigated.

### 3.3 Current unresolved risk
- Even with non-overlap timeline, some loops still audibly include tail from next phrase on hard videos.
- This indicates remaining coupling between segment timing quality and runtime loop cut timing.

## 4. Plan To Implement (Production Path)

### Phase A: Stabilize Playback Loop Behavior (P0)
- Goal: no audible next-phrase bleed on benchmark loops.
- Work:
  - tighten runtime boundary trigger for long→short transitions.
  - add player-side hard cut policy with conservative early trigger cap.
  - add deterministic timing-preserving fallback mode when AI rejected.
- Exit criteria:
  - manual QA pass on benchmark videos with no significant bleed.

### Phase B: Improve Segment Quality Without Regressing Sync (P0)
- Goal: improve naturalness while keeping loop-safe timing.
- Work:
  - refine deterministic continuation boundary rebalance.
  - keep anti-fragment AI reject gates strict.
  - reject AI outputs that pass metrics but fail practical phrase quality.
- Exit criteria:
  - benchmark pass + UI quality review pass.

### Phase C: Editable Transcript Fallback (P1)
- Goal: user-controlled recovery for edge-case videos.
- MVP:
  - split segment
  - merge with previous/next
  - save per-video overrides
  - apply overrides on load
  - boundary token transfer between adjacent segments
  - segment timing nudges for precise loop boundary control
  - reset-to-original transcript from Firebase backup
- Exit criteria:
  - users can fix bad boundaries in-session without leaving player.

## 4.1 Current Status Snapshot (2026-02-15)

### Completed this cycle
- YouTube editor controls are now production-usable for manual boundary repair.
- Override persistence path is in place (`POST /api/youtube/transcript/overrides`).
- Reset-to-original path is in place (`DELETE /api/youtube/transcript/overrides`) with backup restore from Firebase.
- Type-check passes after implementation updates.

### Still left to do
- Add automated tests for override save/reset API behavior and timing-nudge safety clamps.
- Add integration tests for edit-mode playback boundary correctness (post-edit repeat behavior).
- Validate reset flow and timing edits with full manual QA on benchmark videos (`Xs0Lxif1u9E`, `t9U8QfOxMMw`).
- Decide final policy for `Undo` (fix reliability or remove from UI if low value).
- Decide persistence scope for non-YouTube audio shadowing editor (currently session-level only).
- Complete Phase D hardening: monitoring events for override usage/reset failures, rollout flags, and rollback checklist validation.

### Phase D: Hardening and Rollout (P1)
- Goal: production-safe launch.
- Work:
  - increase coverage for sync and segmentation regression tests.
  - release with monitoring + rollback toggles.
  - staged rollout by feature flag.

## 5. Files To Touch

### Primary runtime
- `src/app/api/youtube/transcript/[videoId]/route.ts`
- `src/app/api/youtube/resegment/route.ts`
- `src/app/[locale]/youtube-shadowing/page.tsx`
- `src/utils/youtubePlayerUtils.ts`

### Supporting transcript logic
- `src/lib/transcript/aiTimingAlignment.ts`
- `src/lib/transcript/chunkSegments.ts`
- `src/lib/transcript/mergeSegments.ts`
- `src/lib/transcript/segmentQuality.ts`
- `src/lib/transcript/resegmentation.ts`

### Editable fallback (Phase C)
- `src/app/[locale]/youtube-shadowing/page.tsx`
- `src/components/shadowing/*` (new editor controls)
- `src/app/api/youtube/transcript/*` (override persistence route)
- `src/lib/transcript/cache.ts` (metadata and override read/write)

### Tests and benchmark
- `src/lib/shadowing/__tests__/repeat-sync-integration.test.ts`
- `src/utils/__tests__/verifySeekLanding.test.ts`
- `src/lib/transcript/__tests__/aiTimingAlignment.test.ts`
- `src/lib/transcript/__tests__/resegmentation.test.ts`
- `scripts/youtube-shadowing-benchmark.mjs`

## 6. Deliverables

### 6.1 Engineering deliverables
- stable no-overlap, no-unsafe-duration transcript output across all routes.
- benchmark JSON report for each release candidate.
- tested runtime loop boundary behavior for benchmark corpus.
- fallback editor MVP (Phase C).

### 6.2 Documentation deliverables
- updated `README.md` and handoff notes.
- benchmark runbook updates with new gates if changed.
- release note for behavior change and fallback logic.

### 6.3 Operational deliverables
- feature flags for risky changes.
- rollback recipe documented and validated.
- monitoring dashboard/event queries for AI reject reasons and loop incidents.

## 7. QA, Acceptance, and Release Gates

### 7.1 Must-pass technical gates
- type-check passes.
- targeted sync/transcript tests pass.
- benchmark script passes on default corpus.

### 7.2 Must-pass product gates
- manual loop QA on benchmark videos:
  - no severe audible bleed at repeat boundary.
  - no broken micro-fragment chains in visible segment cards.

### 7.3 Release gate
- no P0 known regression in playback behavior.
- rollback switch verified in staging.

## 8. Risks and Mitigations

- Risk: AI accepts technically valid but unnatural segments.
  - Mitigation: anti-fragment hard gates + stricter benchmark phrase-quality checks.
- Risk: deterministic fallback becomes over-merged and bleeds.
  - Mitigation: timing-preserving fallback mode and continuation rebalance limits.
- Risk: runtime poll/seek timing drifts by device/network.
  - Mitigation: adaptive trigger buffer + verify-seek + regression harness.

## 9. Production Rollout Strategy

- Stage 1: internal/staging with benchmark + manual QA.
- Stage 2: limited percentage rollout via feature flag.
- Stage 3: full rollout after stability window.
- Rollback: disable AI path and use deterministic timing-preserving mode.

## 10. Ownership and Cadence

- Technical Lead owns prioritization, acceptance, and release go/no-go.
- AI agents execute scoped tasks with benchmark evidence.
- Daily cadence:
  - benchmark report
  - blocker summary
  - next-step task assignment
