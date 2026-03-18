# Research Output Template

Title:

Date:

Researcher:

Problem Area:

## 1. Executive Summary

- strongest finding
- most promising technology or method
- biggest risk
- final recommendation

## 2. Best 3 Options

### Option 1

- Name:
- Type: `rule-based` | `ML` | `hybrid` | `product pattern` | `tooling`
- What it does:
- Why it helps segmentation quality:
- Timing preservation or re-alignment story:
- Fit with current Moshimoshi stack:
- Runtime / latency:
- Infra cost:
- Licensing:
- Risks:
- Recommendation: `pursue` | `prototype` | `ignore`

### Option 2

- Name:
- Type:
- What it does:
- Why it helps segmentation quality:
- Timing preservation or re-alignment story:
- Fit with current Moshimoshi stack:
- Runtime / latency:
- Infra cost:
- Licensing:
- Risks:
- Recommendation:

### Option 3

- Name:
- Type:
- What it does:
- Why it helps segmentation quality:
- Timing preservation or re-alignment story:
- Fit with current Moshimoshi stack:
- Runtime / latency:
- Infra cost:
- Licensing:
- Risks:
- Recommendation:

## 3. Findings In Detail

- relevant papers, products, libraries, or APIs
- what seems production-credible vs academic-only
- what looks overkill for current needs

## 4. Relevance To Current Architecture

Reference these current parts of the app where relevant:
- `src/app/[locale]/youtube-shadowing/page.tsx`
- `src/app/api/youtube/transcript/[videoId]/route.ts`
- `src/app/api/youtube/resegment/route.ts`
- `src/lib/transcript/chunkSegments.ts`
- `src/lib/transcript/mergeSegments.ts`
- `src/lib/transcript/segmentQuality.ts`
- `src/lib/transcript/aiTimingAlignment.ts`
- `src/utils/youtubePlayerUtils.ts`

Answer:
- where this would plug in
- whether it replaces deterministic logic, AI logic, or both
- whether it requires a new `PracticeSegment` model

## 5. Recommendation

Choose one:
- `pursue now`
- `prototype next`
- `park for later`
- `ignore`

Why:

## 6. Sources

- link
- link
- link

