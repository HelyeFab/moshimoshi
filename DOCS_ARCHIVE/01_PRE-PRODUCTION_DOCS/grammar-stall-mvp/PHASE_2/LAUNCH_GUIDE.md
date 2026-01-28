# Grammar Stall Phase 2 - Agent Launch Guide

**How to launch the 4 agents for Phase 2 (URE + XP + Persistence)**

---

## Quick Start

Each agent has a STANDALONE prompt that contains everything they need.
Read one file per agent.

---

## New Docs (Read After Launch Guide)

- `01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/README.md`
- `01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/JLPT_LEVELS_GUIDE.md`
- `01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/LEAD_HANDOFF.md`
- `01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/LEAD_PROMPTING_GUIDE.md`
- `01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/RELEASE_CHECKLIST.md`

---

## Launch Commands

### Option A: Launch All Agents in Parallel (RECOMMENDED)

```
Launch agents in parallel:
- Agent 1: Read /01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/AGENT_PROMPTS/AGENT_1_STANDALONE.md and extend grammar data for multi-level support
- Agent 2: Read /01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/AGENT_PROMPTS/AGENT_2_STANDALONE.md and integrate Grammar into URE UI + admin dashboard shell
- Agent 3: Read /01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/AGENT_PROMPTS/AGENT_3_STANDALONE.md and implement URE adapters + XP/streak integration
```

---

### Option B: Launch Sequentially

**Week 1**
- Agent 3 first (URE integration + XP wiring)
- Agent 2 next (UI wiring to URE sessions, admin dashboard shell)
- Agent 1 last (data expansion + schema multi-level)

---

### Optional: Launch Technical Lead

```
Read /01_PRODUCTION_DOCS/grammar-stall-mvp/PHASE_2/AGENT_PROMPTS/TECHNICAL_LEAD.md
Task: Coordinate agents, review code, and approve integration
```

---

## File Reference

| Agent | Standalone Prompt | What They Build |
|-------|-------------------|-----------------|
| Agent 1 - Data | `AGENT_1_STANDALONE.md` | Multi-level data structure + schema updates |
| Agent 2 - UI | `AGENT_2_STANDALONE.md` | URE-based practice UI + admin dashboard shell |
| Agent 3 - Logic | `AGENT_3_STANDALONE.md` | URE adapter + session wiring + XP/streak hooks |
| Technical Lead | `TECHNICAL_LEAD.md` | Coordination + review + integration |

---

## Success Criteria (Phase 2)

- Grammar practice runs through URE sessions only (no separate XP path).
- XP awards are counted toward streaks (same as flashcards/news).
- Progress persists locally and in Firebase for free and premium users.
- Architecture ready for additional levels (N4+), even if content is not yet complete.
- Admin dashboard page exists for grammar content management (auth pattern matches other admin pages).
- Accessibility baseline met (keyboard nav, labels).

---

**Document Version**: 1.0.0
**Last Updated**: 2026-01-17
