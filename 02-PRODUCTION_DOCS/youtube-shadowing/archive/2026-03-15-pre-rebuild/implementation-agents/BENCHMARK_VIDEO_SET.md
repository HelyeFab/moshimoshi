# Benchmark Video Set — PracticeSegment Architecture

Last updated: 2026-03-13
Owner: Agent 04 (QA & Benchmarks)
Status: initial definition

## 1. Purpose

This document defines the benchmark video categories used to evaluate segmentation quality across the PracticeSegment architecture migration.

Every phase in the implementation roadmap must be tested against this set. Results should be compared against the baseline captured before any architecture changes.

## 2. Categories

### 2.1 Normal Speech

Description:
- clear spoken Japanese at natural pace (~3-5 mora/s)
- well-formed captions with reasonable segment boundaries
- standard interview, vlog, or educational content

What it tests:
- baseline segmentation should not regress
- computed practice segments should match or beat existing quality
- timing inheritance should be straightforward

Existing benchmark video:
- `Xs0Lxif1u9E` (43 segments, deterministic path — from benchmark-latest.json)

Recommended additions:
- 1 educational/lecture video (~5-10 min, clear monologue)
- 1 news broadcast clip (NHK-style, formal speech)

### 2.2 Fast Speech / Dialogue

Description:
- rapid conversational Japanese or multi-speaker dialogue
- overlapping turn-taking, short utterances, frequent topic switches
- captions may lag behind actual speech

What it tests:
- merge heuristics do not over-combine short dialogue turns
- boundary selection handles rapid back-and-forth
- minimum duration constraints still hold without swallowing turns

Recommended additions:
- 1 variety show or podcast excerpt with fast crosstalk
- 1 anime clip with subtitle-speed dialogue

### 2.3 Lyrics

Description:
- music video or karaoke content
- line-based structure rather than clause-based
- potentially no sentence-terminal punctuation

What it tests (by phase):

Phase 1-2 (data model + page migration):
- lyric segments are not broken worse than current baseline
- playback safety holds on rhythmic content
- quality score captured as baseline (may be lower than speech — expected)

Phase 4+ (policy branch — future):
- lyrics-lineation policy preserves source line breaks
- speech-utterance heuristics do NOT aggressively regroup lyric lines
- segment quality scorer does not unfairly penalize lyric structure

All phases:
- timing alignment remains safe on rhythmic content

Recommended additions:
- 1 J-pop music video with auto-generated captions
- 1 karaoke video with manual captions (line-per-line)

### 2.4 Noisy / Bad Captions

Description:
- auto-generated captions with errors, repetition, or bad timing
- possible character-level fragmentation
- missing or broken punctuation

What it tests:
- deterministic fallback remains safe
- tiny duplicate deduplication works
- orphan particle cleanup works
- computed segments are still usable despite source noise
- validation catches truly broken output

Recommended additions:
- 1 user-uploaded video with poor auto-captions
- 1 video with mixed language captions (Japanese + occasional English)

### 2.5 Long Transcript

Description:
- video > 20 minutes with > 200 transcript segments
- tests pipeline performance and scaling

What it tests:
- no performance degradation on large segment counts
- chunk/merge heuristics scale correctly
- validation does not produce false positives on large sets
- quality scoring remains meaningful at scale

Existing benchmark video:
- `t9U8QfOxMMw` (563 segments, AI path — from benchmark-latest.json)

Recommended additions:
- 1 video > 30 minutes with > 400 segments

## 3. Baseline Capture

Before any PracticeSegment architecture code is merged, capture for each benchmark video:

| Metric | Source |
|---|---|
| total segment count | transcript route response |
| quality score (overall) | `computeSegmentQuality()` |
| sentenceTerminalRatio | `computeSegmentQuality()` |
| durationInRangeRatio | `computeSegmentQuality()` |
| textLengthInRangeRatio | `computeSegmentQuality()` |
| overlap count | `validateResegmentedOutput()` |
| short text ratio | segment stats |
| tiny fragment ratio | segment stats |
| broken fragment ratio | segment stats |
| processing source (deterministic / ai) | route metadata |

## 4. Per-Phase Evaluation Questions

For every phase, evaluate every benchmark video against:

1. Is this the right thing to repeat?
2. Does the player stop and restart exactly there?
3. Did the new architecture improve or degrade quality score?
4. Are low-confidence segments identifiable? (Phase 1+: via metadata; visible in benchmark reports)

Phase 4+ only (not a gate for Phases 1-3):
5. Do lyrics get preserved by the policy branch?

## 5. Instrumentation Fields To Track

Once Agent 01 lands the new types, benchmark reports should include:

| Field | Type | Source |
|---|---|---|
| `contentKind` | string enum | computed segment |
| `segmentationPolicy` | string enum | computed segment |
| `boundaryMethod` | string enum | computed segment |
| `timingMethod` | string enum | computed segment |
| `boundaryConfidence` | number (0-1) | computed segment |
| override count | number | final segments with `isUserEdited === true` |

## 6. Benchmark Execution

### Automated

Run the existing benchmark harness against all videos in the set:
```bash
# existing pattern from benchmark-latest.json
node scripts/benchmark-transcripts.js --videos <videoIds> --lang ja
```

### Manual

Use the manual QA checklist (see `QA_CHECKLIST.md`) on at least one video per category after each phase merge.

## 7. Pass / Fail Criteria

A phase passes the benchmark gate if:

1. No overlap regressions on any benchmark video
2. Quality score does not decrease by more than 5% on any video
3. No new validation errors that were not present in the baseline
4. Manual QA checklist passes on spot-checked videos
5. Deterministic fallback still produces usable output when AI is disabled
