# Linear Progression

This rebuild must move in order and must not skip ahead.

## Stage A

Goal:
- accept a YouTube link
- fetch transcript
- play the video continuously

Deliberately excluded:
- repeat by segment
- transcript segmentation
- edit mode
- translation polish

Acceptance gate:
- playback feels natural
- no audible micro-skips caused by our control logic
- transcript loads and is visible

## Stage B

Goal:
- keep Stage A behavior
- add full-video looping from the start using the same player

Deliberately excluded:
- segmentation
- per-segment repeat

Acceptance gate:
- looping back to the start is reliable
- no drift or broken state after multiple loops

## Stage C

Goal:
- segment transcript into proper repeat-worthy units comparable in quality to Miraa

Constraint:
- Stage C does not begin until Stages A and B are trustworthy

Acceptance gate:
- segment boundaries are meaningful
- text and audio correspond
- segmentation can be evaluated without playback trust being in doubt
