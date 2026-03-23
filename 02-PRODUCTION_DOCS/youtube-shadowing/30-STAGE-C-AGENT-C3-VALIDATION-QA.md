# Agent C3: Validation And Benchmark QA

Read these first, in order:

1. [27-STAGE-C-EXECUTION-OVERVIEW.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/27-STAGE-C-EXECUTION-OVERVIEW.md)
2. [24-STAGE-C-10-10-ARCHITECTURE.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/24-STAGE-C-10-10-ARCHITECTURE.md)
3. [25-STAGE-C-IMPLEMENTATION-ROADMAP.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/25-STAGE-C-IMPLEMENTATION-ROADMAP.md)
4. Accepted C1 and C2 deliveries

## Benchmark Videos

Must include:
- `45fMrqfNIXA`
- `9LW9DpmhrPE`
- additional real-video checks beyond the two anchor benchmarks

## What You Must Validate

1. Route contract:
- computed layers exist
- raw transcript and computed segments are separated

2. Page contract:
- transcript UI uses computed player segments
- repeat/shadowing uses computed player segments
- raw transcript is debug-only

3. Benchmark behavior:
- `45fMrqfNIXA` intro fragments are materially cleaner than raw Sheldon rows
- `9LW9DpmhrPE` already-good lineation is preserved and not degraded
- broader real-video coverage for heuristic robustness

## Required Outputs

Create:
- one validation checklist
- one validation report

The report must include:
- raw rows
- corresponding computed output
- pass/fail judgment
- residual risks
- explicit statement on whether heuristic refinement is still required before Stage C sign-off
