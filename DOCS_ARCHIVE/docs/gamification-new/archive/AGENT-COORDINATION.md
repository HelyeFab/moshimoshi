# 🤝 Agent Coordination Guide

**Project**: Moshimoshi Gamification Re-Implementation
**Purpose**: Define agent roles, handoffs, communication, and collaboration patterns
**Last Updated**: 2025-10-02

---

## 🎭 Agent Roster

### Agent 1: Gamification Core
**Role**: Backend Implementation Specialist
**Responsibilities**: Event listener, state management, IndexedDB, Firebase sync
**Expertise**: TypeScript, Zustand, IndexedDB, Event-driven architecture
**Personality**: Detail-oriented, performance-focused, defensive coder

### Agent 2: Config & Rules
**Role**: Configuration Architect
**Responsibilities**: JSON configs, validation, rule definitions
**Expertise**: JSON schema, validation logic, game balance
**Personality**: Systematic, thorough, documentation-focused

### Agent 3: UI Integration
**Role**: Frontend Integration Specialist
**Responsibilities**: React hooks, component updates, user experience
**Expertise**: React, hooks, UI/UX, state consumption
**Personality**: User-focused, pragmatic, integration-minded

### Agent 4: QA & Observability
**Role**: Quality Assurance Engineer
**Responsibilities**: Testing, telemetry, metrics, monitoring
**Expertise**: Unit tests, integration tests, E2E tests, observability
**Personality**: Skeptical, thorough, automation-focused

### Agent 5: Supervisor
**Role**: Technical Lead & Architect
**Responsibilities**: Architecture, coordination, final approval, gate-keeping
**Expertise**: System design, code review, documentation, decision-making
**Personality**: Strategic, collaborative, quality-obsessed

---

## 🔄 Workflow & Handoffs

### Phase 0 → Phase 1 Handoff (Supervisor → Config)

**Supervisor (Agent 5) delivers:**
- [x] QA-MATRIX.md
- [x] ARCHITECTURE-OVERVIEW.md
- [x] IMPLEMENTATION-ROADMAP.md
- [x] LAUNCH-CHECKLIST.md
- [x] AGENT-COORDINATION.md (this document)

**Config (Agent 2) receives:**
- Complete architecture documentation
- Config specifications
- Achievement definitions
- XP calculation rules

**Handoff Meeting**:
```
Supervisor: "All documentation complete. Config specs are in IMPLEMENTATION-ROADMAP.md
             Phase 1. Review the 10 achievement definitions and XP bonus tiers.
             Any questions before you start?"

Config:     "Clarification needed: Should streak freeze be configurable per user or
             global setting?"

Supervisor: "Global setting in streak.json, but check premium tier at runtime.
             Document both in config."

Config:     "Understood. Starting implementation now."
```

**Handoff Checklist**:
- [ ] Config has read all supervisor documentation
- [ ] Config understands JSON schema requirements
- [ ] Config has access to `/config/gamification/` directory
- [ ] Config knows where to ask questions (Supervisor)

---

### Phase 1 → Phase 2 Handoff (Config → Core)

**Config (Agent 2) delivers:**
- [ ] `/config/gamification/xp.json`
- [ ] `/config/gamification/streak.json`
- [ ] `/config/gamification/achievements.json`
- [ ] `/config/gamification/levels.json`
- [ ] Config test suite (passing)

**Core (Agent 1) receives:**
- All config files
- Config loading examples
- Validation functions

**Handoff Meeting**:
```
Config:     "All 4 configs complete and validated. Tests passing. XP formula uses
             baseXP * multiplier approach, not additive bonuses. Achievement
             conditions use simple operator syntax (>=, >, etc.)."

Core:       "Got it. I'll import configs and use the operator syntax for condition
             evaluation. Will I need to track session count in state?"

Config:     "Yes, for achievement 'first_session' and 'centurion'. Add sessionCount
             to state schema."

Core:       "Will do. Starting core implementation now."

Supervisor: [Reviewing] "Config sign-off approved. Core, you're unblocked."
```

**Handoff Checklist**:
- [ ] All 4 config files exist and parse successfully
- [ ] Config tests pass (100%)
- [ ] Supervisor has reviewed and approved configs
- [ ] Core has read configs and understands structure
- [ ] Core knows achievement condition syntax

---

### Phase 2 → Phase 3 Handoff (Core → UI)

**Core (Agent 1) delivers:**
- [ ] `src/lib/gamification/gamificationListener.ts`
- [ ] `src/state/userGamification.ts`
- [ ] `src/lib/gamification/indexedDBStore.ts`
- [ ] Core test suite (passing)

**UI (Agent 3) receives:**
- Zustand store interface
- State shape documentation
- Hook usage examples

**Handoff Meeting**:
```
Core:       "Core implementation complete. State is in useGamificationStore,
             all actions exported. Feature flag checked in listener and state.
             IndexedDB auto-saves on every state change."

UI:         "Perfect. Do I need to manually trigger IndexedDB load, or is it automatic?"

Core:       "You need to call loadFromIndexedDB() once on app mount. Add it to
             your hook's useEffect."

UI:         "Got it. And if feature flag is OFF, state returns defaults?"

Core:       "Correct. All zeros. Check isEnabled flag from the hook."

UI:         "Starting UI integration now."

Supervisor: [Reviewing] "Core sign-off approved. UI, you're unblocked."
```

**Handoff Checklist**:
- [ ] All core files exist and compile
- [ ] Core tests pass (100%)
- [ ] Supervisor has reviewed and approved core
- [ ] UI has read state interface
- [ ] UI understands hook usage pattern

---

### Phase 3 → Phase 4 Handoff (UI → QA)

**UI (Agent 3) delivers:**
- [ ] `src/hooks/useGamification.ts`
- [ ] Updated Profile page (`src/app/account/page.tsx`)
- [ ] Updated Achievements page (`src/app/achievements/page.tsx`)
- [ ] Updated Leaderboard page (`src/app/leaderboard/page.tsx`)
- [ ] Component test suite (passing)

**QA (Agent 4) receives:**
- Full system (Config + Core + UI)
- All component tests
- Integration test targets

**Handoff Meeting**:
```
UI:         "UI integration complete. Profile and Achievements pages show real data.
             Leaderboard still uses mock data as specified. Feature flag tested
             manually - works in both ON and OFF states."

QA:         "Excellent. I'll start with integration tests (URE → Listener → State → UI).
             Should I test Firebase sync?"

UI:         "Yes, but you'll need a premium test user. Mock the premium tier check
             if needed."

QA:         "Will do. Starting QA now."

Supervisor: [Reviewing] "UI sign-off approved. QA, you're unblocked."
```

**Handoff Checklist**:
- [ ] All UI files exist and compile
- [ ] Component tests pass (100%)
- [ ] Manual smoke testing complete
- [ ] Supervisor has reviewed and approved UI
- [ ] QA has test environment set up

---

### Phase 4 → Phase 5 Handoff (QA → Supervisor)

**QA (Agent 4) delivers:**
- [ ] `src/lib/telemetry/gamificationMetrics.ts`
- [ ] `tests/unit/gamification.test.ts` (passing)
- [ ] `tests/integration/gamification.test.ts` (passing)
- [ ] `tests/e2e/gamification.spec.ts` (passing)
- [ ] Code coverage report (≥80%)

**Supervisor (Agent 5) receives:**
- Full test results
- Coverage report
- Performance benchmarks
- Bug reports (if any)

**Handoff Meeting**:
```
QA:         "All tests complete and passing. Coverage at 85%. Performance benchmarks
             all met. Found 2 minor bugs (logged as issues), both fixed. No blockers."

Supervisor: "Excellent work. I'll do final architecture audit and review all
             deliverables against QA Matrix."

QA:         "One note: E2E tests take 4 minutes to run. Within target but close."

Supervisor: "Acceptable. I'll review and provide final approval."
```

**Handoff Checklist**:
- [ ] All tests pass
- [ ] Code coverage ≥80%
- [ ] All bugs resolved or documented
- [ ] Performance benchmarks met
- [ ] QA sign-off complete

---

## 🗣️ Communication Protocols

### Daily Stand-up (Async)
**Time**: Every morning (or whenever agents start work)
**Format**: Update in QA-MATRIX.md "Daily Stand-up Report" section

**Template**:
```
### [Date]
- **Agent [N]**: [Status update]
  - Completed: [Tasks]
  - In Progress: [Tasks]
  - Blocked: [Blockers]
  - Next: [Next tasks]
- **Blockers**: [Any blockers across agents]
- **Next Steps**: [System-wide next steps]
```

---

### Code Review Requests
**Process**:
1. Agent completes deliverable
2. Agent runs tests (must pass)
3. Agent tags Supervisor in commit/PR
4. Supervisor reviews within 24 hours
5. Supervisor approves or requests changes

**Review Checklist**:
- [ ] Code follows TypeScript best practices
- [ ] Tests cover all critical paths
- [ ] No console.log statements (use logger)
- [ ] Feature flag enforced where required
- [ ] Documentation updated
- [ ] No URE modifications (Agent 1 only)

---

### Blocker Resolution
**Process**:
1. Agent encounters blocker
2. Agent documents in QA-MATRIX "Blockers & Issues" section
3. Agent notifies Supervisor immediately
4. Supervisor facilitates resolution within 4 hours
5. Agent updates blocker status when resolved

**Example**:
```
Blocker: Agent 3 cannot test Firebase sync without premium test user

Resolution:
1. Supervisor creates test user with premium tier
2. Supervisor provides credentials to Agent 3
3. Agent 3 proceeds with testing
4. Blocker resolved in 2 hours
```

---

### Inter-Agent Questions
**Protocol**:
- **Direct Questions**: Use comment in relevant file
- **Architecture Questions**: Ask Supervisor
- **Config Questions**: Ask Agent 2
- **Implementation Questions**: Ask Agent 1
- **Testing Questions**: Ask Agent 4

**Response Time**: <4 hours during work hours

---

## 🎯 Collaboration Patterns

### Pattern 1: Config-Driven Development (Agent 2 → Agent 1)

**Scenario**: Agent 1 needs to implement XP bonus calculation

**Collaboration**:
```typescript
// Agent 2 creates config
// /config/gamification/xp.json
{
  "bonuses": {
    "accuracy": [
      { "threshold": 100, "multiplier": 1.5 },
      { "threshold": 90, "multiplier": 1.3 }
    ]
  }
}

// Agent 1 imports and uses config
import xpConfig from '@/config/gamification/xp.json'

function calculateAccuracyBonus(accuracy: number, baseXP: number): number {
  for (const tier of xpConfig.bonuses.accuracy) {
    if (accuracy >= tier.threshold) {
      return Math.round(baseXP * (tier.multiplier - 1))
    }
  }
  return 0
}
```

**Key Points**:
- Agent 2 defines data structure
- Agent 1 consumes and implements logic
- No hardcoded values in Agent 1's code

---

### Pattern 2: State-Driven UI (Agent 1 → Agent 3)

**Scenario**: Agent 3 needs to display XP in Profile page

**Collaboration**:
```typescript
// Agent 1 defines state interface
// src/state/userGamification.ts
export interface GamificationState {
  totalXP: number
  currentLevel: number
  // ...
}

// Agent 1 exports hook
export const useGamificationStore = create<GamificationState>(...)

// Agent 3 creates wrapper hook
// src/hooks/useGamification.ts
export function useGamification() {
  const store = useGamificationStore()
  // ... feature flag logic
  return {
    totalXP: store.totalXP,
    currentLevel: store.currentLevel,
    // ...
  }
}

// Agent 3 uses in component
// src/app/account/page.tsx
const { totalXP, currentLevel } = useGamification()
```

**Key Points**:
- Agent 1 defines state structure
- Agent 3 wraps with hook for convenience
- Agent 3 handles UI-specific logic (loading, errors)

---

### Pattern 3: Test-Driven Validation (Agent 4 → All)

**Scenario**: Agent 4 finds bug during testing

**Collaboration**:
```
Agent 4: "Integration test failing: XP awarded is 0 when accuracy is 100%"
         [Creates issue in QA-MATRIX]

Agent 1: [Investigates] "Found bug in calculateAccuracyBonus().
         Multiplier calculation incorrect."

Agent 1: [Fixes bug]
         [Commits fix]
         [Notifies Agent 4]

Agent 4: [Re-runs tests]
         "Confirmed fixed. Closing issue."
```

**Key Points**:
- Agent 4 discovers issues through testing
- Agent 4 creates detailed bug reports
- Responsible agent fixes and notifies
- Agent 4 verifies fix

---

## 🚧 Conflict Resolution

### Scenario 1: Design Disagreement

**Example**: Agent 1 and Agent 3 disagree on hook API

**Resolution Process**:
1. Both agents present their case to Supervisor
2. Supervisor reviews technical merits
3. Supervisor makes final decision
4. Decision documented in architecture docs
5. Both agents implement agreed solution

**Supervisor Decision Criteria**:
- Follows established patterns in codebase
- Minimizes complexity
- Maintains feature flag compatibility
- Aligns with user experience goals

---

### Scenario 2: Blocker Escalation

**Example**: Agent 1 blocked on URE event format ambiguity

**Resolution Process**:
1. Agent 1 documents ambiguity
2. Supervisor reviews URE event interface
3. Supervisor clarifies event format
4. Supervisor updates ARCHITECTURE-OVERVIEW.md
5. Agent 1 proceeds with clarification

---

### Scenario 3: Timeline Pressure

**Example**: Agent 3 behind schedule, risking overall timeline

**Resolution Process**:
1. Agent 3 notifies Supervisor of delay
2. Supervisor assesses impact
3. Supervisor options:
   - Reduce scope (cut non-critical features)
   - Extend timeline (adjust other agents)
   - Provide assistance (pair programming)
4. Supervisor updates IMPLEMENTATION-ROADMAP.md
5. All agents notified of changes

---

## 📋 Deliverable Acceptance Criteria

### Agent 2 (Config)
**Accepted when**:
- [ ] All 4 config files parse successfully
- [ ] JSON schemas validate
- [ ] Config tests pass
- [ ] No hardcoded values found in code
- [ ] Supervisor code review approved

---

### Agent 1 (Core)
**Accepted when**:
- [ ] All 3 core files exist and compile
- [ ] Feature flag enforced everywhere
- [ ] No URE modifications detected
- [ ] Unit tests pass (≥90% coverage)
- [ ] Performance benchmarks met
- [ ] Supervisor code review approved

---

### Agent 3 (UI)
**Accepted when**:
- [ ] Hook and components exist and compile
- [ ] Mock data imports removed
- [ ] Feature flag OFF shows defaults
- [ ] Component tests pass
- [ ] Manual smoke testing complete
- [ ] Supervisor code review approved

---

### Agent 4 (QA)
**Accepted when**:
- [ ] All test suites pass
- [ ] Code coverage ≥80%
- [ ] Integration tests cover critical flows
- [ ] E2E tests cover user scenarios
- [ ] Telemetry system functional
- [ ] Supervisor final review approved

---

## 🎓 Best Practices

### For All Agents

1. **Feature Flag First**
   - Always check `ENABLE_GAMIFICATION` before executing logic
   - Return safe defaults when disabled
   - Test both enabled and disabled states

2. **Zero URE Modifications**
   - Never modify files in `/src/lib/review-engine/`
   - Only listen to URE events
   - No tight coupling with URE internals

3. **Config-Driven Everything**
   - No hardcoded XP values
   - No hardcoded achievement definitions
   - All rules in JSON configs

4. **Test Coverage**
   - Write tests for all new code
   - Aim for ≥80% coverage
   - Test edge cases (flag OFF, missing data, etc.)

5. **Documentation**
   - Update docs when making changes
   - Document assumptions
   - Add code comments for complex logic

---

### For Agent 1 (Core)

1. **Event-Driven Design**
   - Subscribe to URE events only
   - Emit gamification events
   - No polling or timers

2. **State Management**
   - Immutable state updates
   - Pure functions for calculations
   - No side effects in state

3. **Offline-First**
   - IndexedDB as primary storage
   - Firebase sync as enhancement
   - Handle network failures gracefully

---

### For Agent 3 (UI)

1. **Progressive Enhancement**
   - App works without gamification
   - Graceful degradation when flag OFF
   - No broken UI states

2. **Loading States**
   - Show loading indicators
   - Handle async data loading
   - Display errors gracefully

3. **Accessibility**
   - ARIA labels for gamification elements
   - Keyboard navigation support
   - Screen reader friendly

---

### For Agent 4 (QA)

1. **Test Pyramid**
   - Many unit tests (fast, isolated)
   - Fewer integration tests (medium speed)
   - Few E2E tests (slow, comprehensive)

2. **Test Isolation**
   - Each test independent
   - Clean state before each test
   - No test order dependencies

3. **Performance Testing**
   - Benchmark critical paths
   - Test with realistic data volumes
   - Monitor memory and CPU usage

---

## 🏆 Success Criteria

### Team Success
- All 22 deliverables completed
- QA Matrix 100% complete
- Launch Checklist approved
- Zero critical bugs at launch
- Feature flag works in production

### Individual Success
- **Agent 1**: Core system performant and bug-free
- **Agent 2**: Configs clear and maintainable
- **Agent 3**: UI intuitive and error-free
- **Agent 4**: Tests comprehensive and passing
- **Agent 5**: System architecture sound and documented

---

## 📞 Contact & Escalation

### Normal Questions
- Ask in agent-specific channel
- Response time: <4 hours
- Document Q&A in relevant docs

### Urgent Blockers
- Notify Supervisor immediately
- Response time: <1 hour
- Update QA-MATRIX blocker section

### Critical Issues (Production)
- Follow Launch Checklist rollback plan
- Disable feature flag
- Notify all agents
- Emergency meeting within 30 minutes

---

## 🎉 Celebration Plan

### Milestones
1. **Config Complete**: Virtual high-five 🙌
2. **Core Complete**: Coffee break ☕
3. **UI Complete**: Dance GIF 💃
4. **QA Complete**: Champagne emoji 🥂
5. **Launch Approved**: Team celebration 🎊

### Launch Day
- Monitor together for first hour
- Celebrate successful rollout
- Document lessons learned
- Plan next iteration

---

**Document Status**: ✅ COMPLETE
**Last Updated**: 2025-10-02
**Next Review**: When first blocker occurs
**Maintained By**: Agent 5 (Supervisor)

---

## 🤝 Agent Agreement

By participating in this project, all agents agree to:
- Follow this coordination guide
- Communicate proactively
- Meet deadlines or notify early
- Review each other's work constructively
- Escalate blockers immediately
- Maintain code quality standards
- Support each other's success

**Signed**:
- [ ] Agent 1 (Gamification Core)
- [ ] Agent 2 (Config & Rules)
- [ ] Agent 3 (UI Integration)
- [ ] Agent 4 (QA & Observability)
- [x] Agent 5 (Supervisor)
