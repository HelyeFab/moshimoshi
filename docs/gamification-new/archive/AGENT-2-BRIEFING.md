# 📋 Agent 2 (Config & Rules) - Mission Briefing

**Agent**: Agent 2 - Configuration Architect
**Phase**: Phase 1 (Config & Rules)
**Status**: ✅ READY TO START
**Duration**: 2-3 days
**Dependencies**: None (can start immediately)

---

## 🎯 Your Mission

Create 4 JSON configuration files that define all gamification rules. These configs will be consumed by Agent 1 (Core) to calculate XP, check streaks, and unlock achievements.

**Critical**: NO hardcoded values in code. Everything must be configurable via JSON.

---

## 📖 Required Reading (In Order)

### Step 1: Understand the Architecture (30 minutes)
**Read**: `/docs/gamification-new/ARCHITECTURE-OVERVIEW.md`

**Focus on**:
- Section: "Configuration System" (pages with config JSON examples)
- Section: "Data Flow Scenarios" (how configs are used)
- Section: "Component Breakdown" → Config files

**Key Takeaways**:
- Configs define XP bonuses, streak rules, achievements, levels
- Configs must be JSON parseable (no comments, trailing commas)
- Configs will be imported directly in TypeScript: `import xpConfig from '@/config/gamification/xp.json'`

---

### Step 2: Review Your Deliverables (15 minutes)
**Read**: `/docs/gamification-new/QA-MATRIX.md`

**Focus on**:
- Section: "Agent 2: Config & Rules"
- All 5 deliverables (2.1 through 2.5)
- Acceptance criteria checkboxes

**Key Takeaways**:
- You must deliver 4 config files + 1 test file
- Each config needs validation
- Supervisor will review before approval

---

### Step 3: Get Implementation Details (45 minutes)
**Read**: `/docs/gamification-new/IMPLEMENTATION-ROADMAP.md`

**Focus on**:
- Section: "Phase 1: Configuration Setup (Agent 2)"
- Steps 1.1 through 1.6 (complete templates provided)

**Key Takeaways**:
- Exact JSON structure for each config
- Validation requirements
- Test cases to implement

---

### Step 4: Understand Team Collaboration (20 minutes)
**Read**: `/docs/gamification-new/AGENT-COORDINATION.md`

**Focus on**:
- Section: "Agent 2: Config & Rules" (your role)
- Section: "Phase 1 → Phase 2 Handoff" (how you hand off to Agent 1)
- Section: "Best Practices" → For All Agents

**Key Takeaways**:
- You're unblocking Agent 1 (Core)
- Config structure determines Agent 1's implementation
- Your configs must be easy to understand and modify

---

## 📝 Your Deliverables

### Deliverable 2.1: XP Configuration
**File**: `/config/gamification/xp.json`

**Requirements**:
```json
{
  "$schema": "./schemas/xp-schema.json",
  "version": "1.0.0",
  "baseXP": 10,
  "bonuses": {
    "accuracy": [
      { "threshold": 100, "multiplier": 1.5, "description": "Perfect accuracy" },
      { "threshold": 90, "multiplier": 1.3, "description": "Excellent accuracy" },
      { "threshold": 80, "multiplier": 1.2, "description": "Good accuracy" }
    ],
    "speed": {
      "thresholdMs": 3000,
      "bonus": 5,
      "description": "Under 3 seconds average"
    },
    "streak": {
      "minStreak": 10,
      "bonusPerItem": 2,
      "maxBonus": 50,
      "description": "Correct answer streak bonus"
    }
  },
  "dailyXPCap": 500,
  "antiCheat": {
    "enabled": true,
    "maxPerSession": 200,
    "suspiciousThreshold": 1000,
    "logSuspiciousActivity": true
  }
}
```

**Validation Checklist**:
- [ ] Valid JSON (no syntax errors)
- [ ] All numeric values > 0
- [ ] Accuracy thresholds in descending order (100, 90, 80)
- [ ] dailyXPCap > maxPerSession
- [ ] Speed thresholdMs is realistic (3000ms = 3 seconds)

---

### Deliverable 2.2: Streak Configuration
**File**: `/config/gamification/streak.json`

**Requirements**:
```json
{
  "$schema": "./schemas/streak-schema.json",
  "version": "1.0.0",
  "minXPForStreak": 10,
  "gracePeriodHours": 24,
  "resetTime": "00:00",
  "timezone": "UTC",
  "streakFreeze": {
    "enabled": true,
    "requiresPremium": true,
    "maxFreezes": 3,
    "freezeDurationDays": 1,
    "description": "Allow premium users to freeze streak for 1 day"
  },
  "notifications": {
    "enabled": true,
    "reminderHours": [20, 22],
    "description": "Remind at 8pm and 10pm if no activity"
  }
}
```

**Validation Checklist**:
- [ ] Valid JSON
- [ ] minXPForStreak > 0
- [ ] gracePeriodHours between 0-48
- [ ] resetTime in HH:MM format
- [ ] timezone is valid IANA timezone (UTC, America/New_York, etc.)
- [ ] reminderHours are valid hours (0-23)

---

### Deliverable 2.3: Achievements Configuration
**File**: `/config/gamification/achievements.json`

**Requirements**: Define exactly 10 achievements (no more, no less)

**Template**:
```json
{
  "$schema": "./schemas/achievements-schema.json",
  "version": "1.0.0",
  "achievements": [
    {
      "id": "first_session",
      "name": "First Session",
      "description": "Complete your first review session",
      "icon": "🎯",
      "category": "progress",
      "points": 10,
      "rarity": "common",
      "condition": {
        "type": "session_count",
        "operator": ">=",
        "value": 1
      }
    },
    // ... 9 more achievements
  ]
}
```

**Required Achievements** (use these exact IDs):
1. `first_session` - Complete 1 session
2. `week_warrior` - 7-day streak
3. `centurion` - 100 sessions
4. `perfect_ten` - 10 correct in a row
5. `speed_demon` - 50 reviews <3s average
6. `dedicated` - 30-day streak
7. `kanji_novice` - 10 kanji learned
8. `level_10` - Reach level 10
9. `early_bird` - Study before 6 AM
10. `night_owl` - Study after 10 PM

**Condition Types** (Agent 1 will implement these):
- `session_count` - Total sessions completed
- `streak` - Current streak length
- `best_streak` - Best streak in a session
- `level` - Current level
- `kanji_learned` - Total kanji learned
- `speed_reviews` - Count of fast reviews
- `time_of_day` - Hour of day (0-23)

**Validation Checklist**:
- [ ] Valid JSON
- [ ] Exactly 10 achievements
- [ ] All achievement IDs unique
- [ ] All point values > 0
- [ ] All icons are single emoji characters
- [ ] Categories in: progress, streak, accuracy, speed, special
- [ ] Rarities in: common, uncommon, rare, epic, legendary
- [ ] All conditions have valid type, operator, value

---

### Deliverable 2.4: Levels Configuration
**File**: `/config/gamification/levels.json`

**Requirements**:
```json
{
  "$schema": "./schemas/levels-schema.json",
  "version": "1.0.0",
  "formula": "floor(totalXP / xpPerLevel)",
  "xpPerLevel": 1000,
  "maxLevel": 100,
  "levelRewards": [
    { "level": 5, "reward": "badge_novice", "title": "Novice" },
    { "level": 10, "reward": "badge_apprentice", "title": "Apprentice" },
    { "level": 25, "reward": "badge_intermediate", "title": "Intermediate" },
    { "level": 50, "reward": "badge_advanced", "title": "Advanced" },
    { "level": 75, "reward": "badge_expert", "title": "Expert" },
    { "level": 100, "reward": "badge_master", "title": "Master" }
  ],
  "xpTable": [
    { "level": 1, "xpRequired": 0 },
    { "level": 2, "xpRequired": 1000 },
    { "level": 3, "xpRequired": 2000 },
    { "level": 5, "xpRequired": 4000 },
    { "level": 10, "xpRequired": 9000 },
    { "level": 25, "xpRequired": 24000 },
    { "level": 50, "xpRequired": 49000 },
    { "level": 100, "xpRequired": 99000 }
  ]
}
```

**Validation Checklist**:
- [ ] Valid JSON
- [ ] xpPerLevel > 0
- [ ] maxLevel between 1-200
- [ ] levelRewards sorted by level ascending
- [ ] No duplicate reward levels
- [ ] xpTable entries match formula (level N = (N-1) * 1000 XP)

---

### Deliverable 2.5: Config Tests
**File**: `/config/gamification/__tests__/config-validation.test.ts`

**Requirements**: Write Jest tests for all configs

**Template**:
```typescript
import xpConfig from '../xp.json'
import streakConfig from '../streak.json'
import achievementsConfig from '../achievements.json'
import levelsConfig from '../levels.json'

describe('Gamification Configs', () => {
  describe('XP Config', () => {
    it('should load xp.json successfully', () => {
      expect(xpConfig).toBeDefined()
      expect(xpConfig.version).toBe('1.0.0')
    })

    it('should have valid baseXP', () => {
      expect(xpConfig.baseXP).toBeGreaterThan(0)
    })

    it('should have accuracy bonuses in descending order', () => {
      const thresholds = xpConfig.bonuses.accuracy.map(b => b.threshold)
      const sorted = [...thresholds].sort((a, b) => b - a)
      expect(thresholds).toEqual(sorted)
    })

    it('should have valid daily cap', () => {
      expect(xpConfig.dailyXPCap).toBeGreaterThan(0)
      expect(xpConfig.dailyXPCap).toBeGreaterThan(xpConfig.antiCheat.maxPerSession)
    })
  })

  describe('Streak Config', () => {
    it('should load streak.json successfully', () => {
      expect(streakConfig).toBeDefined()
      expect(streakConfig.version).toBe('1.0.0')
    })

    it('should have valid minXPForStreak', () => {
      expect(streakConfig.minXPForStreak).toBeGreaterThan(0)
    })

    it('should have valid timezone', () => {
      // Basic validation (just check it's a string)
      expect(typeof streakConfig.timezone).toBe('string')
    })
  })

  describe('Achievements Config', () => {
    it('should load achievements.json successfully', () => {
      expect(achievementsConfig).toBeDefined()
      expect(achievementsConfig.version).toBe('1.0.0')
    })

    it('should have exactly 10 achievements', () => {
      expect(achievementsConfig.achievements).toHaveLength(10)
    })

    it('should have unique achievement IDs', () => {
      const ids = achievementsConfig.achievements.map(a => a.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    it('should have valid conditions', () => {
      achievementsConfig.achievements.forEach(achievement => {
        expect(achievement.condition).toBeDefined()
        expect(achievement.condition.type).toBeDefined()
        expect(achievement.condition.operator).toBeDefined()
        expect(achievement.condition.value).toBeDefined()
      })
    })
  })

  describe('Levels Config', () => {
    it('should load levels.json successfully', () => {
      expect(levelsConfig).toBeDefined()
      expect(levelsConfig.version).toBe('1.0.0')
    })

    it('should calculate level correctly', () => {
      // Test formula: floor(totalXP / xpPerLevel)
      const testCases = [
        { xp: 0, expectedLevel: 0 },
        { xp: 500, expectedLevel: 0 },
        { xp: 1000, expectedLevel: 1 },
        { xp: 1999, expectedLevel: 1 },
        { xp: 2000, expectedLevel: 2 },
        { xp: 10000, expectedLevel: 10 },
      ]

      testCases.forEach(({ xp, expectedLevel }) => {
        const calculatedLevel = Math.floor(xp / levelsConfig.xpPerLevel)
        expect(calculatedLevel).toBe(expectedLevel)
      })
    })
  })
})
```

**Test Execution**:
```bash
npm test config/gamification/__tests__/config-validation.test.ts
```

All tests must pass before handoff to Agent 1.

---

## 🚀 Step-by-Step Execution

### Step 1: Create Directory Structure (5 minutes)
```bash
mkdir -p config/gamification
mkdir -p config/gamification/__tests__
mkdir -p config/gamification/schemas
```

---

### Step 2: Create XP Config (30 minutes)
1. Create file: `config/gamification/xp.json`
2. Copy template from Deliverable 2.1
3. Validate JSON syntax (use JSON linter)
4. Review validation checklist
5. Test: Try importing in a TypeScript file

---

### Step 3: Create Streak Config (20 minutes)
1. Create file: `config/gamification/streak.json`
2. Copy template from Deliverable 2.2
3. Validate JSON syntax
4. Review validation checklist
5. Consider: Should grace period be 24 or 48 hours? (Decision: 24 hours)

---

### Step 4: Create Achievements Config (60 minutes)
1. Create file: `config/gamification/achievements.json`
2. Define all 10 achievements using template
3. Choose appropriate icons (emoji) for each
4. Assign rarity levels (2 common, 4 uncommon, 3 rare, 1 epic)
5. Validate all conditions are implementable
6. Review: Do achievement names/descriptions make sense to users?

**Tips**:
- Keep descriptions short (under 50 characters)
- Use action-oriented language ("Complete", "Achieve", "Reach")
- Make sure icons are visually distinct

---

### Step 5: Create Levels Config (20 minutes)
1. Create file: `config/gamification/levels.json`
2. Copy template from Deliverable 2.4
3. Validate xpTable entries
4. Consider: Is 1000 XP per level balanced? (Decision: Yes, based on 10 XP per correct answer)

**Math Check**:
- 1 session = ~10-20 correct answers = 100-200 XP
- Level 2 requires 1000 XP = 5-10 sessions
- Level 10 requires 9000 XP = 45-90 sessions
- Seems balanced ✓

---

### Step 6: Write Config Tests (45 minutes)
1. Create file: `config/gamification/__tests__/config-validation.test.ts`
2. Copy test template from Deliverable 2.5
3. Add additional test cases:
   - Test anti-cheat limits
   - Test streak freeze logic
   - Test achievement condition operators
   - Test level calculation edge cases
4. Run tests: `npm test config/gamification`
5. Fix any failures
6. Ensure 100% pass rate

---

### Step 7: Documentation (15 minutes)
1. Create `config/gamification/README.md`
2. Explain each config file's purpose
3. Document how to modify configs
4. Add examples of common changes

**Template**:
```markdown
# Gamification Configuration

## Files
- `xp.json` - XP calculation rules
- `streak.json` - Streak requirements and rules
- `achievements.json` - Achievement definitions
- `levels.json` - Level progression formula

## Modifying XP Values
To change base XP per correct answer:
1. Open `xp.json`
2. Change `baseXP` value
3. Run tests: `npm test config/gamification`

## Adding New Achievements
1. Open `achievements.json`
2. Add new achievement object
3. Assign unique `id`
4. Choose appropriate condition type
5. Update test to expect 11 achievements
```

---

### Step 8: Self-Review (20 minutes)
**Checklist**:
- [ ] All 4 config files created
- [ ] All JSON files parse successfully
- [ ] Test file created and all tests pass
- [ ] README.md created
- [ ] No syntax errors
- [ ] No hardcoded values in your configs (everything is configurable)
- [ ] Configs follow templates exactly
- [ ] Achievement IDs match required list

**Test Everything**:
```bash
# Parse all JSON files
node -e "console.log(require('./config/gamification/xp.json'))"
node -e "console.log(require('./config/gamification/streak.json'))"
node -e "console.log(require('./config/gamification/achievements.json'))"
node -e "console.log(require('./config/gamification/levels.json'))"

# Run tests
npm test config/gamification

# Check TypeScript compilation
npx tsc --noEmit
```

---

## 📤 Handoff to Agent 1 (Core)

### When You're Done
1. Run all tests (must pass 100%)
2. Update QA-MATRIX.md:
   - Mark all Agent 2 deliverables as ✅
   - Add "Agent 2 Sign-off: ✅ COMPLETE"
3. Create handoff document for Agent 1

### Handoff Document Template
**File**: `/docs/gamification-new/AGENT-1-BRIEFING.md`

```markdown
# Agent 1 Handoff: Config Complete

## Status
Agent 2 (Config) has completed all deliverables.

## What I Delivered
1. `/config/gamification/xp.json` - XP rules
2. `/config/gamification/streak.json` - Streak rules
3. `/config/gamification/achievements.json` - 10 achievements
4. `/config/gamification/levels.json` - Level formula
5. Config tests (100% passing)

## Important Notes for Agent 1
1. Import configs like this: `import xpConfig from '@/config/gamification/xp.json'`
2. Achievement conditions use these types: session_count, streak, best_streak, level, kanji_learned, speed_reviews, time_of_day
3. Operators: >=, >, <=, <, ==
4. Streak requires ≥10 XP per day (from streak.json)
5. Daily XP cap is 500 XP (from xp.json)

## Questions?
Ask me in Agent coordination channel or ask Supervisor.

Signed: Agent 2
Date: [Today's date]
```

---

## ❓ Common Questions

**Q: What if I want to change the number of achievements?**
A: Stick to 10 for this phase. We can add more in iteration 2.

**Q: What if I disagree with the XP values?**
A: Discuss with Supervisor. Provide reasoning. Supervisor will decide.

**Q: What if tests fail?**
A: Debug and fix. All tests must pass before handoff.

**Q: What if Agent 1 asks me to change configs?**
A: Make changes and re-run tests. Update handoff document.

**Q: Can I add more fields to configs?**
A: Only if they're optional. Don't break existing structure.

---

## 🎯 Success Criteria

You're done when:
- [x] All 4 config files created and valid JSON
- [x] Test file created with 100% pass rate
- [x] README.md explains configs
- [x] Handoff document created for Agent 1
- [x] QA-MATRIX.md updated with your sign-off
- [x] Supervisor has reviewed and approved (I'll do this)
- [x] No hardcoded values in code
- [x] Config structure matches templates exactly

---

## 📞 Need Help?

**Supervisor (Agent 5)**: Available for:
- Architecture questions
- Config structure clarifications
- Approval and sign-off

**Communication**: Update daily stand-up in QA-MATRIX.md

---

## 🎉 Let's Go!

You're unblocking the entire project. Agent 1 is waiting for your configs.

**Estimated Time**: 2-3 days
**Your Focus**: Accuracy, validation, documentation

Good luck! 🚀

**Signed**: Agent 5 (Supervisor)
**Date**: 2025-10-02
