# Role: AI Agent — UX Editor Mode

## Mission
Design and implement user-editable transcript controls as a practical fallback for hard videos.

## Scope
- edit mode UI (split/merge first, boundary drag later)
- per-video override persistence
- apply overrides on load and playback
- mobile/desktop usability polish

## Primary Files
- `src/app/[locale]/youtube-shadowing/page.tsx`
- `src/components/shadowing/*`
- transcript override API routes and cache integration

## MVP Deliverables
- split at cursor
- merge with previous/next
- save and reload overrides
- clear/reset overrides

## Done Criteria
- user can fix bad boundaries in-session
- no crash/regression in normal playback path
- override data model documented and tested

