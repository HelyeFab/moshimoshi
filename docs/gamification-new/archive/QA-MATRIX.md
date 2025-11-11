# 📋 Gamification QA Matrix

**Project**: Moshimoshi Gamification Re-Implementation
**Supervisor**: Agent 5
**Last Updated**: 2025-10-02
**Status**: 🔴 NOT STARTED

---

## Overview

This matrix tracks all deliverables across the 5-agent architecture. Each deliverable must be ✅ verified by Agent 5 (Supervisor) before the system can launch.

---

## 🎯 Agent 1: Gamification Core

### Deliverable 1.1: Event Listener
**File**: `src/lib/gamification/gamificationListener.ts`

| Requirement | Status | Notes |
|------------|--------|-------|
| Subscribes to URE `SESSION_COMPLETED` event | ⬜ | |
| Subscribes to URE `ITEM_ANSWERED` event | ⬜ | |
| Calculates XP from session statistics | ⬜ | |
| Applies config-driven XP rules | ⬜ | |
| Increments streak when ≥10 XP/day | ⬜ | |
| Resets streak on missed day | ⬜ | |
| Emits gamification events (XP_AWARDED, ACHIEVEMENT_UNLOCKED) | ⬜ | |
| Feature flag check: ENABLE_GAMIFICATION | ⬜ | |
| Zero URE modifications | ⬜ | |
| TypeScript type safety | ⬜ | |
| Error handling for failed operations | ⬜ | |

**Overall Status**: ⬜ NOT STARTED
**Blocker**: None
**Supervisor Notes**:

---

### Deliverable 1.2: Gamification State (Zustand Store)
**File**: `src/state/userGamification.ts`

| Requirement | Status | Notes |
|------------|--------|-------|
| State: totalXP (number) | ⬜ | |
| State: currentLevel (number) | ⬜ | |
| State: currentStreak (number) | ⬜ | |
| State: bestStreak (number) | ⬜ | |
| State: lastActivityDate (Date) | ⬜ | |
| State: unlockedAchievements (string[]) | ⬜ | |
| Action: awardXP(amount) | ⬜ | |
| Action: incrementStreak() | ⬜ | |
| Action: resetStreak() | ⬜ | |
| Action: unlockAchievement(id) | ⬜ | |
| Action: syncToFirebase() | ⬜ | Premium only |
| Action: loadFromIndexedDB() | ⬜ | |
| Action: saveToIndexedDB() | ⬜ | |
| Middleware: Auto-save to IndexedDB on state change | ⬜ | |
| Middleware: Feature flag check | ⬜ | |

**Overall Status**: ⬜ NOT STARTED
**Blocker**: None
**Supervisor Notes**:

---

### Deliverable 1.3: IndexedDB Wrapper
**File**: `src/lib/gamification/indexedDBStore.ts`

| Requirement | Status | Notes |
|------------|--------|-------|
| DB name: "moshimoshi_gamification" | ⬜ | |
| Object store: "userGamification" | ⬜ | |
| Key: userId | ⬜ | |
| saveGamificationData() method | ⬜ | |
| loadGamificationData() method | ⬜ | |
| clearGamificationData() method | ⬜ | |
| Error handling for quota exceeded | ⬜ | |
| Migration from v1 to v2 (if needed) | ⬜ | |

**Overall Status**: ⬜ NOT STARTED
**Blocker**: None
**Supervisor Notes**:

---

### Deliverable 1.4: Unit Tests
**File**: `src/lib/gamification/__tests__/gamificationListener.test.ts`

| Test Case | Status | Notes |
|-----------|--------|-------|
| Correct review → +XP (base amount) | ⬜ | |
| Accuracy bonus applied (≥90%) | ⬜ | |
| Speed bonus applied (<3s avg) | ⬜ | |
| Streak bonus applied (≥10 correct streak) | ⬜ | |
| Day with ≥10 XP → streak increments | ⬜ | |
| Day with <10 XP → streak unchanged | ⬜ | |
| Missed day → streak resets to 0 | ⬜ | |
| Feature flag OFF → no XP/streak updates | ⬜ | |
| Level calculation: floor(totalXP / 1000) | ⬜ | |
| Achievement unlock on condition met | ⬜ | |
| Error handling: invalid session data | ⬜ | |
| Error handling: negative XP | ⬜ | |

**Overall Status**: ⬜ NOT STARTED
**Blocker**: None
**Supervisor Notes**:

---

## ⚙️ Agent 2: Config & Rules

### Deliverable 2.1: XP Configuration
**File**: `/config/gamification/xp.json`

| Requirement | Status | Notes |
|------------|--------|-------|
| baseXP: number (per correct answer) | ⬜ | Default: 10 |
| accuracyBonus: { threshold: number, multiplier: number }[] | ⬜ | |
| speedBonus: { thresholdMs: number, bonus: number } | ⬜ | |
| streakBonus: { minStreak: number, bonusPerItem: number } | ⬜ | |
| dailyXPCap: number | ⬜ | Default: 500 |
| antiCheat: { enabled: boolean, maxPerSession: number } | ⬜ | |
| JSON schema validation | ⬜ | |

**Overall Status**: ⬜ NOT STARTED
**Blocker**: None
**Supervisor Notes**:

---

### Deliverable 2.2: Streak Configuration
**File**: `/config/gamification/streak.json`

| Requirement | Status | Notes |
|------------|--------|-------|
| minXPForStreak: number | ⬜ | Default: 10 |
| gracePeriodHours: number | ⬜ | Default: 24 |
| streakFreezeEnabled: boolean | ⬜ | Premium feature |
| maxStreakFreezes: number | ⬜ | Premium limit |
| JSON schema validation | ⬜ | |

**Overall Status**: ⬜ NOT STARTED
**Blocker**: None
**Supervisor Notes**:

---

### Deliverable 2.3: Achievements Configuration
**File**: `/config/gamification/achievements.json`

| Requirement | Status | Notes |
|------------|--------|-------|
| Achievement: "First Session" (complete 1 session) | ⬜ | |
| Achievement: "Week Warrior" (7-day streak) | ⬜ | |
| Achievement: "Centurion" (100 reviews) | ⬜ | |
| Achievement: "Perfect Ten" (10 correct in a row) | ⬜ | |
| Achievement: "Speed Demon" (50 reviews <3s avg) | ⬜ | |
| Achievement: "Dedicated" (30-day streak) | ⬜ | |
| Achievement: "Kanji Novice" (10 kanji learned) | ⬜ | |
| Achievement: "Level 10" (reach level 10) | ⬜ | |
| Achievement: "Early Bird" (study before 6am) | ⬜ | |
| Achievement: "Night Owl" (study after 10pm) | ⬜ | |
| Each has: id, name, description, icon, condition | ⬜ | |
| JSON schema validation | ⬜ | |

**Overall Status**: ⬜ NOT STARTED
**Blocker**: None
**Supervisor Notes**:

---

### Deliverable 2.4: Levels Configuration
**File**: `/config/gamification/levels.json`

| Requirement | Status | Notes |
|------------|--------|-------|
| levelFormula: "floor(totalXP / xpPerLevel)" | ⬜ | |
| xpPerLevel: number | ⬜ | Default: 1000 |
| maxLevel: number | ⬜ | Default: 100 |
| levelRewards: { level: number, reward: string }[] | ⬜ | Optional |
| JSON schema validation | ⬜ | |

**Overall Status**: ⬜ NOT STARTED
**Blocker**: None
**Supervisor Notes**:

---

### Deliverable 2.5: Config Tests
**File**: `config/gamification/__tests__/config-validation.test.ts`

| Test Case | Status | Notes |
|-----------|--------|-------|
| XP config loads successfully | ⬜ | |
| Streak config loads successfully | ⬜ | |
| Achievements config loads successfully | ⬜ | |
| Levels config loads successfully | ⬜ | |
| Invalid JSON rejected | ⬜ | |
| Missing required fields rejected | ⬜ | |
| XP rules evaluate correctly | ⬜ | |
| Streak conditions evaluate correctly | ⬜ | |
| Achievement conditions evaluate correctly | ⬜ | |

**Overall Status**: ⬜ NOT STARTED
**Blocker**: None
**Supervisor Notes**:

---

## 🎨 Agent 3: UI Integration

### Deliverable 3.1: Gamification Hook
**File**: `src/hooks/useGamification.ts`

| Requirement | Status | Notes |
|------------|--------|-------|
| Returns: totalXP, currentLevel, currentStreak, bestStreak | ⬜ | |
| Returns: unlockedAchievements | ⬜ | |
| Returns: awardXP() method | ⬜ | |
| Returns: loading state | ⬜ | |
| Returns: error state | ⬜ | |
| Feature flag check: return defaults if disabled | ⬜ | |
| Syncs with Zustand store | ⬜ | |
| Auto-loads from IndexedDB on mount | ⬜ | |
| TypeScript types exported | ⬜ | |

**Overall Status**: ⬜ NOT STARTED
**Blocker**: Agent 1 (state store must exist) |
**Supervisor Notes**:

---

### Deliverable 3.2: Profile Page Update
**File**: `src/app/account/page.tsx`

| Requirement | Status | Notes |
|------------|--------|-------|
| Remove mock data imports | ⬜ | |
| Add useGamification() hook | ⬜ | |
| Display: Current XP | ⬜ | |
| Display: Current Level | ⬜ | |
| Display: Current Streak | ⬜ | |
| Display: Best Streak | ⬜ | |
| Show "0" values if feature flag disabled | ⬜ | |
| No runtime errors if gamification disabled | ⬜ | |

**Overall Status**: ⬜ NOT STARTED
**Blocker**: Agent 3.1 (hook must exist) |
**Supervisor Notes**:

---

### Deliverable 3.3: Achievements Page Update
**File**: `src/app/achievements/page.tsx`

| Requirement | Status | Notes |
|------------|--------|-------|
| Remove mock data imports | ⬜ | |
| Add useGamification() hook | ⬜ | |
| Load achievements from config | ⬜ | |
| Show locked/unlocked states | ⬜ | |
| Display achievement progress | ⬜ | |
| Render with mock data if feature flag OFF | ⬜ | |
| No network calls if using mock data | ⬜ | |

**Overall Status**: ⬜ NOT STARTED
**Blocker**: Agent 3.1 (hook must exist) |
**Supervisor Notes**:

---

### Deliverable 3.4: Leaderboard Page Update
**File**: `src/app/leaderboard/page.tsx`

| Requirement | Status | Notes |
|------------|--------|-------|
| Keep mock data rendering | ⬜ | No server dependency |
| Add info banner: "Mock data only" | ⬜ | |
| Optional: Add opt-in for real leaderboard | ⬜ | Future feature |
| No network calls | ⬜ | |

**Overall Status**: ⬜ NOT STARTED
**Blocker**: None |
**Supervisor Notes**:

---

### Deliverable 3.5: Component Tests
**File**: `src/hooks/__tests__/useGamification.test.tsx`

| Test Case | Status | Notes |
|-----------|--------|-------|
| Hook returns correct initial values | ⬜ | |
| Hook updates when XP awarded | ⬜ | |
| Hook updates when streak increments | ⬜ | |
| Hook returns defaults if feature flag OFF | ⬜ | |
| Profile page renders with gamification data | ⬜ | |
| Achievements page renders locked/unlocked | ⬜ | |
| No errors when feature flag disabled | ⬜ | |
| Snapshot tests for all UI components | ⬜ | |

**Overall Status**: ⬜ NOT STARTED
**Blocker**: Agent 3.1-3.4 (components must exist) |
**Supervisor Notes**:

---

## 🧪 Agent 4: QA & Observability

### Deliverable 4.1: Telemetry Setup
**File**: `src/lib/telemetry/gamificationMetrics.ts`

| Requirement | Status | Notes |
|------------|--------|-------|
| Log: XP awarded (amount, source, timestamp) | ⬜ | |
| Log: Streak incremented (new value) | ⬜ | |
| Log: Streak reset (reason) | ⬜ | |
| Log: Achievement unlocked (id, name) | ⬜ | |
| Metric: Total XP awarded per day | ⬜ | |
| Metric: Streak increments per day | ⬜ | |
| Metric: Achievement unlock rate | ⬜ | |
| Dashboard mock JSON with sample logs | ⬜ | |
| Feature flag: disable logging if gamification OFF | ⬜ | |

**Overall Status**: ⬜ NOT STARTED
**Blocker**: None |
**Supervisor Notes**:

---

### Deliverable 4.2: Unit Tests
**File**: `tests/unit/gamification.test.ts`

| Test Case | Status | Notes |
|-----------|--------|-------|
| XP calculation matches config | ⬜ | |
| Accuracy bonus calculated correctly | ⬜ | |
| Speed bonus calculated correctly | ⬜ | |
| Streak bonus calculated correctly | ⬜ | |
| Daily XP cap enforced | ⬜ | |
| Anti-cheat: max XP per session | ⬜ | |
| Streak increments on ≥10 XP | ⬜ | |
| Streak unchanged on <10 XP | ⬜ | |
| Streak resets on missed day | ⬜ | |
| Level calculation correct | ⬜ | |
| Achievement unlock conditions | ⬜ | |

**Overall Status**: ⬜ NOT STARTED
**Blocker**: None |
**Supervisor Notes**:

---

### Deliverable 4.3: Integration Tests
**File**: `tests/integration/gamification.test.ts`

| Test Case | Status | Notes |
|-----------|--------|-------|
| URE emits SESSION_COMPLETED → Listener receives | ⬜ | |
| Listener calculates XP → State updated | ⬜ | |
| State updated → IndexedDB saved | ⬜ | |
| Achievement unlocked → State updated | ⬜ | |
| Feature flag OFF → No updates occur | ⬜ | |
| Multiple sessions → Correct totals | ⬜ | |
| Offline mode → IndexedDB works | ⬜ | |
| Online mode → Firebase sync (premium) | ⬜ | |

**Overall Status**: ⬜ NOT STARTED
**Blocker**: Agent 1 (core must exist) |
**Supervisor Notes**:

---

### Deliverable 4.4: E2E Tests
**File**: `tests/e2e/gamification.spec.ts`

| Test Case | Status | Notes |
|-----------|--------|-------|
| Complete 10 reviews → Streak increments | ⬜ | |
| Practice 7 consecutive days → "Week Warrior" unlocks | ⬜ | |
| Earn 1000 XP → Level 2 reached | ⬜ | |
| Miss a day → Streak resets to 0 | ⬜ | |
| Feature flag OFF → No XP/streak UI | ⬜ | |
| Toggle flag ON → Gamification appears | ⬜ | |
| Profile page displays correct XP/level | ⬜ | |
| Achievements page shows unlocked badges | ⬜ | |

**Overall Status**: ⬜ NOT STARTED
**Blocker**: Agent 1, 3 (full system must exist) |
**Supervisor Notes**:

---

## 👁️ Agent 5: Supervisor (Final Review)

### Deliverable 5.1: Architecture Audit
| Requirement | Status | Notes |
|------------|--------|-------|
| Zero modifications to URE core files | ⬜ | |
| All gamification logic in /gamification/ folder | ⬜ | |
| No hardcoded XP/achievement values | ⬜ | |
| All rules defined in JSON configs | ⬜ | |
| Feature flag controls entire system | ⬜ | |
| No leaks into non-gamification code | ⬜ | |

**Overall Status**: ⬜ NOT STARTED
**Blocker**: All agents must complete |
**Supervisor Notes**:

---

### Deliverable 5.2: Test Suite
| Requirement | Status | Notes |
|------------|--------|-------|
| All unit tests pass (100% of implemented) | ⬜ | |
| All integration tests pass | ⬜ | |
| All E2E tests pass | ⬜ | |
| Code coverage ≥80% for gamification module | ⬜ | |
| No console errors in test runs | ⬜ | |
| Feature flag toggle tested in staging | ⬜ | |

**Overall Status**: ⬜ NOT STARTED
**Blocker**: Agent 4 (tests must exist) |
**Supervisor Notes**:

---

### Deliverable 5.3: Documentation
| Requirement | Status | Notes |
|------------|--------|-------|
| Architecture overview complete | ⬜ | |
| Implementation roadmap complete | ⬜ | |
| Agent coordination guide complete | ⬜ | |
| Launch checklist complete | ⬜ | |
| API documentation for listeners | ⬜ | |
| Config reference documentation | ⬜ | |

**Overall Status**: ⬜ NOT STARTED
**Blocker**: None |
**Supervisor Notes**:

---

### Deliverable 5.4: Launch Approval
| Requirement | Status | Notes |
|------------|--------|-------|
| All Agent 1 deliverables ✅ | ⬜ | |
| All Agent 2 deliverables ✅ | ⬜ | |
| All Agent 3 deliverables ✅ | ⬜ | |
| All Agent 4 deliverables ✅ | ⬜ | |
| All Agent 5 deliverables ✅ | ⬜ | |
| No regressions in existing features | ⬜ | |
| Feature flag tested in production-like env | ⬜ | |
| Launch checklist 100% complete | ⬜ | |

**Overall Status**: ⬜ NOT STARTED
**Blocker**: All agents must complete |
**Supervisor Notes**:

---

## 🚦 Overall Status Summary

| Agent | Deliverables | Status | Completion % |
|-------|-------------|--------|--------------|
| Agent 1: Core | 4 | ⬜ NOT STARTED | 0% |
| Agent 2: Config | 5 | ⬜ NOT STARTED | 0% |
| Agent 3: UI | 5 | ⬜ NOT STARTED | 0% |
| Agent 4: QA | 4 | ⬜ NOT STARTED | 0% |
| Agent 5: Supervisor | 4 | 🟡 IN PROGRESS | 20% |
| **TOTAL** | **22** | **🔴 NOT STARTED** | **4%** |

---

## 📝 Daily Stand-up Report

### 2025-10-02
- **Agent 1**: Not started
- **Agent 2**: Not started
- **Agent 3**: Not started
- **Agent 4**: Not started
- **Agent 5**: Documentation in progress (QA Matrix created)

**Blockers**: None
**Next Steps**: Complete remaining supervisor documentation, then unblock Agent 2 (configs)

---

## 🚫 Merge Gate Policy

**NO CODE MERGES TO MAIN UNTIL:**
1. This QA Matrix shows 100% completion
2. All tests green (unit, integration, E2E)
3. Supervisor final sign-off issued
4. Launch checklist approved

---

## 📊 Status Legend

- ⬜ NOT STARTED
- 🟡 IN PROGRESS
- ✅ COMPLETED
- ❌ FAILED
- 🔴 BLOCKED

---

**Last Updated by**: Agent 5 (Supervisor)
**Next Review**: After Agent 1-4 complete first deliverables
**Sign-off Authority**: Agent 5 ONLY
