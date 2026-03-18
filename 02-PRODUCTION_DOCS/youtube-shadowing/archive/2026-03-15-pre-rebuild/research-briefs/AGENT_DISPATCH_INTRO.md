# Agent Dispatch Intro

Use this as the cover instruction when dispatching any research agent for the YouTube Shadowing segmentation mission.

---

You are working inside the Moshimoshi codebase on a focused research task for the YouTube Shadowing / Moshi Player feature.

## Mission Context

The feature goal is:

`Take a YouTube video, get the transcript, segment it into meaningful spoken practice units, and allow users to repeat those units cleanly and reliably.`

Current diagnosis:
- transcript retrieval is reasonably strong
- repeat-loop mechanics are reasonably strong
- meaningful segmentation is the weakest part of the feature

Your research should help improve:
- meaningful spoken-unit segmentation
- timing-safe looping
- production fit with the current architecture

Do not optimize for:
- generic subtitle prettification
- translation-first solutions
- broad AI novelty
- passive subtitle reading

## Your Assignment

You are responsible only for the prompt file explicitly assigned to you unless the dispatcher says otherwise.

Examples:
- if assigned `prompts/01-japanese-segmentation-and-punctuation.md`, do only that research track
- if assigned `prompts/03-competitive-teardown.md`, do only that research track

Do not assume you own the full wave unless explicitly told:
- Wave 1 = 01, 02, 03
- Wave 2 = 04, 05, 06

## Required Files To Read Before Starting

Read these first:
- `02-PRODUCTION_DOCS/youtube-shadowing/research-briefs/SESSION_CONTEXT.md`
- `02-PRODUCTION_DOCS/youtube-shadowing/research-briefs/DISPATCH_ORDER.md`
- your assigned prompt file under `prompts/`
- `02-PRODUCTION_DOCS/youtube-shadowing/research-briefs/OUTPUT_TEMPLATE.md`

If useful for architecture fit, also inspect:
- `src/app/[locale]/youtube-shadowing/page.tsx`
- `src/app/api/youtube/transcript/[videoId]/route.ts`
- `src/app/api/youtube/resegment/route.ts`
- `src/lib/transcript/chunkSegments.ts`
- `src/lib/transcript/mergeSegments.ts`
- `src/lib/transcript/segmentQuality.ts`
- `src/lib/transcript/aiTimingAlignment.ts`
- `src/utils/youtubePlayerUtils.ts`

Yes, you should inspect the codebase before writing the "Relevance To Current Architecture" section.

## Research Method

Use live web research when current information matters.

You should prefer current sources for:
- libraries and APIs
- product behavior
- recent papers or benchmarked methods
- licensing and maintenance status

Do not rely only on stale memory if web research would materially improve accuracy.

## Output Location

Save your final report under:
- `02-PRODUCTION_DOCS/youtube-shadowing/research-briefs/outputs/`

Use the filename specified in `TRACKER.md`.

Examples:
- `outputs/01-japanese-segmentation-REPORT.md`
- `outputs/03-competitive-teardown-REPORT.md`

## Output Format

Your report must follow:
- `02-PRODUCTION_DOCS/youtube-shadowing/research-briefs/OUTPUT_TEMPLATE.md`

Be concrete.
Prefer strong recommendations over broad surveys.

For each major option, include:
- why it helps segmentation quality
- how it fits the current stack
- timing implications
- infra/runtime cost
- licensing
- recommendation: `pursue`, `prototype`, or `ignore`

## Decision Standard

The key question is:

`Will this help convert noisy Japanese YouTube captions into repeat-worthy spoken practice segments with accurate loop timing?`

If the answer is weak, it is not central to this mission.

## Completion Rule

When finished:
1. save the report to the correct file in `outputs/`
2. keep the structure compliant with the template
3. make the final recommendation explicit

---

If your assignment is ambiguous, default to working only on the specific prompt file you were given.

