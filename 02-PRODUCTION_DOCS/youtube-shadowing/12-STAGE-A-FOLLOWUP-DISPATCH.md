# Stage A Follow-Up Dispatch

This is a narrow follow-up pass for Stage A.

Reason:
- Stage A must be Japanese-specific
- the current rebuild-owned transcript route is clean, but it still accepts the default transcript rather than explicitly preferring Japanese

## Dispatch Order

1. `Agent A2 Follow-Up — Japanese Transcript Selection`
2. `Agent A3 Follow-Up — Validation Delta`

Run in this order:
- `A2` first
- `A3` after `A2` lands

Do not dispatch:
- Stage B work
- segmentation work
- any old-pipeline compatibility work

This follow-up is only about transcript language selection behavior in Stage A.
