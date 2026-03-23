# Stage C2.5 Overview

## Current State

What is already true:
- Stage C route exists
- Stage C page migration exists
- refinement pass improved obvious failures like:
  - `おはようござい` -> continuation-aware repair
  - `-do` contamination cleaning

What is not yet true:
- the reconstruction layer is not yet bulletproof
- it still relies on deterministic heuristics that can be too brittle

## Why C2.5 Exists

We want to strengthen reconstruction quality without jumping immediately to alignment or AI.

The best next step is not a giant redesign.
It is a targeted internal hardening pass:

- move from coarse global preserve/rebuild choices
- toward local, evidence-based decisions

## Main Design Shift

Instead of asking:
- “is this transcript good?”

ask:
- “is this local region good?”
- “does this boundary look trustworthy?”
- “should this small cluster be preserved, merged, or rebuilt?”

## What H1 Should Build

At minimum:
- local cluster-based preserve/rebuild decisions
- multi-signal scoring for reconstruction
- stronger tests for mixed transcripts containing both good and bad regions

## What Must Stay Stable

- route response shape
- page consumption of `playerSegments`
- provider waterfall
- no new playback features

## What H2 Must Prove

- known benchmark failures stay fixed
- local hardening reduces false positives and false negatives
- mixed local-region transcripts behave better than before
