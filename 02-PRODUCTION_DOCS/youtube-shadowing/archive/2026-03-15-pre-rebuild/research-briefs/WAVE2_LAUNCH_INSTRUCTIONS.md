# Wave 2 Launch Instructions

Last updated: 2026-03-12

Purpose:
- provide a single handoff document for launching Wave 2 research agents
- eliminate ambiguity about scope, inputs, output path, and method

## 1. Wave 2 Assignments

Launch these three research tracks in parallel:

1. `prompts/04-subtitle-to-utterance-segmentation.md`
2. `prompts/05-prosody-and-pause-segmentation.md`
3. `prompts/06-editable-fallback-ux.md`

These are Wave 2 only.
Do not assign Wave 1 prompts again.

## 2. What To Give Each Agent

For each agent, provide these files first, in this order:

1. `02-PRODUCTION_DOCS/youtube-shadowing/research-briefs/AGENT_DISPATCH_INTRO.md`
2. `02-PRODUCTION_DOCS/youtube-shadowing/research-briefs/SESSION_CONTEXT.md`
3. `02-PRODUCTION_DOCS/youtube-shadowing/research-briefs/DISPATCH_ORDER.md`
4. `02-PRODUCTION_DOCS/youtube-shadowing/research-briefs/OUTPUT_TEMPLATE.md`

Then give the agent only its assigned prompt file.

## 3. Exact Assignment Mapping

### Agent A

Prompt:
- `02-PRODUCTION_DOCS/youtube-shadowing/research-briefs/prompts/04-subtitle-to-utterance-segmentation.md`

Output:
- `02-PRODUCTION_DOCS/youtube-shadowing/research-briefs/outputs/04-subtitle-utterance-REPORT.md`

### Agent B

Prompt:
- `02-PRODUCTION_DOCS/youtube-shadowing/research-briefs/prompts/05-prosody-and-pause-segmentation.md`

Output:
- `02-PRODUCTION_DOCS/youtube-shadowing/research-briefs/outputs/05-prosody-pause-REPORT.md`

### Agent C

Prompt:
- `02-PRODUCTION_DOCS/youtube-shadowing/research-briefs/prompts/06-editable-fallback-ux.md`

Output:
- `02-PRODUCTION_DOCS/youtube-shadowing/research-briefs/outputs/06-editable-fallback-ux-REPORT.md`

## 4. Copy-Paste Dispatch Message

Use this exact message structure for each agent:

```md
Read these first, in order:
1. 02-PRODUCTION_DOCS/youtube-shadowing/research-briefs/AGENT_DISPATCH_INTRO.md
2. 02-PRODUCTION_DOCS/youtube-shadowing/research-briefs/SESSION_CONTEXT.md
3. 02-PRODUCTION_DOCS/youtube-shadowing/research-briefs/DISPATCH_ORDER.md
4. 02-PRODUCTION_DOCS/youtube-shadowing/research-briefs/OUTPUT_TEMPLATE.md

Your assignment is only this prompt:
- 02-PRODUCTION_DOCS/youtube-shadowing/research-briefs/prompts/0X-....

Save your final report to:
- 02-PRODUCTION_DOCS/youtube-shadowing/research-briefs/outputs/0X-...-REPORT.md

Use live web research where current information matters.
Inspect the current codebase where needed for the "Relevance To Current Architecture" section.
Follow the output template exactly.
```

## 5. Review Standard For Wave 2

These reports should help answer:

1. Are there broader segmentation methods we are missing beyond the Japanese-specific Wave 1 options?
2. Can pause/prosody materially improve segment quality enough to justify extra complexity?
3. If automatic segmentation remains imperfect, what is the best minimal correction UX inside the player?

## 6. Completion Checklist

Wave 2 is complete when:

- `outputs/04-subtitle-utterance-REPORT.md` exists
- `outputs/05-prosody-pause-REPORT.md` exists
- `outputs/06-editable-fallback-ux-REPORT.md` exists
- `TRACKER.md` is updated from `pending` to `complete` for `04`, `05`, and `06`

## 7. What Happens After Wave 2

Once Wave 2 is complete:

1. review all three outputs together
2. synthesize with `WAVE1_SYNTHESIS.md`
3. produce the next design artifact:
   - `PracticeSegment Architecture Proposal`

That proposal should define:
- the segment model split
- segmentation generation flow
- timing assignment strategy
- correction UX integration
- confidence and fallback behavior

