# YouTube Shadowing Benchmark Harness

Purpose: run repeatable quality checks against benchmark videos and decide if a pipeline change moves us toward Miraa-grade quality.

## Scope

Current benchmark set:
- `Xs0Lxif1u9E`
- `t9U8QfOxMMw`

Script:
- `scripts/youtube-shadowing-benchmark.mjs`

Outputs:
- JSON report: `02-PRODUCTION_DOCS/youtube-shadowing/agent-execution/benchmark-latest.json`

## Commands

1. Cached run:
```bash
npm run benchmark:youtube-shadowing
```

2. Fresh recompute run:
```bash
npm run benchmark:youtube-shadowing:refresh
```

3. Custom video list:
```bash
node scripts/youtube-shadowing-benchmark.mjs \
  --base-url=http://127.0.0.1:3000 \
  --videos=Xs0Lxif1u9E,t9U8QfOxMMw,ANOTHER_ID \
  --force-refresh
```

## Current Gates (Implemented)

Per video:
- no timeline overlap
- no segments over 10s
- low orphan particle fragments

`Xs0Lxif1u9E` gate:
- AI accepted OR deterministic fallback with known rare reason

`t9U8QfOxMMw` gates:
- no global timeout fallback
- chunked AI attempted (`ai_chunks_total > 1`)
- meaningful AI acceptance (`aiMethod=ai` and `ai_accept_ratio >= 0.30`)

## How To Use In Iteration

1. Make pipeline change.
2. Run refresh benchmark.
3. Compare report with previous run:
   - `processing.aiMethod`, `processing.aiReason`
   - `processing.ai_chunks_total`, `processing.ai_chunks_failed`, `processing.ai_accept_ratio`
   - `segmentStats` (especially tiny/short fragment indicators)
4. Only keep changes that improve benchmark quality without sync regressions in UI.

