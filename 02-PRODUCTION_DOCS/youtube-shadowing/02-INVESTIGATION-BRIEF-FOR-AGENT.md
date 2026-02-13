# Investigation Brief: Segmentation and Sync Accuracy

## Objective
Produce a decision-ready recommendation for improving YouTube Shadowing segmentation and synchronization in production.

## Mandatory Research Questions
1. Segmentation quality:
- What state-of-the-art approaches produce short, repeatable speech units from noisy ASR/caption transcripts?
- Which approaches preserve timing alignment while splitting large caption blocks?
- How do top language-learning and captioning tools define repeat-friendly unit boundaries?

2. Sync accuracy:
- What robust methods keep text highlighting aligned to media playback despite callback jitter and seek latency?
- What drift-correction strategies are proven in browser-based players?

3. AI post-processing option:
- Can AI-assisted resegmentation materially outperform deterministic heuristics?
- What architecture minimizes latency/cost and prevents unstable output?
- What guardrails are required (schema validation, confidence thresholds, deterministic fallback)?

4. Library and implementation options:
- Evaluate best candidate libraries for sentence boundary detection, alignment smoothing, and transcript normalization.
- Include maintenance health, bundle impact, browser compatibility, and TypeScript support.

## Required Deliverables
1. Competitive and technical scan with direct source links.
2. 3 implementation options:
- Option A: deterministic-only improvements.
- Option B: hybrid deterministic + AI fallback.
- Option C: AI-first with deterministic safety rails.
3. Tradeoff matrix: quality, complexity, cost, latency, reliability.
4. Recommended option with rollout plan.
5. Risks and mitigation plan.

## Evidence Standard
- Prefer primary docs, papers, maintainer repos, production postmortems.
- No recommendation without measurable claim and source.
- Explicitly separate facts vs assumptions.

## Output Format
Use `03-AGENT-RESEARCH-REPORT-TEMPLATE.md` exactly.
