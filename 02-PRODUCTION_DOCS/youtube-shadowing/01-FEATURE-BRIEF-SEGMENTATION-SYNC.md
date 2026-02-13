# Feature Brief: YouTube Shadowing Segmentation + Sync

## Purpose and Scope
Improve the shadowing experience by producing repeat-friendly transcript units and maintaining strict audio-text alignment during playback and loop/repeat operations.

In scope:
- Transcript segmentation/chunking/sentence-boundary logic.
- Segment timing integrity and loop boundary behavior.
- Desync detection and correction strategies.
- Optional AI post-processing path if justified by data.

Out of scope (for this phase unless blocking):
- Full UI redesign.
- New monetization/entitlement policy changes.
- Non-shadowing feature refactors.

## Key Flows
1. User loads YouTube video.
2. Transcript is extracted, normalized, segmented, and cached.
3. Player reveals transcript progressively and highlights current segment.
4. User repeats current segment or sentence-level unit.
5. Playback loops accurately to segment boundaries without drift.

## Core Entities and State Transitions
- `TranscriptSegment`: raw extracted unit with `start/end/text`.
- `PracticeSegment`: learner-facing repeat unit derived from one or more transcript segments.
- `PlaybackState`: playing, paused, seeking, looping.
- `SyncState`: in-sync, mild drift, hard drift.

State transition expectations:
1. `raw transcript` -> `normalized transcript` -> `practice segments`.
2. `playing` + clock updates -> `active segment index`.
3. `active segment + repeat mode` -> controlled seek/loop behavior.
4. `drift detected` -> correction strategy (index correction, seek nudge, or boundary recalculation).

## Must-Not-Break Assumptions
- Segment order and monotonic timestamps must remain stable.
- Repeat modes must preserve existing user intent semantics.
- Progressive transcript loading cannot reorder or skip logical units.
- Tracking/analytics failures must never block playback.
- Existing API contracts and feature entitlements remain backward compatible.

## Known Constraints
- YouTube transcript quality is inconsistent (timing jitter, over-fragmentation, punctuation gaps).
- Browser timing and player state callbacks are not perfectly deterministic.
- Mobile environments have higher event latency and clock jitter.
- Any AI augmentation must have deterministic fallbacks and bounded latency/cost.
