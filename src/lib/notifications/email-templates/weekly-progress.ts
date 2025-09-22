/**
 * Weekly progress report email template
 */

import { baseEmailTemplate, baseTextTemplate, EmailTemplateProps } from './base-template'

export interface WeeklyProgressData extends EmailTemplateProps {
  weekStartDate: Date
  weekEndDate: Date
  stats: {
    totalReviews: number
    correctReviews: number
    accuracy: number
    studyTime: number // in minutes
    daysStudied: number
    currentStreak: number
    longestStreak: number
  }
  progress: {
    kanjiLearned: number
    kanjiMastered: number
    vocabularyLearned: number
    sentencesCompleted: number
  }
  achievements: Array<{
    name: string
    icon: string
    date: Date
  }>
  topPerformingDays: Array<{
    day: string
    reviews: number
  }>
  dashboardUrl: string
}

export const weeklyProgressHtml = (data: WeeklyProgressData) => {
  const performanceLevel = getPerformanceLevel(data.stats.accuracy)
  const weekSummary = getWeekSummary(data.stats)

  const content = `
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 30px;">
      <h2 style="color: #1f2937; font-size: 28px; margin: 0 0 10px 0;">
        📊 Your Weekly Progress Report
      </h2>
      <p style="color: #6b7280; font-size: 14px; margin: 0;">
        ${formatDateRange(data.weekStartDate, data.weekEndDate)}
      </p>
    </div>

    <!-- Week Summary Banner -->
    <div style="background: ${performanceLevel.gradient}; padding: 25px; border-radius: 12px; text-align: center; margin-bottom: 30px; color: white;">
      <div style="font-size: 48px; margin-bottom: 10px;">
        ${performanceLevel.emoji}
      </div>
      <h3 style="font-size: 20px; margin: 0 0 5px 0;">
        ${performanceLevel.message}
      </h3>
      <p style="font-size: 14px; margin: 0; opacity: 0.9;">
        ${weekSummary}
      </p>
    </div>

    <!-- Key Stats Grid -->
    <div style="margin-bottom: 30px;">
      <h4 style="color: #374151; font-size: 18px; margin: 0 0 15px 0;">
        📈 This Week's Statistics
      </h4>

      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: separate; border-spacing: 10px;">
        <tr>
          <td width="48%" style="background-color: #f3f4f6; padding: 15px; border-radius: 8px;">
            <p style="color: #6b7280; font-size: 12px; margin: 0 0 5px 0;">Total Reviews</p>
            <p style="color: #1f2937; font-size: 24px; margin: 0; font-weight: bold;">
              ${data.stats.totalReviews}
            </p>
            <p style="color: #10b981; font-size: 11px; margin: 5px 0 0 0;">
              ${data.stats.correctReviews} correct
            </p>
          </td>
          <td width="48%" style="background-color: #f3f4f6; padding: 15px; border-radius: 8px;">
            <p style="color: #6b7280; font-size: 12px; margin: 0 0 5px 0;">Accuracy Rate</p>
            <p style="color: #1f2937; font-size: 24px; margin: 0; font-weight: bold;">
              ${data.stats.accuracy}%
            </p>
            <p style="color: ${data.stats.accuracy >= 80 ? '#10b981' : '#f59e0b'}; font-size: 11px; margin: 5px 0 0 0;">
              ${data.stats.accuracy >= 80 ? 'Excellent!' : 'Keep practicing!'}
            </p>
          </td>
        </tr>
        <tr>
          <td width="48%" style="background-color: #f3f4f6; padding: 15px; border-radius: 8px;">
            <p style="color: #6b7280; font-size: 12px; margin: 0 0 5px 0;">Study Time</p>
            <p style="color: #1f2937; font-size: 24px; margin: 0; font-weight: bold;">
              ${formatStudyTime(data.stats.studyTime)}
            </p>
            <p style="color: #6b7280; font-size: 11px; margin: 5px 0 0 0;">
              ${Math.round(data.stats.studyTime / data.stats.daysStudied)} min/day avg
            </p>
          </td>
          <td width="48%" style="background-color: #f3f4f6; padding: 15px; border-radius: 8px;">
            <p style="color: #6b7280; font-size: 12px; margin: 0 0 5px 0;">Study Streak</p>
            <p style="color: #1f2937; font-size: 24px; margin: 0; font-weight: bold;">
              🔥 ${data.stats.currentStreak} days
            </p>
            <p style="color: #6b7280; font-size: 11px; margin: 5px 0 0 0;">
              Best: ${data.stats.longestStreak} days
            </p>
          </td>
        </tr>
      </table>
    </div>

    <!-- Learning Progress -->
    <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
      <h4 style="color: #92400e; font-size: 16px; margin: 0 0 15px 0;">
        🌱 New Items Learned
      </h4>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="25%" style="text-align: center;">
            <p style="color: #92400e; font-size: 20px; margin: 0; font-weight: bold;">
              ${data.progress.kanjiLearned}
            </p>
            <p style="color: #b45309; font-size: 12px; margin: 5px 0 0 0;">Kanji</p>
          </td>
          <td width="25%" style="text-align: center;">
            <p style="color: #92400e; font-size: 20px; margin: 0; font-weight: bold;">
              ${data.progress.kanjiMastered}
            </p>
            <p style="color: #b45309; font-size: 12px; margin: 5px 0 0 0;">Mastered</p>
          </td>
          <td width="25%" style="text-align: center;">
            <p style="color: #92400e; font-size: 20px; margin: 0; font-weight: bold;">
              ${data.progress.vocabularyLearned}
            </p>
            <p style="color: #b45309; font-size: 12px; margin: 5px 0 0 0;">Vocabulary</p>
          </td>
          <td width="25%" style="text-align: center;">
            <p style="color: #92400e; font-size: 20px; margin: 0; font-weight: bold;">
              ${data.progress.sentencesCompleted}
            </p>
            <p style="color: #b45309; font-size: 12px; margin: 5px 0 0 0;">Sentences</p>
          </td>
        </tr>
      </table>
    </div>

    <!-- Activity Chart -->
    ${data.topPerformingDays.length > 0 ? `
      <div style="margin-bottom: 30px;">
        <h4 style="color: #374151; font-size: 16px; margin: 0 0 15px 0;">
          📅 Daily Activity
        </h4>
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px;">
          ${data.topPerformingDays.map(day => `
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
              <span style="color: #6b7280; font-size: 14px; width: 80px;">
                ${day.day}
              </span>
              <div style="flex: 1; background-color: #e5e7eb; height: 20px; border-radius: 10px; margin: 0 10px; position: relative;">
                <div style="background: linear-gradient(90deg, #8b5cf6 0%, #ec4899 100%); height: 100%; width: ${(day.reviews / Math.max(...data.topPerformingDays.map(d => d.reviews))) * 100}%; border-radius: 10px;"></div>
              </div>
              <span style="color: #1f2937; font-size: 14px; font-weight: 600;">
                ${day.reviews}
              </span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <!-- Achievements This Week -->
    ${data.achievements.length > 0 ? `
      <div style="margin-bottom: 30px;">
        <h4 style="color: #374151; font-size: 16px; margin: 0 0 15px 0;">
          🏆 Achievements Unlocked This Week
        </h4>
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px;">
          ${data.achievements.map(achievement => `
            <div style="display: flex; align-items: center; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #e5e7eb;">
              <span style="font-size: 24px; margin-right: 10px;">
                ${achievement.icon}
              </span>
              <div style="flex: 1;">
                <p style="color: #1f2937; font-size: 14px; margin: 0; font-weight: 600;">
                  ${achievement.name}
                </p>
                <p style="color: #9ca3af; font-size: 12px; margin: 2px 0 0 0;">
                  ${achievement.date.toLocaleDateString()}
                </p>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <!-- Next Week Goals -->
    <div style="background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%); padding: 20px; border-radius: 8px; margin-bottom: 30px;">
      <h4 style="color: #5b21b6; font-size: 16px; margin: 0 0 10px 0;">
        🎯 Suggested Goals for Next Week
      </h4>
      ${generateWeeklyGoals(data)}
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 40px 0;">
      <a href="${data.dashboardUrl}"
         style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); color: #ffffff; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(139, 92, 246, 0.25);">
        View Full Dashboard 📊
      </a>
    </div>
  `

  return baseEmailTemplate(content, data)
}

export const weeklyProgressText = (data: WeeklyProgressData) => {
  const content = `
WEEKLY PROGRESS REPORT
${formatDateRange(data.weekStartDate, data.weekEndDate)}

THIS WEEK'S STATISTICS:
- Total Reviews: ${data.stats.totalReviews} (${data.stats.correctReviews} correct)
- Accuracy Rate: ${data.stats.accuracy}%
- Study Time: ${formatStudyTime(data.stats.studyTime)}
- Days Studied: ${data.stats.daysStudied}/7
- Current Streak: ${data.stats.currentStreak} days
- Longest Streak: ${data.stats.longestStreak} days

ITEMS LEARNED:
- Kanji: ${data.progress.kanjiLearned} (${data.progress.kanjiMastered} mastered)
- Vocabulary: ${data.progress.vocabularyLearned}
- Sentences: ${data.progress.sentencesCompleted}

${data.achievements.length > 0 ? `ACHIEVEMENTS UNLOCKED:
${data.achievements.map(a => `- ${a.icon} ${a.name}`).join('\n')}
` : ''}

View full dashboard: ${data.dashboardUrl}
  `

  return baseTextTemplate(content, data)
}

// Helper functions
function getPerformanceLevel(accuracy: number) {
  if (accuracy >= 90) {
    return {
      emoji: '🌟',
      message: 'Outstanding Performance!',
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    }
  }
  if (accuracy >= 80) {
    return {
      emoji: '🎯',
      message: 'Great Job This Week!',
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    }
  }
  if (accuracy >= 70) {
    return {
      emoji: '💪',
      message: 'Good Progress!',
      gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    }
  }
  return {
    emoji: '📚',
    message: 'Keep Practicing!',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  }
}

function getWeekSummary(stats: WeeklyProgressData['stats']): string {
  if (stats.daysStudied === 7) {
    return `Perfect attendance! You studied every day this week.`
  }
  if (stats.daysStudied >= 5) {
    return `You studied ${stats.daysStudied} out of 7 days. Great consistency!`
  }
  if (stats.daysStudied >= 3) {
    return `You studied ${stats.daysStudied} days this week. Keep building that habit!`
  }
  return `You studied ${stats.daysStudied} day${stats.daysStudied === 1 ? '' : 's'} this week. Every day counts!`
}

function formatDateRange(start: Date, end: Date): string {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}, ${end.getFullYear()}`
}

function formatStudyTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m`
}

function generateWeeklyGoals(data: WeeklyProgressData): string {
  const goals = []

  if (data.stats.accuracy < 80) {
    goals.push('• Focus on accuracy: Review difficult items more frequently')
  }
  if (data.stats.daysStudied < 7) {
    goals.push(`• Study all 7 days (you missed ${7 - data.stats.daysStudied} days last week)`)
  }
  if (data.stats.totalReviews < 100) {
    goals.push('• Aim for at least 100 reviews to maintain progress')
  }
  if (data.progress.kanjiLearned < 5) {
    goals.push('• Learn at least 5 new kanji characters')
  }

  if (goals.length === 0) {
    goals.push('• Maintain your excellent performance!')
    goals.push('• Challenge yourself with harder content')
  }

  return `<ul style="color: #5b21b6; font-size: 14px; margin: 0; padding-left: 20px;">${goals.map(g => `<li style="margin-bottom: 5px;">${g}</li>`).join('')}</ul>`
}