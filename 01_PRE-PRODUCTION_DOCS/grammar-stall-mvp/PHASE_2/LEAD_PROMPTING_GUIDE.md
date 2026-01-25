# Lead Supervisor - Agent Prompting Guide

This guide explains how to generate agent prompts for Grammar Stall work.
Use it when you need to spin up new agents or re-scope existing ones.

---

## Prompting Principles

1. **Single responsibility** per agent.
2. **File-level targets** (exact paths).
3. **Acceptance criteria** listed in bullet points.
4. **Constraints** (what not to change).
5. **Deliverables** (what to report back).

---

## Prompt Template (Copy/Paste)

```
You are Agent {X}. Focus: {AREA}.

Goal:
- {One-line outcome}

Tasks:
1) {Task 1}
2) {Task 2}
3) {Task 3}

Files to touch:
- {path}
- {path}

Constraints:
- {Must not change}
- {Must follow}

Deliverables:
- Summary of changes
- Files touched
- Notes / risks
```

---

## Example Prompts (Phase 2)

### Agent 1 (Data)
```
You are Agent 1. Focus: Grammar data and multi-level readiness.
Goal: Add N4 content without breaking N5.
Tasks:
1) Create N4 points + exercises (schema-complete).
2) Update n4-index.json and points-index.json.
3) Run lite generator for N4.
Files:
- public/data/grammar/points/n4/
- public/data/grammar/exercises/n4/
- public/data/grammar/n4-index.json
- public/data/grammar/points-index.json
Constraints:
- Must keep schema identical to N5.
- Must not break existing N5 flows.
Deliverables:
- File list + validation output.
```

### Agent 2 (UI)
```
You are Agent 2. Focus: Grammar UI + Level selection.
Goal: Add a level switcher and update SEO metadata.
Tasks:
1) Add level selector to GrammarPageClient.
2) Update page metadata for selected level.
3) Confirm list + detail pages use correct level.
Files:
- src/components/grammar/GrammarPageClient.tsx
- src/app/[locale]/learn/grammar/page.tsx
Constraints:
- Preserve current UX unless required.
Deliverables:
- Files changed + before/after behavior.
```

### Agent 3 (Logic)
```
You are Agent 3. Focus: URE integration + performance.
Goal: Reduce practice page LCP.
Tasks:
1) Defer ReviewSessionUI until user action or idle.
2) Keep XP/streak flow unchanged.
Files:
- src/app/[locale]/learn/grammar/[pointId]/practice/page.tsx
Constraints:
- No new XP paths outside URE.
Deliverables:
- Diff summary + perf rationale.
```

---

## Supervisory Checks

When reviewing agent work:
- Ensure no change bypasses URE.
- Ensure multi-level fallback still exists.
- Ensure new files are added to indexes and maps.
- Require a **full clean build** for prod verification.

---

**Last Updated**: 2026-01-17
