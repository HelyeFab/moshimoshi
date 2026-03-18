# YouTube Shadowing Research Briefs

Last updated: 2026-03-12

Purpose:
- store agent prompts for targeted external research
- keep research outputs in one place
- compare options for improving segmentation quality toward a 10/10 shadowing experience

## Folder Structure

- `README.md`
  - overview and usage
- `OUTPUT_TEMPLATE.md`
  - required format for all research outputs
- `TRACKER.md`
  - assignment and status tracker
- `prompts/`
  - agent-ready prompt files
- `outputs/`
  - completed research reports

## Research Goal

Primary question:

`How do we turn noisy Japanese YouTube captions into repeat-worthy spoken practice segments with accurate loop timing?`

Do not optimize for:
- generic subtitle prettification
- general translation quality
- broad AI tooling surveys
- full transcript editor suites unless they directly help boundary correction

Optimize for:
- meaningful spoken-unit segmentation
- timing-safe looping
- reliable fallback behavior
- practical fit with the current Moshimoshi stack

## Required Output Rules

Every output placed in `outputs/` should follow `OUTPUT_TEMPLATE.md`.

Each report must answer:
- what problem area was researched
- top options found
- why each option helps segmentation quality
- how it fits the current codebase
- runtime, infra, and licensing implications
- clear recommendation: `pursue`, `prototype`, or `ignore`

## Suggested Agent Order

Highest-value first:
1. Japanese segmentation + punctuation restoration
2. Forced alignment / timing refinement
3. Competitive teardown of Miraa and adjacent tools

Second wave:
4. Subtitle-to-utterance segmentation literature
5. Prosody-aware / pause-aware segmentation
6. Editable fallback UX patterns

## Naming Convention

Prompts:
- `prompts/01-*.md`
- `prompts/02-*.md`

Outputs:
- `outputs/01-*-REPORT.md`
- `outputs/02-*-REPORT.md`

Example:
- `outputs/01-japanese-segmentation-REPORT.md`

