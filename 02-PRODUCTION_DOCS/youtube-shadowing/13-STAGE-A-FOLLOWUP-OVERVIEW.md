# Stage A Follow-Up Overview

This follow-up exists to correct one product gap in Stage A.

Stage A is not just:
- load any transcript

It must be:
- load a Japanese transcript for Japanese practice

## Required product behavior

When a user loads a video in Moshi Player:
- if a Japanese transcript exists, prefer that transcript
- if Japanese is not available, do not treat another language as success
- return a clear unavailable state instead

## Still out of scope

- segmentation
- transcript cleanup
- AI processing
- multi-provider fallback stack
- transcript merging/chunking

## Principle

The Stage A player must remain simple, but it cannot be language-agnostic if the feature itself is Japanese-learning specific.
