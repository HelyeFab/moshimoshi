# Agent Research Report Template

## 1. Executive Summary
- Recommended option:
- Why this option wins:
- Primary risks:

## 2. Problem Framing
- Learner pain points:
- System failure modes:
- Constraints (web/mobile/perf/cost):

## 3. Source Log
Provide at least 12 sources.
For each source:
- Title
- URL
- Source type (paper/docs/repo/blog/postmortem)
- Reliability note
- Key takeaway

## 4. Option Analysis

### Option A: Deterministic-only
- Approach
- Components/libraries
- Expected quality impact
- Latency/cost impact
- Risks

### Option B: Hybrid deterministic + AI fallback
- Approach
- AI invocation policy (when, why)
- Guardrails/fallback
- Expected quality impact
- Latency/cost impact
- Risks

### Option C: AI-first with deterministic guardrails
- Approach
- Validation/safety strategy
- Expected quality impact
- Latency/cost impact
- Risks

## 5. Tradeoff Matrix
Include numeric scores (1-5) for:
- Repeatability quality
- Sync accuracy
- Reliability
- Complexity
- Cost
- Latency
- Maintainability

## 6. Metrics and Acceptance Thresholds
Define measurable targets for:
- Segment duration distribution
- Segment text length distribution
- Boundary quality proxy
- Sync error and drift
- Loop boundary precision
- User outcome proxy

## 7. Recommended Architecture
- Final recommendation
- Why rejected options lose
- Migration and rollout strategy
- Rollback plan

## 8. Implementation Plan
- Phase 1 (low risk)
- Phase 2 (quality expansion)
- Phase 3 (optimization)

## 9. Open Risks and Unknowns
- Risk
- Severity
- Validation plan

## 10. Fact vs Inference
- Facts (source-backed)
- Inferences (explicit assumptions)
