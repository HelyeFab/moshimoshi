# Agent Dispatch Order

Last updated: 2026-03-12

Purpose:
- define the recommended order for dispatching research agents
- explain why that order matters
- prevent parallel research from becoming unfocused or redundant

## 1. Short Answer

Yes, agents should follow a deliberate order.

There is a dependency chain between the research topics:

`better segmentation boundaries` -> `timing recovery / alignment` -> `product benchmark` -> `broader methods` -> `audio-enhanced methods` -> `fallback correction UX`

If research is dispatched randomly, the outputs become harder to compare and less useful for design decisions.

## 2. Recommended Plan

Use a two-wave dispatch strategy.

### Wave 1: Core decision-making inputs

Dispatch these first:

1. `01-japanese-segmentation-and-punctuation.md`
2. `02-forced-alignment-and-timing.md`
3. `03-competitive-teardown.md`

Why these first:
- `01` addresses the core bottleneck directly: meaningful segmentation
- `02` tells us whether better boundaries can remain loop-safe
- `03` tells us what best-in-class should actually look and feel like

These three define:
- how much quality can come from text segmentation
- how timing can be preserved or recovered
- what product standard we are aiming toward

### Wave 2: Expansion and fallback paths

Dispatch these after Wave 1:

4. `04-subtitle-to-utterance-segmentation.md`
5. `05-prosody-and-pause-segmentation.md`
6. `06-editable-fallback-ux.md`

Why these second:
- `04` expands the method space after the core Japanese-specific research
- `05` explores whether audio/prosody meaningfully improves over text-first methods
- `06` should be informed by what automatic segmentation can and cannot realistically solve

## 3. Exact Recommended Order

If dispatching one by one:

1. Japanese segmentation and punctuation restoration
2. Forced alignment and timing refinement
3. Competitive teardown of Miraa and adjacent tools
4. Subtitle-to-utterance segmentation research
5. Prosody-aware and pause-aware segmentation
6. Editable fallback UX

## 4. Best Parallelization Strategy

If you have multiple agents and want speed without losing structure:

### Recommended parallel Wave 1

Run these three in parallel:
- `01-japanese-segmentation-and-punctuation.md`
- `02-forced-alignment-and-timing.md`
- `03-competitive-teardown.md`

Then review all three together before dispatching the next set.

### Recommended parallel Wave 2

After reviewing Wave 1, run:
- `04-subtitle-to-utterance-segmentation.md`
- `05-prosody-and-pause-segmentation.md`
- `06-editable-fallback-ux.md`

## 5. Why This Order Matters

### 5.1 Topic 01 must come early

This is the main bottleneck.

The current diagnosis is:
- transcript retrieval is reasonably strong
- repeat-loop mechanics are reasonably strong
- meaningful segmentation is the weakest part of the feature

So the first research effort should attack that exact weakness.

### 5.2 Topic 02 depends on Topic 01 conceptually

Improved text boundaries are only useful if they can be timed safely.

Forced alignment and timing refinement research tells us:
- whether better practice units can remain loop-safe
- whether the current timing model is enough
- whether a new alignment layer is needed

### 5.3 Topic 03 prevents local optimization

Without a product benchmark, technical research can optimize for the wrong thing.

We need to know:
- what 10/10 feels like in the market
- whether leading products expose imperfect segmentation differently
- what product decisions compensate for imperfect automation

### 5.4 Topics 04 and 05 are second-order expansion

These are valuable, but only after we understand:
- the best Japanese-specific text-first path
- the timing story
- the product target

Otherwise they can widen the search too early.

### 5.5 Topic 06 should be informed by technical limits

Editable fallback UX is important, but only after we know:
- what automatic segmentation can likely solve
- what failure cases will remain
- whether user correction is rare or central

Otherwise the fallback UX may be designed around the wrong edge cases.

## 6. What To Do After Wave 1

Before dispatching Wave 2, synthesize the first three reports around these questions:

1. Can Japanese text-first segmentation plausibly get us near target quality?
2. If yes, can timing be preserved or recovered cheaply enough?
3. What does best-in-class product behavior suggest we should optimize for?

This determines whether Wave 2 should focus more on:
- broader segmentation methods
- audio/prosody enhancement
- or editable fallback

## 7. Minimum Viable Dispatch If Resources Are Limited

If only 1 agent:
- dispatch `01-japanese-segmentation-and-punctuation.md`

If only 2 agents:
- dispatch `01-japanese-segmentation-and-punctuation.md`
- dispatch `02-forced-alignment-and-timing.md`

If only 3 agents:
- dispatch Wave 1 only

This is the highest-value cutoff.

## 8. Bottom Line

Recommended operational plan:

- First wave:
  - Japanese segmentation and punctuation
  - Forced alignment and timing
  - Competitive teardown
- Review
- Second wave:
  - Subtitle-to-utterance methods
  - Prosody and pause methods
  - Editable fallback UX

This order keeps the research aligned to the actual bottleneck:

`turning noisy Japanese captions into meaningful, repeat-worthy, timing-safe shadowing units`

