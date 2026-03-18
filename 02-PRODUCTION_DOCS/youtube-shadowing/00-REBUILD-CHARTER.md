# Rebuild Charter

Mission:
- rebuild Moshi Player from scratch
- keep previous knowledge only as background judgment
- do not inspect or borrow logic from the previous YouTube shadowing implementation during design or implementation

Allowed:
- shared app routing
- shared auth
- shared UI primitives
- shared i18n
- generic utilities that are not part of the old Moshi Player logic

Not allowed:
- importing old YouTube shadowing player logic
- reusing old transcript segmentation code
- reusing old repeat / sync behavior
- inheriting old architecture by default

Core principle:
- playback trust comes before segmentation sophistication

Success order:
1. load a link and play continuously without unnatural skips
2. loop the whole video from the beginning using the same player cleanly
3. only then introduce segmentation
