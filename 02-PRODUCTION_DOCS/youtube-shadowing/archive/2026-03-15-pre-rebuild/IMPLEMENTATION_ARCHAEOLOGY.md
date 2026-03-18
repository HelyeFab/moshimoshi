# YouTube Shadowing Implementation Archaeology

Last updated: 2026-03-12
Scope: map the historical and current implementation of the Moshi Player / YouTube Shadowing feature, with explicit dependency boundaries.

## 1. What "Moshi Player" Means In This Repo

In product language, "Moshi Player" is the immersion-practice player concept.
For YouTube specifically, it maps to the `/youtube-shadowing` route and the YouTube Shadowing feature.

Important distinction:
- The current live YouTube runtime is the page at `src/app/[locale]/youtube-shadowing/page.tsx`.
- The component `src/components/shadowing/MoshiShadowingPlayer.tsx` is a generic sentence shadowing player for `article | story | book` content, not the active YouTube runtime.

## 2. Two Eras Of The Feature

### 2.1 Older architecture: raw transcript first, AI enhancement second

This era centered on:
- `src/hooks/useProgressiveTranscript.ts`
- `src/app/api/youtube/extract/route.ts`

Design goal:
- fetch a usable transcript quickly
- let the user start shadowing immediately
- improve transcript formatting in the background with AI

This stack also handled:
- transcript extraction
- AI formatting
- YouTube history persistence
- quota checks
- some metadata and caption-source handling

This architecture is still present in the repo, but it is no longer the primary runtime path used by the current `/youtube-shadowing` page.

### 2.2 Current architecture: sync-safe segmented shadowing

The live stack centers on:
- `src/app/[locale]/youtube-shadowing/page.tsx`
- `src/app/api/youtube/transcript/[videoId]/route.ts`
- `src/lib/transcript/*`
- `src/utils/youtubePlayerUtils.ts`
- `src/lib/shadowing/repeat.ts`

Design goal:
- produce loop-safe, repeat-friendly transcript units
- prevent desync between highlighted text and audio
- reduce next-segment audio bleed at repeat boundaries
- allow AI to improve segmentation without making playback unsafe

The current design is reliability-first, with deterministic fallback always available.

## 3. Current Dependency Matrix

| Area | File | Purpose | Inputs | Outputs | Hard Dependencies | AI Dependency | Runtime Status |
|---|---|---|---|---|---|---|---|
| Page runtime | `src/app/[locale]/youtube-shadowing/page.tsx` | Main YouTube shadowing UI and orchestration | YouTube URL/ID, transcript API responses, player events | Rendered player UI, loaded segments, repeat state, translation state | `react-youtube`, transcript route, repeat logic, seek utils, word hook, tracking hook | Optional | Current |
| Transcript fetch | `src/app/api/youtube/transcript/[videoId]/route.ts` | Main transcript retrieval and processing pipeline | `videoId`, transcript sources, cached transcript | Transcript segments with timing, source metadata, processing metadata | `youtubei.js`, transcript cache, transcript processing helpers | Yes, but fallback-safe | Current |
| Transcript cache | `src/lib/transcript/cache.ts` | Persist transcript and metadata | `contentId`, transcript lines, metadata | Cached transcript docs / storage objects | Firebase admin, storage bucket | No | Current |
| Deterministic chunking | `src/lib/transcript/chunkSegments.ts` | Split long or badly formed text into shadowing-sized chunks | `start/end/text` segments | Smaller segments with redistributed timings | `Intl.Segmenter` when available | No | Current |
| Deterministic merging | `src/lib/transcript/mergeSegments.ts` | Merge caption micro-fragments into more natural units | Adjacent transcript segments | Larger merged segments | Local heuristics only | No | Current |
| Segment scoring | `src/lib/transcript/segmentQuality.ts` | Score transcript quality for shadowing suitability | Candidate segments | Quality score + submetrics | Local heuristics only | No | Current |
| AI timing alignment | `src/lib/transcript/aiTimingAlignment.ts` | Map AI-proposed text boundaries back to source timings | AI text list, source timed segments | Re-timed aligned segments or rejection | Source transcript timeline | Yes | Current |
| Repeat state | `src/lib/shadowing/repeat.ts` | Pure state machine for loop/repeat progression | `repeatCount`, `currentRepeat`, `segmentIndex`, `totalSegments` | Next repeat/segment state | None | No | Current |
| Seek/sync utils | `src/utils/youtubePlayerUtils.ts` | Verify seeks and improve segment-end accuracy | YouTube player instance, target time | Seek verification result, buffer calculations | YouTube IFrame API | No | Current |
| Practice tracking | `src/hooks/useYouTubePracticeTracking.ts` | Track real practice time and persist it | `videoId`, play state, current time, metadata | Calls to practice API, accumulated practice time | Auth, practice track API | No | Current |
| Practice persistence | `src/app/api/practice/track/route.ts` | Save practice history and user video history | Practice payload from hook | Updated Firebase records | Session/auth, Firestore | No | Current |
| Transcript translation queue | `src/app/api/youtube/transcript/translate/route.ts` | Whole-transcript translation endpoint | `videoId`, mode, async flag | Translation job start/status | Shared transcript translation route | Yes | Current |
| Segment translation persist | `src/app/api/youtube/transcript/segment-translation/route.ts` | Save per-segment translation into transcript cache | `videoId`, segment, translation | Updated cached transcript line | Transcript cache | No | Current |
| Word explanation | `src/app/api/word/explain/route.ts` | Explain clicked words in transcript | Word, context, content metadata | Explanation payload | AI word explanation stack | Yes | Current |
| Word precompute | `src/app/api/word/precompute/route.ts` | Prefetch likely word explanations | Transcript text batches | Cached/precomputed explanations | Word explanation pipeline | Yes | Current |
| Video metadata | `src/app/api/youtube/video-info/route.ts` | Fetch title/channel/thumbnail | YouTube URL | Video metadata | YouTube info fetch path | No | Current |
| Featured video | `src/app/api/youtube/featured/route.ts` | Supply curated default video | None | Featured video card data | Data source / config | No | Current |
| Manual AI resegment | `src/app/api/youtube/resegment/route.ts` | Re-run transcript segmentation on demand | `videoId`, current segments | Resegmented transcript, source/fallback metadata | Resegmentation helpers, cache | Yes with deterministic fallback | Current |
| Generic Moshi player | `src/components/shadowing/MoshiShadowingPlayer.tsx` | TTS/cached-audio shadowing for non-YouTube content | Sentences, contentId/type, settings | Local shadowing playback UI | TTS hook, repeat state, word explanation | Indirectly for word explanation only | Current but not YouTube runtime |
| Progressive transcript hook | `src/hooks/useProgressiveTranscript.ts` | Old fast-raw-then-AI transcript strategy | YouTube URL, options | Raw transcript then AI-enhanced transcript | `/api/youtube/extract`, toasts, transcript quality | Yes | Legacy for YouTube runtime |
| Legacy extract route | `src/app/api/youtube/extract/route.ts` | Older all-in-one transcript extraction, AI formatting, quota/history path | URL, provider/options | Raw/formatted transcript and metadata | `ytdl`, `youtube-captions-scraper`, `youtubei.js`, AI service, Firestore | Yes | Legacy for main runtime |

## 4. What Is Actually Critical

### 4.1 Hard requirements for the feature to work

Required:
- transcript extraction / retrieval
- deterministic transcript processing
- repeat state machine
- player seek/sync correctness

If transcript extraction fails, the YouTube shadowing feature is effectively unusable.
Without a transcript there is no:
- segment list
- repeat boundary
- transcript navigation
- word context
- translation context

### 4.2 What AI changes

AI is not the base runtime requirement.
AI improves:
- segment naturalness
- sentence boundaries
- difficult transcript cleanup
- translation and word explanation quality

If AI is disabled or rejected:
- the user can still load a transcript
- the user can still repeat segments
- the user can still practice
- the experience degrades mainly in transcript quality on difficult videos

### 4.3 What is auxiliary

Optional but valuable:
- full transcript translation
- per-segment translation
- word explanation
- history and practice analytics

These should not block playback.

## 5. Current Runtime Sequence: Paste URL To Active Shadowing Session

This is the real runtime sequence for the current page.

### Step 1: user provides a YouTube URL or video ID

File:
- `src/app/[locale]/youtube-shadowing/page.tsx`

The page extracts a video ID from user input and starts `loadTranscript()`.

### Step 2: page requests transcript from the current transcript route

Request:
- `GET /api/youtube/transcript/[videoId]`

File:
- `src/app/api/youtube/transcript/[videoId]/route.ts`

This route is the current source of truth for transcript loading.

### Step 3: transcript route attempts retrieval from cache or source providers

The route first tries cached transcript data.
If needed, it fetches transcript data from active providers such as:
- YouTube transcript access through `youtubei.js`
- optional secondary storage providers already wired in the route

Output at this stage:
- raw timed transcript segments

### Step 4: deterministic transcript processing runs

The route cleans and reshapes the transcript using deterministic helpers.

Main processing stages:
- remove tiny duplicate tails or orphan fragments
- merge over-fragmented adjacent caption units
- split long lines into repeat-friendly chunks
- heal broken word boundaries
- rebalance continuation boundaries
- cap very long segments
- enforce non-overlapping monotonic timeline

Files involved:
- `src/lib/transcript/mergeSegments.ts`
- `src/lib/transcript/chunkSegments.ts`
- local helpers inside `src/app/api/youtube/transcript/[videoId]/route.ts`

This stage is the baseline runtime path even if AI is unavailable.

### Step 5: optional AI segmentation enhancement is attempted

The route may run an AI segmentation pipeline.

AI path responsibilities:
- propose better segment text boundaries
- align those text boundaries back onto the original timed source timeline
- validate timing integrity and quality constraints
- reject weak or unsafe AI output

Files involved:
- `src/lib/transcript/aiTimingAlignment.ts`
- `src/lib/transcript/segmentQuality.ts`
- `src/app/api/youtube/transcript/[videoId]/route.ts`

Decision rule:
- if AI output is good and safe, use it
- otherwise return deterministic output

### Step 6: page receives transcript and normalizes playback boundaries

Back in:
- `src/app/[locale]/youtube-shadowing/page.tsx`

The page:
- stores segments in state and refs
- normalizes segment ordering and overlap again for playback safety
- resets repeat counters
- seeks player to the first segment start

This is where transcript data becomes playable practice state.

### Step 7: player sync loop controls segment repetition

The page starts polling the YouTube player during playback.

Files involved:
- `src/app/[locale]/youtube-shadowing/page.tsx`
- `src/lib/shadowing/repeat.ts`
- `src/utils/youtubePlayerUtils.ts`

Runtime behavior:
- read current player time
- compute a safe pre-end trigger buffer
- pause before segment spillover
- compute next repeat state
- seek back to the current or next segment
- verify seek landed correctly
- resume playback

This is the core of the shadowing experience.

### Step 8: user can optionally request AI resegmentation

UI action:
- "AI Resegment" button on the page

Request:
- `POST /api/youtube/resegment`

Behavior:
- send current transcript segments
- attempt AI resegmentation if enabled
- validate result
- fall back to deterministic resegmentation if needed
- replace active page segments with returned result

This is an explicit secondary AI pass, separate from the main transcript load pipeline.

### Step 9: translation can start in the background

When translation is enabled:
- queue transcript translation through `POST /api/youtube/transcript/translate`
- poll translation status
- refresh transcript when translation completes

If the current segment has no translation yet:
- request a per-segment translation
- inject it into local page state
- persist it into transcript cache via `segment-translation`

Translation is additive and should not block playback.

### Step 10: word explanation prefetch and lookup run as study helpers

After transcript load:
- first segments are prefetched immediately
- remaining segments are prefetched in the background

When the user clicks a word:
- the word explanation route is called
- the result is shown in a modal

This is transcript-driven enrichment, not core playback.

### Step 11: practice tracking runs in parallel with playback

Hook:
- `src/hooks/useYouTubePracticeTracking.ts`

The hook:
- accumulates watch/practice time while the player is actually moving
- ignores large seek jumps
- sends practice events after threshold time
- persists remaining time on unload when possible

Server route:
- `src/app/api/practice/track/route.ts`

This is operational tracking, not part of repeat logic.

## 6. Legacy Runtime Sequence: Older Progressive Transcript Model

This flow still exists in code but is no longer the current main path for the page.

### Old path

1. user provides URL
2. `useProgressiveTranscript()` calls `/api/youtube/extract?phase=raw`
3. raw transcript is returned quickly
4. user can begin shadowing immediately
5. if AI is enabled and formatted transcript is not already available:
   - `/api/youtube/extract?phase=enhance` is called
   - AI enhancement runs in background
6. UI swaps from raw transcript to AI-enhanced transcript

This model optimized for:
- fast first usable transcript
- delayed enhancement

The newer path optimized for:
- repeat-loop correctness
- timing stability
- boundary safety

## 7. What To Trust

Trust as current:
- `src/app/[locale]/youtube-shadowing/page.tsx`
- `src/app/api/youtube/transcript/[videoId]/route.ts`
- `src/app/api/youtube/resegment/route.ts`
- `src/lib/transcript/*`
- `src/lib/shadowing/repeat.ts`
- `src/utils/youtubePlayerUtils.ts`
- `src/hooks/useYouTubePracticeTracking.ts`

Treat as legacy or partially superseded for YouTube runtime:
- `src/hooks/useProgressiveTranscript.ts`
- `src/app/api/youtube/extract/route.ts`
- archived progressive transcript docs
- any document that implies `MoshiShadowingPlayer.tsx` is the current YouTube player runtime

## 8. Bottom Line

The current YouTube shadowing feature relies first on transcript extraction and deterministic transcript shaping.
AI is layered on top to improve segmentation quality, but the runtime is deliberately built to keep working without it.

If you are debugging the feature, the first question should be:
- did transcript retrieval succeed?

The second should be:
- are the produced segment timings safe for repeat playback?

Only after that should you ask:
- did AI improve or degrade segment quality?
