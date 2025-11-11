# Gamification Configuration

**Version**: 1.0.0
**Last Updated**: 2025-10-02
**Owner**: Agent 2 (Config & Rules)

---

## Overview

This directory contains all gamification configuration files for the Moshimoshi Japanese learning platform. All gamification rules are defined in JSON files to allow easy modification without code changes.

**Core Principle**: NO hardcoded values in code. Everything is configurable via these JSON files.

---

## Files

### 1. `xp.json` - XP Calculation Rules

Defines how XP (experience points) are calculated and awarded.

**Key Values**:
- `baseXP`: 10 XP per correct answer
- `dailyXPCap`: 500 XP maximum per day
- `antiCheat.maxPerSession`: 200 XP maximum per session

**Bonuses**:
- **Accuracy**: 1.5x for 100%, 1.3x for 90%, 1.2x for 80%
- **Speed**: +5 XP for answers under 3 seconds
- **Streak**: +2 XP per item when on a 10+ correct streak (max +50 XP)

**Import**:
```typescript
import xpConfig from '@/config/gamification/xp.json'
const baseXP = xpConfig.baseXP // 10
```

---

### 2. `streak.json` - Streak Requirements and Rules

Defines streak tracking and maintenance rules.

**Key Values**:
- `minXPForStreak`: 10 XP minimum to maintain streak
- `gracePeriodHours`: 24-hour grace period before streak breaks
- `resetTime`: "00:00" UTC daily reset

**Premium Features**:
- **Streak Freeze**: Premium users can freeze streak for 1 day (max 3 freezes)
- **Notifications**: Reminders at 8 PM and 10 PM if no activity

**Import**:
```typescript
import streakConfig from '@/config/gamification/streak.json'
const minXP = streakConfig.minXPForStreak // 10
```

---

### 3. `achievements.json` - Achievement Definitions

Defines all 10 achievements users can unlock.

**Achievement List**:
1. **First Session** (🎯) - Complete 1 session [Common, 10 pts]
2. **Week Warrior** (🔥) - 7-day streak [Uncommon, 50 pts]
3. **Centurion** (💯) - 100 sessions [Rare, 100 pts]
4. **Perfect Ten** (⭐) - 10 correct in a row [Uncommon, 30 pts]
5. **Speed Demon** (⚡) - 50 reviews <3s [Rare, 75 pts]
6. **Dedicated Learner** (🏆) - 30-day streak [Epic, 150 pts]
7. **Kanji Novice** (📚) - 10 kanji learned [Common, 25 pts]
8. **Rising Star** (🌟) - Reach level 10 [Rare, 100 pts]
9. **Early Bird** (🌅) - Study before 6 AM [Uncommon, 20 pts]
10. **Night Owl** (🦉) - Study after 10 PM [Uncommon, 20 pts]

**Condition Types**:
- `session_count` - Total sessions completed
- `streak` - Current streak length
- `best_streak` - Best streak in a session
- `level` - Current level
- `kanji_learned` - Total kanji learned
- `speed_reviews` - Count of fast reviews
- `time_of_day` - Hour of day (0-23)

**Import**:
```typescript
import achievementsConfig from '@/config/gamification/achievements.json'
const achievements = achievementsConfig.achievements // array of 10
```

---

### 4. `levels.json` - Level Progression Formula

Defines how levels are calculated and rewarded.

**Key Values**:
- `xpPerLevel`: 1000 XP per level
- `maxLevel`: 100
- `formula`: "floor(totalXP / xpPerLevel)"

**Level Calculation**:
```typescript
// Example: User has 5,500 XP
const level = Math.floor(5500 / 1000) // Level 5
```

**Level Rewards**:
- Level 5: Novice badge
- Level 10: Apprentice badge
- Level 25: Intermediate badge
- Level 50: Advanced badge
- Level 75: Expert badge
- Level 100: Master badge

**XP Requirements**:
- Level 2: 1,000 XP
- Level 10: 9,000 XP
- Level 25: 24,000 XP
- Level 50: 49,000 XP
- Level 100: 99,000 XP

**Import**:
```typescript
import levelsConfig from '@/config/gamification/levels.json'
const xpPerLevel = levelsConfig.xpPerLevel // 1000
```

---

## Common Modifications

### Change Base XP Value

1. Open `xp.json`
2. Modify `baseXP` value (currently 10)
3. Run tests: `npm test config/gamification`
4. Restart the app

**Example**:
```json
{
  "baseXP": 15  // Changed from 10 to 15
}
```

---

### Change Streak Requirement

1. Open `streak.json`
2. Modify `minXPForStreak` (currently 10)
3. Run tests: `npm test config/gamification`

**Example**:
```json
{
  "minXPForStreak": 20  // Changed from 10 to 20
}
```

---

### Change Daily XP Cap

1. Open `xp.json`
2. Modify `dailyXPCap` (currently 500)
3. Ensure it's greater than `antiCheat.maxPerSession`
4. Run tests: `npm test config/gamification`

**Example**:
```json
{
  "dailyXPCap": 1000,  // Changed from 500 to 1000
  "antiCheat": {
    "maxPerSession": 300  // Must be less than dailyXPCap
  }
}
```

---

### Add a New Achievement

**Note**: Current design allows exactly 10 achievements. To add more:

1. Open `achievements.json`
2. Add new achievement object to the array
3. Assign unique `id`
4. Choose appropriate `condition.type` from available types
5. Update test file to expect 11 achievements
6. Run tests: `npm test config/gamification`

**Template**:
```json
{
  "id": "new_achievement_id",
  "name": "Achievement Name",
  "description": "Short description under 50 chars",
  "icon": "🎊",
  "category": "progress",
  "points": 50,
  "rarity": "uncommon",
  "condition": {
    "type": "session_count",
    "operator": ">=",
    "value": 50
  }
}
```

---

### Change Level Progression Speed

1. Open `levels.json`
2. Modify `xpPerLevel` (currently 1000)
3. Update `xpTable` entries to match new formula
4. Run tests: `npm test config/gamification`

**Example - Faster Progression**:
```json
{
  "xpPerLevel": 500,  // Changed from 1000 to 500
  "xpTable": [
    { "level": 2, "xpRequired": 500 },   // Updated from 1000
    { "level": 3, "xpRequired": 1000 },  // Updated from 2000
    { "level": 5, "xpRequired": 2000 }   // Updated from 4000
  ]
}
```

---

## Validation

### Run All Tests

```bash
npm test config/gamification/__tests__/config-validation.test.ts
```

**Expected Result**: All 38 tests should pass.

### Validate JSON Syntax

```bash
node -e "console.log(require('./config/gamification/xp.json'))"
node -e "console.log(require('./config/gamification/streak.json'))"
node -e "console.log(require('./config/gamification/achievements.json'))"
node -e "console.log(require('./config/gamification/levels.json'))"
```

### Check TypeScript Compilation

```bash
npx tsc --noEmit
```

---

## Integration

These configs are consumed by:

**Agent 1 (Core)**:
- `src/lib/gamification/gamificationListener.ts` - Listens to review events
- `src/state/userGamification.ts` - Manages user gamification state

**Agent 3 (UI)**:
- `src/hooks/useGamification.ts` - React hook for components
- `src/app/achievements/page.tsx` - Achievements page
- `src/app/account/page.tsx` - Profile page (XP/streak/level display)

---

## Testing

### Unit Tests

All configs have comprehensive unit tests in `__tests__/config-validation.test.ts`.

**Test Coverage**:
- JSON parsing and loading
- Value validation (ranges, types)
- Consistency checks (cross-config validation)
- Formula verification

**Run Tests**:
```bash
npm test config/gamification
```

---

## Feature Flag

All gamification is controlled by a feature flag:

```typescript
const ENABLE_GAMIFICATION = process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION === 'true'
```

**To Enable**:
```bash
# .env.local
NEXT_PUBLIC_ENABLE_GAMIFICATION=true
```

**To Disable**:
```bash
# .env.local
NEXT_PUBLIC_ENABLE_GAMIFICATION=false
```

---

## Architecture Notes

### Config-Driven Design

All gamification logic is driven by these JSON configs. This allows:
- **Easy balancing**: Tweak XP values without code changes
- **A/B testing**: Different configs for different user groups
- **Version control**: Track config changes over time
- **Hot reloading**: Update configs without redeployment (future)

### No Hardcoded Values

**❌ Wrong**:
```typescript
const xp = 10 // Hardcoded
```

**✅ Correct**:
```typescript
import xpConfig from '@/config/gamification/xp.json'
const xp = xpConfig.baseXP
```

### Validation Required

After any config change:
1. Run tests: `npm test config/gamification`
2. Validate JSON syntax
3. Check TypeScript compilation
4. Test in local environment

---

## Support

**Questions?**
- **Agent 1 (Core)**: Implementation questions
- **Agent 5 (Supervisor)**: Architecture and approval
- **Documentation**: `/docs/gamification-new/`

---

## Changelog

### v1.0.0 (2025-10-02)
- Initial configuration setup
- 4 config files created (XP, Streak, Achievements, Levels)
- 10 achievements defined
- Complete test coverage (38 tests)
- Documentation complete

---

**Signed**: Agent 2 (Config & Rules)
**Date**: 2025-10-02
