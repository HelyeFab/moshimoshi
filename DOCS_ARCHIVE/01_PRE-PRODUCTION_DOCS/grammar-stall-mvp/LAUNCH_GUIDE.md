# Grammar Stall MVP - Agent Launch Guide

**How to launch the 4 agents for this project**

---

## 📋 Quick Start

Each agent has a **STANDALONE** prompt that contains everything they need. Just read one file per agent.

---

## 🚀 Launch Commands

### Option A: Launch All Agents in Parallel (RECOMMENDED)

Use this command to launch all 3 coding agents simultaneously:

```
Launch agents in parallel:
- Agent 1: Read /01_PRODUCTION_DOCS/grammar-stall-mvp/AGENT_PROMPTS/AGENT_1_STANDALONE.md and create all 80 N5 grammar point JSON files
- Agent 2: Read /01_PRODUCTION_DOCS/grammar-stall-mvp/AGENT_PROMPTS/AGENT_2_STANDALONE.md and build all React components for grammar display
- Agent 3: Read /01_PRODUCTION_DOCS/grammar-stall-mvp/AGENT_PROMPTS/AGENT_3_STANDALONE.md and build exercise validation and components
```

---

### Option B: Launch Sequentially (Week 1 → Week 2)

**Week 1 (Days 1-5):**

**Day 1-2: Launch Agent 1 (Data)**
```
Read /01_PRODUCTION_DOCS/grammar-stall-mvp/AGENT_PROMPTS/AGENT_1_STANDALONE.md
Task: Create 10 grammar points with exercises (Days 1-2 deliverable)
```

**Day 3-5: Launch Agent 2 (UI)**
```
Read /01_PRODUCTION_DOCS/grammar-stall-mvp/AGENT_PROMPTS/AGENT_2_STANDALONE.md
Task: Build all React components for grammar display
Dependency: Needs Agent 1's 10 grammar points to be complete first
```

**Week 2 (Days 6-10):**

**Day 6-8: Launch Agent 3 (Logic)**
```
Read /01_PRODUCTION_DOCS/grammar-stall-mvp/AGENT_PROMPTS/AGENT_3_STANDALONE.md
Task: Build exercise engine and interactive components
Dependency: Needs Agent 2's UI components to be complete
```

**Day 9-10: Re-launch Agent 1 (Content Completion)**
```
Resume Agent 1 with same prompt
Task: Create remaining 70 grammar points with exercises
```

---

### Optional: Launch Technical Lead

**For coordination and code review:**
```
Read /01_PRODUCTION_DOCS/grammar-stall-mvp/AGENT_PROMPTS/TECHNICAL_LEAD.md
Task: Coordinate the 3 agents, review code, integrate components
```

---

## 📁 File Reference

| Agent | Standalone Prompt | What They Build |
|-------|------------------|-----------------|
| **Agent 1 - Data** | `AGENT_1_STANDALONE.md` | 80 grammar JSON files + exercises |
| **Agent 2 - UI** | `AGENT_2_STANDALONE.md` | React components + pages |
| **Agent 3 - Logic** | `AGENT_3_STANDALONE.md` | Exercise engine + validation |
| **Technical Lead** | `TECHNICAL_LEAD.md` | Coordination + integration |

---

## ✅ What Each Agent Needs

### Agent 1 (Data)
- **Just needs**: `AGENT_1_STANDALONE.md`
- **Outputs**:
  - `/public/data/grammar/n5-index.json`
  - `/public/data/grammar/points/*.json` (80 files)
  - `/public/data/grammar/exercises/*.json` (80 files)
  - `/src/lib/grammar/types.ts`

### Agent 2 (UI)
- **Just needs**: `AGENT_2_STANDALONE.md`
- **Depends on**: Agent 1's JSON files
- **Outputs**:
  - `/src/components/grammar/*.tsx` (6 components)
  - `/src/app/[locale]/learn/grammar/page.tsx`
  - `/src/app/[locale]/learn/grammar/[pointId]/page.tsx`
  - `/src/lib/grammar/grammarService.ts`

### Agent 3 (Logic)
- **Just needs**: `AGENT_3_STANDALONE.md`
- **Depends on**: Agent 1's exercise files + Agent 2's components
- **Outputs**:
  - `/src/lib/grammar/exerciseValidator.ts`
  - `/src/lib/grammar/exerciseEngine.ts`
  - `/src/components/grammar/ExerciseContainer.tsx`
  - `/src/components/grammar/exercises/*.tsx` (3 components)
  - `/src/app/[locale]/learn/grammar/[pointId]/practice/page.tsx`

---

## 🎯 Success Criteria

**Agent 1 succeeds when:**
- [ ] 80 grammar point JSON files created
- [ ] 80 exercise JSON files created (800 exercises)
- [ ] All JSON validates with `jq`
- [ ] TypeScript types created

**Agent 2 succeeds when:**
- [ ] Grammar grid displays all points
- [ ] Grammar detail page works
- [ ] Mobile responsive
- [ ] No TypeScript/console errors

**Agent 3 succeeds when:**
- [ ] All 3 exercise types work
- [ ] Answer validation handles variations
- [ ] Exercise flow is smooth (10 questions → results)
- [ ] No TypeScript/console errors

**Overall MVP succeeds when:**
- [ ] User can browse 80 grammar points
- [ ] User can read explanations and examples
- [ ] User can practice with interactive exercises
- [ ] Works on mobile and desktop
- [ ] No critical bugs

---

## 📞 Help

**If agents are confused:**
- Point them back to their STANDALONE prompt
- Everything they need is in that one file
- No other documentation required

**If agents need coordination:**
- Use the Technical Lead agent
- Or manually integrate their work

---

## 🚢 Deployment Checklist

After all agents complete:

```bash
# Verify file structure
ls public/data/grammar/points/*.json | wc -l  # Should be 80
ls public/data/grammar/exercises/*.json | wc -l  # Should be 80

# Type check
npm run type-check

# Build
npm run build

# Test
npm run dev
# Visit: http://localhost:3000/en/learn/grammar

# Commit & Push
git add .
git commit -m "feat: complete Grammar Stall MVP"
git push origin grammar-stall-mvp
```

---

**Document Version**: 1.0.0
**Last Updated**: 2026-01-16
