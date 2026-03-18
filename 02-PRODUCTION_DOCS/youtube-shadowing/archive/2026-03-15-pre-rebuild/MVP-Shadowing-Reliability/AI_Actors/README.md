# AI Actors for YouTube Shadowing

## Leader Entry Point (Read In This Exact Order)
1. `00-OPERATING-MODEL.md`
2. `01-TECHNICAL-LEADER.md`
3. `../10-PRODUCTION-DELIVERY-PLAN.md`
4. `../09-BENCHMARK-HARNESS.md`
5. `06-HANDOFF-TEMPLATE.md`

## What The Leader Does First
1. Define the current objective in one sentence.
2. Define acceptance gates for this cycle:
   - tests/type-check
   - benchmark pass conditions
   - mandatory UI playback checks
3. Assign only one primary problem per cycle (avoid mixed goals).

## Agent Assignment Matrix
- Pipeline logic issues:
  - assign `02-AI-AGENT-PIPELINE-ENGINEER.md`
- Playback boundary/bleed issues:
  - assign `03-AI-AGENT-PLAYER-SYNC-ENGINEER.md`
- Evidence/verification/reporting:
  - assign `04-AI-AGENT-QA-EVAL.md`
- Editable fallback UX work:
  - assign `05-AI-AGENT-UX-EDITOR-MODE.md`

## Required Execution Loop (Leader)
1. Create task brief:
   - objective
   - scope (files)
   - acceptance gates
2. Dispatch to implementation agent (pipeline or sync or UX).
3. Dispatch QA agent to run benchmark/tests and produce evidence.
4. Review results:
   - if any gate fails, reject and reassign with narrowed scope
   - if all gates pass, run manual UI verification
5. Record handoff using `06-HANDOFF-TEMPLATE.md`.

## Non-Negotiables
- No promotion without benchmark + manual UI evidence.
- No “green benchmark” claims if user-visible playback is degraded.
- No per-video hacks.

## File Index
- `00-OPERATING-MODEL.md`: coordination model
- `01-TECHNICAL-LEADER.md`: leader responsibilities/checklist
- `02-AI-AGENT-PIPELINE-ENGINEER.md`: transcript/AI pipeline changes
- `03-AI-AGENT-PLAYER-SYNC-ENGINEER.md`: playback timing and loop logic
- `04-AI-AGENT-QA-EVAL.md`: benchmark/test validation
- `05-AI-AGENT-UX-EDITOR-MODE.md`: transcript editor fallback
- `06-HANDOFF-TEMPLATE.md`: output format for each cycle
