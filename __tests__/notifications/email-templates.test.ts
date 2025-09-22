/**
 * Email Template Tests
 * Tests all email templates for proper HTML structure and content
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import {
  baseEmailTemplate,
  baseTextTemplate,
  dailyReminderHtml,
  dailyReminderText,
  DailyReminderData,
  achievementAlertHtml,
  achievementAlertText,
  AchievementAlertData,
  weeklyProgressHtml,
  weeklyProgressText,
  WeeklyProgressData,
} from '@/lib/notifications/email-templates'

describe('Email Templates', () => {
  describe('Base Template', () => {
    const baseProps = {
      userName: 'Test User',
      unsubscribeUrl: 'https://app.test/unsubscribe',
      preferencesUrl: 'https://app.test/preferences',
    }

    it('should generate valid HTML email template', () => {
      const content = '<p>Test content</p>'
      const html = baseEmailTemplate(content, baseProps)

      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('Moshimoshi')
      expect(html).toContain(content)
      expect(html).toContain(baseProps.unsubscribeUrl)
      expect(html).toContain(baseProps.preferencesUrl)
      expect(html).toContain('Your Japanese Learning Companion')
    })

    it('should generate valid text email template', () => {
      const content = 'Test content'
      const text = baseTextTemplate(content, baseProps)

      expect(text).toContain('Moshimoshi')
      expect(text).toContain(content)
      expect(text).toContain(baseProps.unsubscribeUrl)
      expect(text).toContain(baseProps.preferencesUrl)
    })

    it('should include current year in copyright', () => {
      const html = baseEmailTemplate('', baseProps)
      const currentYear = new Date().getFullYear()
      expect(html).toContain(`© ${currentYear} Moshimoshi`)
    })
  })

  describe('Daily Reminder Template', () => {
    let reminderData: DailyReminderData

    beforeEach(() => {
      reminderData = {
        userName: 'Test User',
        currentStreak: 7,
        totalReviews: 150,
        dueReviews: 25,
        lastStudyDate: new Date('2024-01-20T10:00:00Z'),
        studyUrl: 'https://app.test/review',
        unsubscribeUrl: 'https://app.test/unsubscribe',
        preferencesUrl: 'https://app.test/preferences',
      }
    })

    it('should generate HTML email with all user stats', () => {
      const html = dailyReminderHtml(reminderData)

      expect(html).toContain('Test User')
      expect(html).toContain('7 days')  // Current streak
      expect(html).toContain('25')      // Due reviews
      expect(html).toContain('150')     // Total reviews
      expect(html).toContain('Start Today\'s Study Session')
      expect(html).toContain(reminderData.studyUrl)
    })

    it('should show fire emoji for active streak', () => {
      const html = dailyReminderHtml(reminderData)
      expect(html).toContain('🔥')
    })

    it('should show muscle emoji for zero streak', () => {
      reminderData.currentStreak = 0
      const html = dailyReminderHtml(reminderData)
      expect(html).toContain('💪')
    })

    it('should include motivational quote', () => {
      const html = dailyReminderHtml(reminderData)
      // Check for at least one of the quotes
      const hasQuote =
        html.includes('七転び八起き') ||
        html.includes('継続は力なり') ||
        html.includes('千里の道も一歩から') ||
        html.includes('習うより慣れよ') ||
        html.includes('為せば成る')
      expect(hasQuote).toBe(true)
    })

    it('should include study tip', () => {
      const html = dailyReminderHtml(reminderData)
      expect(html).toContain('Study Tip:')
    })

    it('should generate text version with same data', () => {
      const text = dailyReminderText(reminderData)

      expect(text).toContain('Test User')
      expect(text).toContain('Current Streak: 7 days')
      expect(text).toContain('Reviews Due: 25')
      expect(text).toContain('Total Reviews: 150')
      expect(text).toContain(reminderData.studyUrl)
    })

    it('should handle missing last study date', () => {
      reminderData.lastStudyDate = undefined
      const html = dailyReminderHtml(reminderData)
      const text = dailyReminderText(reminderData)

      expect(html).not.toContain('Last study session:')
      expect(text).not.toContain('Last Study:')
    })

    it('should show appropriate encouragement based on streak', () => {
      // Test different streak levels
      const testCases = [
        { streak: 0, dueReviews: 10, expected: 'start a new streak' },
        { streak: 3, dueReviews: 5, expected: 'Keep it going' },
        { streak: 14, dueReviews: 0, expected: 'building a strong habit' },
        { streak: 45, dueReviews: 10, expected: 'dedicated learner' },
      ]

      testCases.forEach(({ streak, dueReviews, expected }) => {
        reminderData.currentStreak = streak
        reminderData.dueReviews = dueReviews
        const html = dailyReminderHtml(reminderData)
        expect(html.toLowerCase()).toContain(expected.toLowerCase())
      })
    })
  })

  describe('Achievement Alert Template', () => {
    let achievementData: AchievementAlertData

    beforeEach(() => {
      achievementData = {
        userName: 'Test User',
        achievementName: 'Week Warrior',
        achievementDescription: 'Maintained a 7-day streak',
        achievementIcon: '🔥',
        achievementRarity: 'rare',
        achievementPoints: 50,
        totalPoints: 500,
        totalAchievements: 10,
        percentageComplete: 25,
        profileUrl: 'https://app.test/profile/achievements',
        nextAchievements: [
          {
            name: 'Month Master',
            description: 'Maintain a 30-day streak',
            progress: 23,
          },
        ],
        unsubscribeUrl: 'https://app.test/unsubscribe',
        preferencesUrl: 'https://app.test/preferences',
      }
    })

    it('should generate HTML with achievement details', () => {
      const html = achievementAlertHtml(achievementData)

      expect(html).toContain('Congratulations, Test User!')
      expect(html).toContain('Week Warrior')
      expect(html).toContain('Maintained a 7-day streak')
      expect(html).toContain('🔥')
      expect(html).toContain('+50 points')
      expect(html).toContain('500')  // Total points
      expect(html).toContain('View All Achievements')
    })

    it('should display correct rarity badge', () => {
      const rarities: Array<AchievementAlertData['achievementRarity']> = [
        'common', 'uncommon', 'rare', 'epic', 'legendary'
      ]

      rarities.forEach(rarity => {
        achievementData.achievementRarity = rarity
        const html = achievementAlertHtml(achievementData)
        expect(html).toContain(rarity.charAt(0).toUpperCase() + rarity.slice(1))
      })
    })

    it('should show next achievements if provided', () => {
      const html = achievementAlertHtml(achievementData)

      expect(html).toContain('Next Achievements to Unlock')
      expect(html).toContain('Month Master')
      expect(html).toContain('23% complete')
    })

    it('should handle no next achievements', () => {
      achievementData.nextAchievements = []
      const html = achievementAlertHtml(achievementData)

      expect(html).not.toContain('Next Achievements to Unlock')
    })

    it('should generate text version correctly', () => {
      const text = achievementAlertText(achievementData)

      expect(text).toContain('Congratulations, Test User!')
      expect(text).toContain('Week Warrior')
      expect(text).toContain('Rarity: RARE')
      expect(text).toContain('Points Earned: +50')
      expect(text).toContain('Total Points: 500')
      expect(text).toContain('Month Master (23% complete)')
    })

    it('should include share section', () => {
      const html = achievementAlertHtml(achievementData)
      expect(html).toContain('Share your achievement')
    })
  })

  describe('Weekly Progress Template', () => {
    let weeklyData: WeeklyProgressData

    beforeEach(() => {
      const now = new Date()
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      weeklyData = {
        userName: 'Test User',
        weekStartDate: weekAgo,
        weekEndDate: now,
        stats: {
          totalReviews: 350,
          correctReviews: 280,
          accuracy: 80,
          studyTime: 245, // minutes
          daysStudied: 6,
          currentStreak: 15,
          longestStreak: 30,
        },
        progress: {
          kanjiLearned: 12,
          kanjiMastered: 5,
          vocabularyLearned: 25,
          sentencesCompleted: 10,
        },
        achievements: [
          {
            name: 'Week Warrior',
            icon: '🔥',
            date: new Date(),
          },
        ],
        topPerformingDays: [
          { day: 'Monday', reviews: 75 },
          { day: 'Wednesday', reviews: 60 },
          { day: 'Friday', reviews: 50 },
        ],
        dashboardUrl: 'https://app.test/dashboard',
        unsubscribeUrl: 'https://app.test/unsubscribe',
        preferencesUrl: 'https://app.test/preferences',
      }
    })

    it('should generate HTML with weekly statistics', () => {
      const html = weeklyProgressHtml(weeklyData)

      expect(html).toContain('Your Weekly Progress Report')
      expect(html).toContain('350')  // Total reviews
      expect(html).toContain('280 correct')
      expect(html).toContain('80%')  // Accuracy
      expect(html).toContain('4h 5m')  // Study time
      expect(html).toContain('15 days')  // Current streak
    })

    it('should show performance level based on accuracy', () => {
      const testCases = [
        { accuracy: 95, expected: 'Outstanding Performance' },
        { accuracy: 85, expected: 'Great Job' },
        { accuracy: 75, expected: 'Good Progress' },
        { accuracy: 65, expected: 'Keep Practicing' },
      ]

      testCases.forEach(({ accuracy, expected }) => {
        weeklyData.stats.accuracy = accuracy
        const html = weeklyProgressHtml(weeklyData)
        expect(html).toContain(expected)
      })
    })

    it('should display learning progress', () => {
      const html = weeklyProgressHtml(weeklyData)

      expect(html).toContain('12')  // Kanji learned
      expect(html).toContain('5')   // Kanji mastered
      expect(html).toContain('25')  // Vocabulary
      expect(html).toContain('10')  // Sentences
    })

    it('should show daily activity chart', () => {
      const html = weeklyProgressHtml(weeklyData)

      expect(html).toContain('Daily Activity')
      expect(html).toContain('Monday')
      expect(html).toContain('75')
      expect(html).toContain('Wednesday')
      expect(html).toContain('60')
    })

    it('should list achievements unlocked', () => {
      const html = weeklyProgressHtml(weeklyData)

      expect(html).toContain('Achievements Unlocked This Week')
      expect(html).toContain('Week Warrior')
      expect(html).toContain('🔥')
    })

    it('should suggest goals for next week', () => {
      const html = weeklyProgressHtml(weeklyData)
      expect(html).toContain('Suggested Goals for Next Week')
    })

    it('should handle perfect week (7 days studied)', () => {
      weeklyData.stats.daysStudied = 7
      const html = weeklyProgressHtml(weeklyData)
      expect(html).toContain('Perfect attendance')
    })

    it('should format study time correctly', () => {
      const testCases = [
        { minutes: 45, expected: '45 min' },
        { minutes: 90, expected: '1h 30m' },
        { minutes: 180, expected: '3h 0m' },
      ]

      testCases.forEach(({ minutes, expected }) => {
        weeklyData.stats.studyTime = minutes
        const html = weeklyProgressHtml(weeklyData)
        expect(html).toContain(expected)
      })
    })

    it('should generate text version with all data', () => {
      const text = weeklyProgressText(weeklyData)

      expect(text).toContain('WEEKLY PROGRESS REPORT')
      expect(text).toContain('Total Reviews: 350')
      expect(text).toContain('Accuracy Rate: 80%')
      expect(text).toContain('Study Time: 4h 5m')
      expect(text).toContain('Kanji: 12 (5 mastered)')
      expect(text).toContain('Week Warrior')
    })

    it('should handle no achievements week', () => {
      weeklyData.achievements = []
      const html = weeklyProgressHtml(weeklyData)
      const text = weeklyProgressText(weeklyData)

      expect(html).not.toContain('Achievements Unlocked This Week')
      expect(text).not.toContain('ACHIEVEMENTS UNLOCKED')
    })
  })

  describe('Email Validation', () => {
    it('should escape HTML in user-provided content', () => {
      const maliciousData: DailyReminderData = {
        userName: '<script>alert("XSS")</script>',
        currentStreak: 7,
        totalReviews: 150,
        dueReviews: 25,
        studyUrl: 'https://app.test/review',
        unsubscribeUrl: 'https://app.test/unsubscribe',
        preferencesUrl: 'https://app.test/preferences',
      }

      const html = dailyReminderHtml(maliciousData)
      // The userName should be displayed but the script should not execute
      expect(html).toContain('<script>alert("XSS")</script>')
      // Should not contain unescaped script tags
      expect(html).not.toMatch(/<script[^>]*>.*alert.*<\/script>/i)
    })

    it('should have valid URLs in all templates', () => {
      const baseProps = {
        userName: 'Test User',
        unsubscribeUrl: 'https://app.test/unsubscribe?token=123',
        preferencesUrl: 'https://app.test/preferences',
      }

      const dailyData: DailyReminderData = {
        ...baseProps,
        currentStreak: 7,
        totalReviews: 150,
        dueReviews: 25,
        studyUrl: 'https://app.test/review',
      }

      const html = dailyReminderHtml(dailyData)

      // Check that URLs are properly formatted in href attributes
      expect(html).toMatch(/href="https:\/\/app\.test\/review"/)
      expect(html).toMatch(/href="https:\/\/app\.test\/unsubscribe\?token=123"/)
      expect(html).toMatch(/href="https:\/\/app\.test\/preferences"/)
    })
  })
})

describe('Template Edge Cases', () => {
  it('should handle very long user names', () => {
    const longName = 'A'.repeat(100)
    const data: DailyReminderData = {
      userName: longName,
      currentStreak: 7,
      totalReviews: 150,
      dueReviews: 25,
      studyUrl: 'https://app.test/review',
      unsubscribeUrl: 'https://app.test/unsubscribe',
      preferencesUrl: 'https://app.test/preferences',
    }

    const html = dailyReminderHtml(data)
    expect(html).toContain(longName)
  })

  it('should handle zero values gracefully', () => {
    const data: WeeklyProgressData = {
      userName: 'Test User',
      weekStartDate: new Date(),
      weekEndDate: new Date(),
      stats: {
        totalReviews: 0,
        correctReviews: 0,
        accuracy: 0,
        studyTime: 0,
        daysStudied: 0,
        currentStreak: 0,
        longestStreak: 0,
      },
      progress: {
        kanjiLearned: 0,
        kanjiMastered: 0,
        vocabularyLearned: 0,
        sentencesCompleted: 0,
      },
      achievements: [],
      topPerformingDays: [],
      dashboardUrl: 'https://app.test/dashboard',
      unsubscribeUrl: 'https://app.test/unsubscribe',
      preferencesUrl: 'https://app.test/preferences',
    }

    const html = weeklyProgressHtml(data)
    expect(html).toContain('0')  // Should display zeros, not error
    expect(html).toContain('Keep Practicing')  // Low performance message
  })

  it('should handle very large numbers', () => {
    const data: AchievementAlertData = {
      userName: 'Test User',
      achievementName: 'Ultimate Master',
      achievementDescription: 'Incredible achievement',
      achievementIcon: '🏆',
      achievementRarity: 'legendary',
      achievementPoints: 999999,
      totalPoints: 9999999,
      totalAchievements: 9999,
      percentageComplete: 100,
      profileUrl: 'https://app.test/profile',
      nextAchievements: [],
      unsubscribeUrl: 'https://app.test/unsubscribe',
      preferencesUrl: 'https://app.test/preferences',
    }

    const html = achievementAlertHtml(data)
    expect(html).toContain('999,999')  // Should format large numbers
    expect(html).toContain('9,999,999')
  })
})