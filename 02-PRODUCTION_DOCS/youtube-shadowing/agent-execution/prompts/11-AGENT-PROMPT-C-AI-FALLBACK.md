# Agent Prompt C: AI Resegmentation Fallback (Flagged)

You are implementing AI fallback for transcript resegmentation with strict guardrails.

## Mandatory pre-read
- `02-PRODUCTION_DOCS/youtube-shadowing/agent-execution/00-AGENT-COMMON-CONTEXT.md`

## Scope
Create backend path for AI resegmentation, fully feature-flagged and safe-by-default.

## Required files to inspect first
- `src/hooks/useProgressiveTranscript.ts`
- `src/lib/transcript/cache.ts`
- Existing AI route patterns under `src/app/api/**`
- Existing OpenAI/AI utility patterns under `src/lib/ai/**`

## Required changes
1. Add server route for resegmentation (follow existing API style).
2. Add schema-validated output (`text/start/end[]`) with strict checks:
   - Monotonic timestamps
   - Duration sanity bounds
   - Coverage sanity check
3. Add persistent cache keyed by `videoId + modelVersion + pipelineVersion`.
4. Add quality-gated client invocation hook path, guarded by `ai_resegmentation` flag (default off).
5. Deterministic fallback always available.

## Constraints
- No blocking impact on playback.
- Timeout-safe, retry-bounded behavior.
- Logging aligned to repo conventions.

## Required tests
1. Route validation tests (success + malformed + fallback).
2. Cache-hit/cache-miss behavior tests.
3. Feature-flag off path test (no AI invocation).

## Deliverable
1. Patch + tests.
2. Cost/latency assumptions documented inline in PR summary.
3. Explicit fallback behavior table.
