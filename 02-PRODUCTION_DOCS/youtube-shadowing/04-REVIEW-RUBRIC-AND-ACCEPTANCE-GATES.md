# Review Rubric and Acceptance Gates

## Purpose
Provide objective criteria to accept or reject agent research and future implementation proposals.

## Scoring Rubric (0-5 each)
1. Problem understanding
2. Source quality and traceability
3. Segmentation strategy depth
4. Sync strategy depth
5. Production realism (latency/cost/reliability)
6. Integration fit with existing architecture
7. Testability and observability design

Minimum pass: average >= 4.0 and no category < 3.5.

## Required Metrics (Determined)
These are the default targets unless revised with evidence.

### Segmentation quality targets
- Median segment duration: 2.5s to 6.0s
- P90 segment duration: <= 8.0s
- P95 segment duration: <= 10.0s
- Segment text length: target 30 to 110 characters (language-dependent tuning allowed)
- Oversized repeat units (>12s): < 1% of segments

### Sync accuracy targets
- Active segment highlight error (median absolute): <= 120ms desktop, <= 180ms mobile
- P95 highlight error: <= 250ms desktop, <= 350ms mobile
- Repeat loop boundary overshoot: <= 120ms median, <= 220ms P95
- Hard drift incidents (>500ms for >1.5s): < 0.5% of playback minutes

### Stability targets
- No increase in player stalls/rebuffer incidents attributable to feature changes
- No regression in transcript load success rate
- No new entitlement or tracking regressions

## Hard Acceptance Gates
Reject proposal if any apply:
1. No measurable thresholds.
2. No deterministic fallback for AI components.
3. Breaking existing API contracts without migration plan.
4. Missing rollback strategy.
5. Missing test strategy for segmentation + sync.

## Evidence Requirements for Approval
- At least 12 high-quality references.
- At least 1 benchmark or reproducible test approach.
- At least 1 phased rollout plan with guardrails and kill switch.
