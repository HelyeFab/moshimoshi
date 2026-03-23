# Agent H1: Heuristic Hardening

Read these first, in order:

1. [39-STAGE-C2.5-OVERVIEW.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/39-STAGE-C2.5-OVERVIEW.md)
2. [37-STAGE-C2.5-HEURISTIC-HARDENING.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/37-STAGE-C2.5-HEURISTIC-HARDENING.md)
3. [24-STAGE-C-10-10-ARCHITECTURE.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/24-STAGE-C-10-10-ARCHITECTURE.md)
4. [32-STAGE-C-VALIDATION-REPORT.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/32-STAGE-C-VALIDATION-REPORT.md)
5. [35-STAGE-C-AGENT-R1-RECONSTRUCTION-REFINEMENT.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/35-STAGE-C-AGENT-R1-RECONSTRUCTION-REFINEMENT.md)

Then inspect these files:
- [reconstruction-heuristics.ts](/home/helye/DevProjects/nextjs/moshimoshi/src/lib/moshi-player/reconstruction-heuristics.ts)
- [reconstruct-segments.ts](/home/helye/DevProjects/nextjs/moshimoshi/src/lib/moshi-player/reconstruct-segments.ts)
- [transcript-types.ts](/home/helye/DevProjects/nextjs/moshimoshi/src/lib/moshi-player/transcript-types.ts)
- [route.ts](/home/helye/DevProjects/nextjs/moshimoshi/src/app/api/moshi-player/transcript/%5BvideoId%5D/route.ts)
- [page.tsx](/home/helye/DevProjects/nextjs/moshimoshi/src/app/%5Blocale%5D/moshi-player/page.tsx)

## Your Assignment

Harden the deterministic reconstruction layer without changing the route/page contract.

You are responsible for:
- improving internal reconstruction decisions
- reducing heuristic brittleness
- adding stronger tests for mixed local-region transcripts

You are not responsible for:
- alignment
- AI segmentation
- playback changes
- route/page contract redesign

## Main Goal

Move from brittle global preserve/rebuild behavior toward local, evidence-based decisions.

Examples:
- a transcript can contain one bad intro cluster and many good later lines
- the bad intro should rebuild
- the good later lines should preserve

## Constraints

- keep the current contract shape intact
- no old youtube-shadowing imports
- no scope creep into playback or alignment

## Acceptance Criteria

I will reject if:
- the work changes the route/page contract unnecessarily
- the work broadens into alignment or playback
- the work remains benchmark-hacked instead of improving local reconstruction logic
- tests do not cover mixed good/bad local regions in the same transcript

I will accept if:
- local-region handling is materially improved
- existing fixes remain intact
- tests cover mixed-region behavior and edge cases better than before

## Deliverables

1. Code changes
2. Short delivery summary
3. Explicit list of files changed
4. Acceptance checklist against the criteria above
