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
      expect(xpConfig.baseXP).toBe(10)
    })

    it('should have accuracy bonuses in descending order', () => {
      const thresholds = xpConfig.bonuses.accuracy.map(b => b.threshold)
      const sorted = [...thresholds].sort((a, b) => b - a)
      expect(thresholds).toEqual(sorted)
      expect(thresholds).toEqual([100, 90, 80])
    })

    it('should have valid accuracy multipliers', () => {
      xpConfig.bonuses.accuracy.forEach(bonus => {
        expect(bonus.multiplier).toBeGreaterThan(1)
        expect(bonus.description).toBeTruthy()
      })
    })

    it('should have valid speed bonus', () => {
      expect(xpConfig.bonuses.speed.thresholdMs).toBeGreaterThan(0)
      expect(xpConfig.bonuses.speed.bonus).toBeGreaterThan(0)
      expect(xpConfig.bonuses.speed.thresholdMs).toBe(3000)
    })

    it('should have valid streak bonus', () => {
      expect(xpConfig.bonuses.streak.minStreak).toBeGreaterThan(0)
      expect(xpConfig.bonuses.streak.bonusPerItem).toBeGreaterThan(0)
      expect(xpConfig.bonuses.streak.maxBonus).toBeGreaterThan(0)
    })

    it('should have valid daily cap', () => {
      expect(xpConfig.dailyXPCap).toBeGreaterThan(0)
      expect(xpConfig.dailyXPCap).toBeGreaterThan(xpConfig.antiCheat.maxPerSession)
      expect(xpConfig.dailyXPCap).toBe(500)
    })

    it('should have valid anti-cheat settings', () => {
      expect(xpConfig.antiCheat.enabled).toBe(true)
      expect(xpConfig.antiCheat.maxPerSession).toBeGreaterThan(0)
      expect(xpConfig.antiCheat.suspiciousThreshold).toBeGreaterThan(0)
      expect(xpConfig.antiCheat.maxPerSession).toBe(200)
    })
  })

  describe('Streak Config', () => {
    it('should load streak.json successfully', () => {
      expect(streakConfig).toBeDefined()
      expect(streakConfig.version).toBe('1.0.0')
    })

    it('should have valid minXPForStreak', () => {
      expect(streakConfig.minXPForStreak).toBeGreaterThan(0)
      expect(streakConfig.minXPForStreak).toBe(10)
    })

    it('should have valid grace period', () => {
      expect(streakConfig.gracePeriodHours).toBeGreaterThan(0)
      expect(streakConfig.gracePeriodHours).toBeLessThanOrEqual(48)
      expect(streakConfig.gracePeriodHours).toBe(24)
    })

    it('should have valid reset time', () => {
      expect(streakConfig.resetTime).toMatch(/^\d{2}:\d{2}$/)
      expect(streakConfig.resetTime).toBe('00:00')
    })

    it('should have valid timezone', () => {
      expect(typeof streakConfig.timezone).toBe('string')
      expect(streakConfig.timezone).toBe('UTC')
    })

    it('should have valid streak freeze settings', () => {
      expect(streakConfig.streakFreeze.enabled).toBe(true)
      expect(streakConfig.streakFreeze.requiresPremium).toBe(true)
      expect(streakConfig.streakFreeze.maxFreezes).toBeGreaterThan(0)
      expect(streakConfig.streakFreeze.freezeDurationDays).toBeGreaterThan(0)
    })

    it('should have valid notification settings', () => {
      expect(streakConfig.notifications.enabled).toBe(true)
      expect(Array.isArray(streakConfig.notifications.reminderHours)).toBe(true)
      streakConfig.notifications.reminderHours.forEach(hour => {
        expect(hour).toBeGreaterThanOrEqual(0)
        expect(hour).toBeLessThanOrEqual(23)
      })
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

    it('should have all required achievement IDs', () => {
      const requiredIds = [
        'first_session',
        'week_warrior',
        'centurion',
        'perfect_ten',
        'speed_demon',
        'dedicated',
        'kanji_novice',
        'level_10',
        'early_bird',
        'night_owl'
      ]
      const actualIds = achievementsConfig.achievements.map(a => a.id)
      requiredIds.forEach(id => {
        expect(actualIds).toContain(id)
      })
    })

    it('should have valid conditions', () => {
      const validTypes = [
        'session_count',
        'streak',
        'best_streak',
        'level',
        'kanji_learned',
        'speed_reviews',
        'time_of_day'
      ]
      const validOperators = ['>=', '>', '<=', '<', '==']

      achievementsConfig.achievements.forEach(achievement => {
        expect(achievement.condition).toBeDefined()
        expect(validTypes).toContain(achievement.condition.type)
        expect(validOperators).toContain(achievement.condition.operator)
        expect(achievement.condition.value).toBeGreaterThanOrEqual(0)
      })
    })

    it('should have valid points', () => {
      achievementsConfig.achievements.forEach(achievement => {
        expect(achievement.points).toBeGreaterThan(0)
      })
    })

    it('should have valid categories', () => {
      const validCategories = ['progress', 'streak', 'accuracy', 'speed', 'special']
      achievementsConfig.achievements.forEach(achievement => {
        expect(validCategories).toContain(achievement.category)
      })
    })

    it('should have valid rarities', () => {
      const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary']
      achievementsConfig.achievements.forEach(achievement => {
        expect(validRarities).toContain(achievement.rarity)
      })
    })

    it('should have single emoji icons', () => {
      achievementsConfig.achievements.forEach(achievement => {
        expect(achievement.icon).toBeTruthy()
        expect(achievement.icon.length).toBeGreaterThan(0)
        expect(achievement.icon.length).toBeLessThan(10)
      })
    })

    it('should have descriptions', () => {
      achievementsConfig.achievements.forEach(achievement => {
        expect(achievement.description).toBeTruthy()
        expect(achievement.description.length).toBeGreaterThan(0)
        expect(achievement.description.length).toBeLessThan(100)
      })
    })
  })

  describe('Levels Config', () => {
    it('should load levels.json successfully', () => {
      expect(levelsConfig).toBeDefined()
      expect(levelsConfig.version).toBe('1.0.0')
    })

    it('should have valid xpPerLevel', () => {
      expect(levelsConfig.xpPerLevel).toBeGreaterThan(0)
      expect(levelsConfig.xpPerLevel).toBe(1000)
    })

    it('should have valid maxLevel', () => {
      expect(levelsConfig.maxLevel).toBeGreaterThan(0)
      expect(levelsConfig.maxLevel).toBeLessThanOrEqual(200)
      expect(levelsConfig.maxLevel).toBe(100)
    })

    it('should have valid formula', () => {
      expect(levelsConfig.formula).toBe('floor(totalXP / xpPerLevel)')
    })

    it('should calculate level correctly', () => {
      const testCases = [
        { xp: 0, expectedLevel: 0 },
        { xp: 500, expectedLevel: 0 },
        { xp: 1000, expectedLevel: 1 },
        { xp: 1999, expectedLevel: 1 },
        { xp: 2000, expectedLevel: 2 },
        { xp: 10000, expectedLevel: 10 },
        { xp: 99000, expectedLevel: 99 }
      ]

      testCases.forEach(({ xp, expectedLevel }) => {
        const calculatedLevel = Math.floor(xp / levelsConfig.xpPerLevel)
        expect(calculatedLevel).toBe(expectedLevel)
      })
    })

    it('should have level rewards sorted by level', () => {
      const levels = levelsConfig.levelRewards.map(r => r.level)
      const sorted = [...levels].sort((a, b) => a - b)
      expect(levels).toEqual(sorted)
    })

    it('should have no duplicate reward levels', () => {
      const levels = levelsConfig.levelRewards.map(r => r.level)
      const uniqueLevels = new Set(levels)
      expect(uniqueLevels.size).toBe(levels.length)
    })

    it('should have valid level rewards', () => {
      levelsConfig.levelRewards.forEach(reward => {
        expect(reward.level).toBeGreaterThan(0)
        expect(reward.reward).toBeTruthy()
        expect(reward.title).toBeTruthy()
      })
    })

    it('should have xpTable entries matching formula', () => {
      levelsConfig.xpTable.forEach(entry => {
        const expectedXP = (entry.level - 1) * levelsConfig.xpPerLevel
        expect(entry.xpRequired).toBe(expectedXP)
      })
    })

    it('should have xpTable sorted by level', () => {
      const levels = levelsConfig.xpTable.map(e => e.level)
      const sorted = [...levels].sort((a, b) => a - b)
      expect(levels).toEqual(sorted)
    })
  })

  describe('Config Integration', () => {
    it('should have consistent XP and streak values', () => {
      expect(streakConfig.minXPForStreak).toBe(10)
      expect(xpConfig.baseXP).toBe(10)
    })

    it('should have achievable level requirements', () => {
      const level10Achievement = achievementsConfig.achievements.find(
        a => a.id === 'level_10'
      )
      expect(level10Achievement).toBeDefined()
      expect(level10Achievement?.condition.value).toBe(10)
    })

    it('should have realistic XP caps', () => {
      expect(xpConfig.dailyXPCap).toBeGreaterThan(xpConfig.antiCheat.maxPerSession)
      expect(xpConfig.antiCheat.suspiciousThreshold).toBeGreaterThan(xpConfig.dailyXPCap)
    })
  })
})
