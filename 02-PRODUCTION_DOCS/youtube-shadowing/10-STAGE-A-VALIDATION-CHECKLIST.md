# Stage A Validation Checklist

Status: **PREPARED** (awaiting implementation for validation pass)

This checklist defines the acceptance validation for Stage A: Continuous Player.

## Core Question

> Can the rebuilt player play continuously and naturally while transcript data is present?

---

## Test Videos

### V1 — Normal Speech Video

**Video**: Miku Real Japanese — Japanese Conversation Practice
**URL**: `https://www.youtube.com/watch?v=uk7gKixqVNU`
**ID**: `uk7gKixqVNU`

Why this video:
- confirmed working in our transcript pipeline (276 transcript lines)
- already used as a curated starter video in production (`/api/youtube/popular`)
- clear Japanese speech with natural pauses
- has Japanese captions available

### V2 — Problematic Music Video

**Video**: RADWIMPS - Topic — Suzume (feat. Toaka)
**URL**: `https://music.youtube.com/watch?v=9LW9DpmhrPE`
**ID**: `9LW9DpmhrPE`

Why this video:
- continuous music (no speech pauses)
- previously exposed severe old-player failures
- now confirmed as a high-value retrieval benchmark
- transcript text can be compared against Google lyric lineation
- audio should flow without interruption when played natively on YouTube

---

## Checklist A: URL Input and Video Loading

| # | Check | Method | Status |
|---|-------|--------|--------|
| A1 | User can paste a valid YouTube URL | Manual: paste URL, observe | - |
| A2 | Video ID is extracted correctly from standard URL format `youtube.com/watch?v=ID` | Manual + code review | - |
| A3 | Video ID is extracted correctly from short URL format `youtu.be/ID` | Manual | - |
| A4 | Invalid URL shows clear error state | Manual: paste garbage | - |
| A5 | Player loads and displays the video | Manual: observe embed | - |
| A6 | Loading state is visible while video initializes | Manual: observe | - |

## Checklist B: Continuous Playback (V1 — Speech)

| # | Check | Method | Status |
|---|-------|--------|--------|
| B1 | Video plays from start when user presses play | Manual | - |
| B2 | Audio plays continuously without micro-cuts | Manual: listen for 60s | - |
| B3 | No audible pauses, skips, or restarts caused by our code | Manual: listen for full duration or 3min | - |
| B4 | Video can be paused and resumed by user without issues | Manual | - |
| B5 | Seeking via YouTube player controls works normally | Manual: drag progress bar | - |
| B6 | Playback reaches the end of the video naturally | Manual: let it play to end | - |

## Checklist C: Continuous Playback (V2 — Music)

| # | Check | Method | Status |
|---|-------|--------|--------|
| C1 | Music video plays from start when user presses play | Manual | - |
| C2 | Audio is continuous — no chopping, no micro-cuts | Manual: listen for 60s | - |
| C3 | Music flows without unnatural interruptions for 3+ minutes | Manual: listen | - |
| C4 | No audible artifacts from our code during continuous play | Manual: listen carefully | - |
| C5 | User can pause and resume without issues | Manual | - |

## Checklist D: Transcript Fetch

| # | Check | Method | Status |
|---|-------|--------|--------|
| D1 | Transcript is fetched when available (V1) | Manual: observe transcript area | - |
| D2 | Transcript data appears in the UI | Manual: observe text rendered | - |
| D3 | Transcript unavailable state is handled gracefully | Manual: use a video without captions | - |
| D4 | Transcript loading state is visible | Manual: observe during fetch | - |
| D5 | Transcript error state is handled | Manual: inspect network tab, simulate failure if possible | - |
| D6 | Japanese transcript is selected when available | Code review + manual: load V1, confirm transcript text is Japanese | - |
| D7 | Non-Japanese transcript is not treated as success | Code review + manual: load an English-only video, confirm unavailable state | - |
| D8 | Unavailable state shows clear message when no Japanese captions exist | Code review + manual: verify error message mentions language | - |
| D9 | If raw transcript already matches canonical lyric lineation, Stage A preserves it without reshaping | Manual: compare V2 transcript against Google/Miraa-style lines | - |

## Checklist E: Decoupling — Transcript Does Not Control Playback

This is the most critical checklist. It validates the core design principle.

| # | Check | Method | Status |
|---|-------|--------|--------|
| E1 | No `seekTo` calls tied to transcript segment boundaries | Code review | - |
| E2 | No `pauseVideo` calls triggered by transcript position | Code review | - |
| E3 | No playback polling that evaluates position against transcript timestamps | Code review | - |
| E4 | No `setInterval` / `requestAnimationFrame` loop that compares `getCurrentTime()` to segment boundaries | Code review | - |
| E5 | No re-entry / settle delay logic | Code review | - |
| E6 | No imports from old YouTube shadowing player logic | Code review | - |
| E7 | No imports from `src/lib/shadowing/repeat.ts` | Code review | - |
| E8 | No imports from `src/utils/youtubePlayerUtils.ts` (old sync utilities) | Code review | - |
| E9 | Transcript rendering is pure display — no side effects on player | Code review | - |
| E10 | Playing V1 with transcript loaded produces identical playback quality to V1 without transcript | Manual: compare feel | - |
| E11 | Playing V2 with transcript loaded produces identical playback quality to V2 without transcript | Manual: compare feel | - |
| E12 | Transcript fetch uses a rebuild-owned API route, not the old `/api/youtube/transcript/[videoId]` pipeline | Code review | - |

## Checklist F: Scope Boundaries — Nothing Extra

| # | Check | Method | Status |
|---|-------|--------|--------|
| F1 | No segmentation logic exists in Stage A code | Code review | - |
| F2 | No repeat-by-segment functionality | Code review | - |
| F3 | No full-video loop logic | Code review | - |
| F4 | No edit mode | Code review | - |
| F5 | No word explanation modals | Code review | - |
| F6 | No translation workflows | Code review | - |
| F7 | No transcript reshaping that breaks already-good raw lineation | Code review + manual | - |

---

## Verdict Categories

Each check item must be marked with one of:

- **CONFIRMED** — validated through the specified method, passes
- **UNVERIFIED** — could not be validated (reason required)
- **FAILED** — validated but does not pass (detail required)

---

## Known Anti-Patterns From Old Implementation

These specific patterns from the old `page.tsx` must be absent in Stage A:

1. **Playback polling loop** — old code used `setInterval(evaluatePlayback, POLL_INTERVAL_MS)` to poll `getCurrentTime()` and compare against segment boundaries. This caused pause/seek at segment ends.

2. **Hard stop at segment boundary** — old code called `player.pauseVideo()` when `currentTime >= segmentEnd`. This is the direct cause of choppy music playback.

3. **Re-entry with settle delay** — old code used `setTimeout` + `seekTo` + `verifySeekLanding` to re-enter segments. This added latency and could misfire.

4. **Adaptive segment end buffer** — old code calculated `safeTriggerBuffer` to anticipate segment ends. This is segmentation control logic.

5. **Repeat state machine driving playback** — old code imported `nextOnSegmentEnd()` from repeat module to decide seek targets. This couples repeat logic to player timeline.

If any of these patterns appear in Stage A code, checklist E items must be marked FAILED.

---

## Automated Checks

See companion files:
- `e2e/stage-a-continuous-player.spec.ts` — Playwright E2E test
- `__tests__/stage-a/no-playback-control-coupling.test.ts` — Static code analysis test

---

## Report Template

After validation pass, fill in:

```
Stage A Validation Report
Date: YYYY-MM-DD
Validator: Agent A3

Video V1: [URL]
Video V2: [URL]

Results:
- Checklist A (URL Input): X/6 CONFIRMED
- Checklist B (Speech Playback): X/6 CONFIRMED
- Checklist C (Music Playback): X/5 CONFIRMED
- Checklist D (Transcript Fetch): X/5 CONFIRMED
- Checklist E (Decoupling): X/11 CONFIRMED
- Checklist F (Scope): X/6 CONFIRMED

Overall: PASS / FAIL

Failed items:
- [list any]

Unverified items:
- [list any with reason]

Residual risks:
- [list any]
```
