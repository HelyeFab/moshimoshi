# Stage A Dispatch Order

This document defines the dispatch order for Stage A only.

## Agents

1. `Agent A1 — Foundation and Player Shell`
2. `Agent A2 — Transcript Fetch and Display`
3. `Agent A3 — Validation and QA`

## Order

### Wave 1

Dispatch in parallel:
- `Agent A1`
- `Agent A3`

Reason:
- A1 builds the new Stage A player shell
- A3 prepares the validation framework and acceptance checks in parallel

### Wave 2

Dispatch after `Agent A1` is accepted:
- `Agent A2`

Reason:
- transcript fetch/display should be integrated into the new Stage A shell, not built against assumptions

### Final Validation

After `Agent A2` is accepted:
- run `Agent A3` validation pass against the implemented Stage A behavior if A3’s first pass was only preparatory

## Short Form

Stage A dispatch sequence:

`A1 + A3(prep)` -> `A2` -> `A3(validation)`

## What not to do

- do not dispatch segmentation work yet
- do not dispatch looping-from-start work yet
- do not dispatch repeat/sync agents yet

Stage A is continuous playback only.
