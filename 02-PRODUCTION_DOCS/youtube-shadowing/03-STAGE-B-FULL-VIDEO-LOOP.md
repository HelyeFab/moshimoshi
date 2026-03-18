# Stage B: Full-Video Loop

Scope:
- everything from Stage A
- add loop-from-start for the whole video

Required behavior:
- user can enable loop for the whole video
- when the video ends, playback restarts from the beginning
- state remains stable over repeated full-video loops

What to prove:
- end-of-video handling is reliable
- restarting from zero does not create drift
- transcript display remains stable while looping

Explicit non-goals:
- no transcript segmentation
- no per-segment loop
- no repeat counters by segment

Primary question:
- can the player restart cleanly from the beginning without corrupting playback or transcript state?
