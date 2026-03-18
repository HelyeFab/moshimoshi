# Stage A: Continuous Player

Scope:
- one player
- one URL input
- transcript fetch
- continuous playback only

Required behavior:
- user pastes a YouTube URL
- app extracts the video ID
- app fetches transcript data
- app renders transcript text
- app starts and continues playback naturally

Important Stage A constraint:
- if the raw transcript already arrives in high-quality canonical lineation, Stage A must preserve it
- Stage A is allowed to retrieve raw transcript, not reshape it
- do not "improve" lyric line boundaries at this stage

What to prove:
- the player does not cut audio because of transcript logic
- transcript presence does not interfere with continuous playback
- music videos and normal speech can at least play through without our control layer breaking flow

Explicit non-goals:
- no segment-based playback control
- no repeat counts
- no re-entry seek logic
- no edit mode
- no transcript regrouping or beautification

Primary question:
- can we trust the player to play the video naturally while transcript data is loaded alongside it?
