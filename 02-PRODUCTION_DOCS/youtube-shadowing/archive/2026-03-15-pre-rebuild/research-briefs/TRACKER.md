# Research Tracker

Last updated: 2026-03-12

## Assignments

| ID | Topic | Prompt File | Output File | Status | Priority |
|---|---|---|---|---|---|
| 01 | Japanese segmentation + punctuation restoration | `prompts/01-japanese-segmentation-and-punctuation.md` | `outputs/01-japanese-segmentation-REPORT.md` | complete | P0 |
| 02 | Forced alignment + timing refinement | `prompts/02-forced-alignment-and-timing.md` | `outputs/02-forced-alignment-REPORT.md` | complete | P0 |
| 03 | Competitive teardown: Miraa and adjacent tools | `prompts/03-competitive-teardown.md` | `outputs/03-competitive-teardown-REPORT.md` | complete | P0 |
| 04 | Subtitle-to-utterance segmentation research | `prompts/04-subtitle-to-utterance-segmentation.md` | `outputs/04-subtitle-utterance-REPORT.md` | complete | P1 |
| 05 | Prosody-aware and pause-aware segmentation | `prompts/05-prosody-and-pause-segmentation.md` | `outputs/05-prosody-pause-REPORT.md` | complete | P1 |
| 06 | Editable fallback and correction UX | `prompts/06-editable-fallback-ux.md` | `outputs/06-editable-fallback-ux-REPORT.md` | complete | P1 |

## Decision Rules

When reviewing outputs, prioritize findings that improve:
- meaningful spoken-unit segmentation
- timing-safe loop playback
- deterministic fallback quality
- fit with the current architecture

Deprioritize findings that mostly improve:
- transcript cosmetics
- generic translation quality
- passive subtitle reading

