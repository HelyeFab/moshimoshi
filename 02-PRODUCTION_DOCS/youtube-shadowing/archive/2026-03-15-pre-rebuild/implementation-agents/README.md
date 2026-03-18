# PracticeSegment Implementation Agent Workspace

Last updated: 2026-03-13
Owner: Technical Lead
Mode: delegated implementation

## 1. Purpose

This folder is the execution workspace for implementing the `PracticeSegment` architecture in the YouTube Shadowing feature.

The Technical Lead is responsible for:
- defining the target architecture
- assigning implementation work
- reviewing and accepting or rejecting code from other agents
- preserving architectural coherence

The Technical Lead is not the primary coder in this workflow.

## 2. Source Documents

All agents must read these first:

1. `02-PRODUCTION_DOCS/youtube-shadowing/IMPLEMENTATION_ARCHAEOLOGY.md`
2. `02-PRODUCTION_DOCS/youtube-shadowing/PRACTICE_SEGMENT_ARCHITECTURE_PROPOSAL.md`
3. `02-PRODUCTION_DOCS/youtube-shadowing/IMPLEMENTATION_ROADMAP.md`
4. `02-PRODUCTION_DOCS/youtube-shadowing/research-briefs/SESSION_CONTEXT.md`
5. `02-PRODUCTION_DOCS/youtube-shadowing/research-briefs/WAVE1_SYNTHESIS.md`
6. `02-PRODUCTION_DOCS/youtube-shadowing/research-briefs/WAVE2_SYNTHESIS.md`

## 3. Agent Layout

- `00-ORCHESTRATION.md`
- `01-AGENT-BACKEND-PRACTICE-SEGMENTS.md`
- `02-AGENT-PAGE-MIGRATION.md`
- `03-AGENT-EDIT-MODE-MVP.md`
- `04-AGENT-QA-BENCHMARKS.md`

## 4. Execution Strategy

Not all agents should work in parallel.

Recommended sequence:

- Agent 01 and Agent 04 can start in parallel
- Agent 02 starts after Agent 01 defines and lands the response/data contract
- Agent 03 starts after Agent 02 lands page consumption of final practice segments

Why:
- the backend data model defines the shape of the runtime contract
- the page migration depends on that contract
- the edit-mode MVP depends on the page already consuming `FinalPracticeSegment`

## 5. Technical Lead Review Standard

Code should be rejected if it:
- blurs source transcript segments and final practice segments again
- changes playback logic unnecessarily during early phases
- introduces content policy logic before the base segment model is stable
- adds heavy infrastructure before the text-first architecture is landed
- weakens deterministic fallback
- breaks current player UX without strong justification

Code should be accepted if it:
- moves the codebase toward explicit `ComputedPracticeSegment` and `FinalPracticeSegment`
- preserves playback safety
- keeps migration incremental
- keeps compatibility where needed
- is benchmarkable and reviewable

