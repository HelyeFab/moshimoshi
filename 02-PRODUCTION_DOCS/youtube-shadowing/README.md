# YouTube Shadowing Player Documentation

This document is the production-level, single-source-of-truth guide for the YouTube Shadowing feature in Moshimoshi. It is intended to fully onboard a new engineer to the feature without needing to read source code first.

If you change the feature, update this file.

---

## 0. Start Here (Session Handoff)

For the latest full technical handoff, current blockers, and exact next implementation plan toward Miraa-grade quality, read:

- `02-PRODUCTION_DOCS/youtube-shadowing/08-ULTIMATE-HANDOFF-FOR-NEXT-SESSION.md`
- `02-PRODUCTION_DOCS/youtube-shadowing/09-BENCHMARK-HARNESS.md` (repeatable benchmark runbook)
- `02-PRODUCTION_DOCS/youtube-shadowing/MVP-Shadowing-Reliability/10-PRODUCTION-DELIVERY-PLAN.md` (business + technical delivery plan)
- `02-PRODUCTION_DOCS/youtube-shadowing/MVP-Shadowing-Reliability/AI_Actors/README.md` (roles/tasks for Technical Lead + AI agents)

---

## 1. Overview

YouTube Shadowing is an interactive listening and speaking practice experience using YouTube videos. The player combines:
- YouTube video playback
- Transcript extraction and segmentation
- Progressive transcript reveal aligned to playback
- Sentence-level navigation and repeat modes
- Word explanation and translation utilities
- Usage tracking, entitlements, and stats

The primary goal is to help users shadow native speech with tight control over sentence-level repetition and pacing.

---

## 2. User Experience Summary

User-facing flow (happy path):
1. User opens the YouTube Shadowing page.
2. User provides a YouTube URL or selects a featured/popular/series video.
3. App fetches video metadata, channel info, and transcript.
4. Transcript is chunked into sentence-level segments.
5. Player starts; transcript is progressively revealed and synchronized.
6. User uses repeat modes and navigation to practice sentences.
7. Optional: user opens word explanations or transcript translation.
8. Usage is tracked for stats and entitlements.

Key UX expectations:
- Playback should feel responsive even on large transcripts.
- Sentence navigation must be accurate and stable.
- Repeat modes must not “drift” off the intended segment.
- Word explanation and translation must not block playback.
- The UI is optimized for practice, not passive viewing.

---

## 3. Core Concepts

### 3.1 Shadowing
Shadowing means repeating speech immediately after hearing it. The player supports sentence-based repetition and looping to encourage imitation and memorization.

### 3.2 Transcript Segments
Transcripts are broken into segments that align with playback time. Segments are further divided into sentences for navigation and repeat behavior.

### 3.3 Progressive Transcript
Transcripts are loaded and revealed progressively to avoid blocking UI and to keep the interface focused on the current practice window.

### 3.4 Repeat Modes
Repeat modes control how playback loops and when auto-pauses occur. The repeat logic must remain stable and consistent with the user’s expectations.

---

## 4. System Architecture (High Level)

The feature is built from these layers:
- UI pages and components
- Client hooks for transcript state, tracking, and word explanations
- API routes for YouTube extraction, transcript translation, and stats tracking
- Utilities for YouTube helpers, transcript chunking, and repeat logic
- Entitlements and feature flags

Primary entry points:
- Page: `src/app/[locale]/youtube-shadowing/page.tsx`
- Player: `src/components/shadowing/MoshiShadowingPlayer.tsx`

---

## 5. Data Model

### 5.1 Key types
- YouTube video types: `src/types/youtube-player.ts`
- Shadowing types: `src/types/youtubeShadowing.ts`
- Series types: `src/types/youtube-series.ts`
- Feature IDs: `src/types/FeatureId.ts`
- Shadowing component types: `src/components/shadowing/types/index.ts`

### 5.2 Important objects
- Video metadata: title, duration, channel, and thumbnails
- Transcript segment: text plus start/end timestamps
- Sentence: derived unit used for repeat and navigation
- Practice tracking event: records playback and session signals

---

## 6. UI & Component Map

Primary UI:
- `src/app/[locale]/youtube-shadowing/page.tsx`
- `src/app/[locale]/youtube-shadowing/layout.tsx`

Core components:
- Player: `src/components/shadowing/MoshiShadowingPlayer.tsx`
- Repeat controls: `src/components/shadowing/shared/RepeatControls.tsx`
- Sentence display: `src/components/shadowing/shared/SentenceDisplay.tsx`
- Navigation: `src/components/shadowing/shared/NavigationControls.tsx`
- Channel banner: `src/components/shadowing/ChannelBanner.tsx`
- YouTube icon button: `src/components/shadowing/YouTubeButton.tsx`

Styles:
- `src/app/[locale]/youtube-shadowing/page.module.css`
- `src/components/shadowing/MoshiShadowingPlayer.module.css`
- `src/components/shadowing/ChannelBanner.module.css`
- `src/components/shadowing/YouTubeButton.module.css`

Related pages:
- Popular videos: `src/app/[locale]/popular-videos/page.tsx`
- Series index: `src/app/[locale]/youtube-series/page.tsx`
- My videos: `src/app/[locale]/my-videos/page.tsx`

---

## 7. Transcript Pipeline

Transcript flow (end-to-end):
1. UI requests video info and transcript via API routes.
2. Transcript is extracted from YouTube sources or a cached/edited version.
3. Transcript segments are chunked and sentence-split.
4. If the transcript is over-split into micro-segments, a merge pass combines short fragments into logical units.
4. Progressive transcript state loads and reveals chunks as the user progresses.

Key logic:
- Chunking: `src/lib/transcript/chunkSegments.ts`
- Cache: `src/lib/transcript/cache.ts`
- Merge micro-segments: `src/lib/transcript/mergeSegments.ts`
- Sentence split: `src/utils/sentenceSplitter.ts`
- User-edited transcript merge: `src/utils/userEditedTranscripts.ts`
- Progressive loading: `src/hooks/useProgressiveTranscript.ts`
- Transcript cache hook: `src/hooks/useTranscriptCache.ts`

Behavioral constraints:
- Do not change chunk boundaries without considering player sync.
- Merge heuristics should only reduce micro-segments; avoid creating giant blocks.
- Sentence boundaries must remain aligned with playback timings.
- Progressive loading must not reorder segments.

---

## 8. Player & Repeat Logic

### 8.1 Repeat engine
The repeat loop logic is centralized in:
- `src/lib/shadowing/repeat.ts`

Tests:
- `src/lib/shadowing/__tests__/repeat.test.ts`

This module defines the expected behavior for:
- Single-sentence repeats
- Segment loops
- Stop conditions and thresholds

### 8.2 Player synchronization
Synchronization relies on:
- `src/utils/youtubePlayerUtils.ts`
- `src/utils/youtubeHelpers.ts`

Tests:
- `src/utils/__tests__/youtubePlayerUtils.enhanced.test.ts`

Critical invariants:
- Time calculations must be precise and stable.
- Sentence index progression must never skip unless explicitly requested.

---

## 9. Word Explanation Fast Path

Word explanation is an auxiliary feature, not part of the core playback flow. It must remain fast and non-blocking.

Relevant files:
- Hook: `src/hooks/useWordExplanation.ts`
- API: `src/app/api/word/explain/route.ts`
- Precompute helpers: `src/lib/ai/precompute/wordPrecompute.ts`
- Precompute routes:
  - `src/app/api/word/precompute/route.ts`
  - `src/app/api/word/precompute/fetch/route.ts`

Constraints:
- Requests should be cancellable or tolerant of rapid navigation.
- Avoid coupling word explanations to playback state.

---

## 10. Translation Support

Translation is handled through API routes and can be requested on-demand:
- `src/app/api/transcript/translate/route.ts`
- `src/app/api/youtube/transcript/translate/route.ts`

The player consumes the translated transcript but must keep the original timing alignment intact.

Current behavior:
- When translation is enabled, the player queues a background transcript translation job.
- If the current segment has no translation, the player immediately requests a per-segment translation via `POST /api/translate` and shows a loading placeholder.
- The per-segment result is persisted into the transcript cache via:
  - `src/app/api/youtube/transcript/segment-translation/route.ts`

---

## 11. Analytics & Tracking

Tracking is handled through hooks and API routes:
- Practice tracking: `src/hooks/useYouTubePracticeTracking.ts`
- Practice API: `src/app/api/practice/track/route.ts`
- Visit tracking: `src/app/api/youtube/track-visit/route.ts`
- Stats hook: `src/hooks/useYouTubeStats.ts`

Constraints:
- Tracking must not block playback or UI rendering.
- Failure to track should never surface as a UI error.

---

## 12. YouTube API / Extraction Routes

Core extraction and metadata routes:
- Video info: `src/app/api/youtube/video-info/route.ts`
- Channel info: `src/app/api/youtube/channel-info/route.ts`
- Transcript extraction: `src/app/api/youtube/extract/route.ts`
- Transcript by video ID: `src/app/api/youtube/transcript/[videoId]/route.ts`
- Native transcript: `src/app/api/youtube/native-transcript/[videoId]/route.ts`
- Captions: `src/app/api/youtube/captions/route.ts`
- Segment translation persistence: `src/app/api/youtube/transcript/segment-translation/route.ts`

Supporting routes:
- Featured videos: `src/app/api/youtube/featured/route.ts`
- Popular videos: `src/app/api/youtube/popular/route.ts`
- Popular cache control: `src/app/api/youtube/popular/cache.ts`
- Clear popular cache: `src/app/api/youtube/popular/clear-cache/route.ts`
- Series list: `src/app/api/youtube/series/route.ts`

Low-level client:
- `src/lib/youtube/client.ts`

Constraints:
- Extraction routes are performance sensitive; prefer cached responses.
- Do not duplicate extraction logic in the UI.

---

## 13. Discovery, Series, and Admin

Discovery surfaces:
- Popular videos page: `src/app/[locale]/popular-videos/page.tsx`
- Series page: `src/app/[locale]/youtube-series/page.tsx`
- My videos page: `src/app/[locale]/my-videos/page.tsx`

Admin controls:
- Admin series page: `src/app/[locale]/admin/youtube-series/page.tsx`
- Admin series API: `src/app/api/admin/youtube-series/route.ts`
- Admin series sync: `src/app/api/admin/youtube-series/sync/route.ts`
- Admin video delete: `src/app/api/admin/videos/delete/route.ts`

---

## 14. Entitlements & Feature Flags

Entitlements and gating patterns:
- Registry: `src/lib/features/registry.ts`
- Flags: `src/lib/features/featureFlags.ts`
- Runtime flags: `src/lib/features/runtimeFeatureFlags.ts`
- Policies: `src/lib/entitlements/policy.ts`
- Evaluator: `src/lib/entitlements/evaluator.ts`
- Server entry: `src/lib/entitlements/server.ts`
- UI indicator: `src/components/entitlements/FeatureUsageIndicator.tsx`
- Hook: `src/hooks/useFeature.ts`

Expectations:
- The player should respect feature limits (guest/free/premium).
- Always use existing entitlements utilities; do not roll your own gating.

---

## 15. Caching & Performance

Caching is used for:
- Transcript data (avoid refetching large transcripts)
- Popular video lists
- Extracted or normalized metadata

Key files:
- `src/lib/transcript/cache.ts`
- `src/utils/furiganaOverrides.ts`
- `src/app/api/youtube/popular/cache.ts`

Guidelines:
- Do not keep entire transcripts in React state without chunking.
- Progressive loading is required for responsiveness.

---

## 16. Testing

Key tests:
- Repeat logic: `src/lib/shadowing/__tests__/repeat.test.ts`
- Progressive transcript: `src/hooks/__tests__/useProgressiveTranscript.test.tsx`
- YouTube player utils: `src/utils/__tests__/youtubePlayerUtils.enhanced.test.ts`
- Extraction route tests: `src/app/api/youtube/extract/__tests__/route.test.ts`

When adding new behavior:
1. Extend repeat tests for loop behavior changes.
2. Add progressive transcript tests if chunking or timing changes.
3. Add API tests for extraction/translation changes.

---

## 17. Known Edge Cases

- Videos with missing or auto-generated captions.
- Transcripts with very long sentences or no punctuation.
- Large transcripts causing slow UI if not chunked.
- YouTube playback drift due to buffering or slow network.
- User-edited transcript mismatching the original timestamps.
- Frequent rapid navigation causing overlapping playback events.
- Furigana overrides are local-only (IndexedDB) and won't sync across devices.

---

## 18. Furigana Overrides (Local)

The Shadowing UI uses `GrammarHighlightedText` for furigana. Users can override readings per token.

Behavior:
- Tap the furigana reading to edit.
- Overrides are stored in IndexedDB and applied before API-generated readings.
- Overrides are scoped per context (e.g. `youtube:{videoId}`).

Key files:
- UI: `src/components/reading/GrammarHighlightedText.tsx`
- Storage: `src/utils/furiganaOverrides.ts`

Limitations:
- Overrides are local-only and not synced to Firebase.

---

## 19. Troubleshooting Checklist

If the player appears desynced:
1. Verify transcript chunk boundaries and sentence splitting.
2. Check player time calculations in `youtubePlayerUtils`.
3. Confirm repeat logic thresholds in `repeat.ts`.

If transcript doesn’t load:
1. Check extraction route logs.
2. Verify YouTube API client configuration.
3. Inspect transcript cache usage.

If the UI is slow:
1. Ensure progressive transcript is active.
2. Avoid rendering full transcript on every update.
3. Check for expensive computations inside render.

---

## 20. Extension Points

Safe extension points:
- Add new repeat modes by extending `repeat.ts` and updating RepeatControls UI.
- Add transcript tooling by extending `useProgressiveTranscript` with new flags.
- Add new discovery surfaces using existing API routes.

Avoid:
- Changing transcript segmentation without updating repeat logic.
- Replacing YouTube extraction flows outside API routes.
- Introducing new feature gating patterns.

---

## 21. Quick Reference: File Index

Primary pages:
- `src/app/[locale]/youtube-shadowing/page.tsx`
- `src/app/[locale]/popular-videos/page.tsx`
- `src/app/[locale]/youtube-series/page.tsx`

Core components:
- `src/components/shadowing/MoshiShadowingPlayer.tsx`
- `src/components/shadowing/shared/SentenceDisplay.tsx`
- `src/components/shadowing/shared/RepeatControls.tsx`
- `src/components/shadowing/shared/NavigationControls.tsx`

Hooks:
- `src/hooks/useProgressiveTranscript.ts`
- `src/hooks/useTranscriptCache.ts`
- `src/hooks/useYouTubePracticeTracking.ts`
- `src/hooks/useYouTubeStats.ts`
- `src/hooks/useWordExplanation.ts`
- `src/hooks/useFeature.ts`

Core libs:
- `src/lib/shadowing/repeat.ts`
- `src/lib/transcript/chunkSegments.ts`
- `src/lib/transcript/mergeSegments.ts`
- `src/lib/transcript/cache.ts`
- `src/utils/youtubePlayerUtils.ts`
- `src/utils/youtubeHelpers.ts`
- `src/utils/sentenceSplitter.ts`
- `src/utils/userEditedTranscripts.ts`
- `src/utils/furiganaOverrides.ts`

APIs:
- `src/app/api/youtube/extract/route.ts`
- `src/app/api/youtube/transcript/[videoId]/route.ts`
- `src/app/api/youtube/native-transcript/[videoId]/route.ts`
- `src/app/api/youtube/transcript/segment-translation/route.ts`
- `src/app/api/youtube/video-info/route.ts`
- `src/app/api/youtube/channel-info/route.ts`
- `src/app/api/practice/track/route.ts`
- `src/app/api/youtube/track-visit/route.ts`
- `src/app/api/word/explain/route.ts`
- `src/app/api/transcript/translate/route.ts`

---

## 21. Ownership Notes

This feature is sensitive to timing and segmentation. The safest way to modify behavior is to:
1. Identify the existing logic in the relevant utility or hook.
2. Extend the current behavior rather than replacing it.
3. Validate with repeat and progressive transcript tests.

This document should stay in sync with feature behavior. If you change behavior, update this file.
