# Stage A Execution Overview

Stage A is the first implementation stage of the Moshi Player rebuild.

Goal:
- accept a YouTube link
- fetch transcript data
- render transcript text
- play the video continuously

What we are not building yet:
- transcript segmentation
- repeat-by-segment
- edit mode
- transcript-driven playback control
- any logic that pauses, seeks, or restarts playback at transcript boundaries

Why this stage exists:
- the previous implementation failed on trust
- playback and transcript were not reliably aligned
- music playback could sound chopped, skip small pieces, or restart at the wrong point
- before we build segmentation, we need a player that can simply play through naturally

Product meaning of success:
- user pastes a link
- transcript loads
- the video plays naturally
- transcript display does not break playback

Engineering meaning of success:
- transcript fetch is decoupled from playback control
- no transcript logic manipulates the player timeline during normal play
- the player can run continuously without audible micro-cuts caused by our code

Allowed dependencies:
- shared routing
- shared auth
- shared UI primitives
- shared i18n
- generic app utilities

Not allowed:
- importing the old YouTube shadowing player logic
- copying previous transcript control logic
- borrowing segmentation logic from the prior implementation

Stage A acceptance criteria:
1. User can paste a valid YouTube URL and load the video.
2. Transcript fetch succeeds when transcript is available.
3. Transcript is rendered in the UI.
4. Playback remains continuous and natural.
5. No transcript-derived seek / pause / re-entry control exists in this stage.
6. A problematic music video can play through without our player logic chopping the flow.
