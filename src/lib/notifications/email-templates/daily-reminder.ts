/**
 * Daily study reminder email template
 */

import { baseEmailTemplate, baseTextTemplate, EmailTemplateProps } from './base-template'

export interface DailyReminderData extends EmailTemplateProps {
  currentStreak: number
  totalReviews: number
  dueReviews: number
  lastStudyDate?: Date
  studyUrl: string
}

export const dailyReminderHtml = (data: DailyReminderData) => {
  const streakEmoji = data.currentStreak > 0 ? '🔥' : '💪'
  const encouragement = getEncouragementMessage(data.currentStreak, data.dueReviews)

  const content = `
    <div style="text-align: center; margin-bottom: 30px;">
      <h2 style="color: #1f2937; font-size: 24px; margin: 0 0 10px 0;">
        Hello ${data.userName}! 👋
      </h2>
      <p style="color: #6b7280; font-size: 16px; margin: 0;">
        ${encouragement}
      </p>
    </div>

    <!-- Stats Cards -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
      <tr>
        <td width="48%" style="background: linear-gradient(135deg, #fce7f3 0%, #f9a8d4 100%); padding: 20px; border-radius: 8px; text-align: center;">
          <p style="color: #831843; font-size: 14px; margin: 0 0 5px 0; font-weight: 600;">
            Current Streak
          </p>
          <p style="color: #be185d; font-size: 32px; margin: 0; font-weight: bold;">
            ${streakEmoji} ${data.currentStreak} days
          </p>
        </td>
        <td width="4%"></td>
        <td width="48%" style="background: linear-gradient(135deg, #ede9fe 0%, #c4b5fd 100%); padding: 20px; border-radius: 8px; text-align: center;">
          <p style="color: #581c87; font-size: 14px; margin: 0 0 5px 0; font-weight: 600;">
            Reviews Due
          </p>
          <p style="color: #7c3aed; font-size: 32px; margin: 0; font-weight: bold;">
            📚 ${data.dueReviews}
          </p>
        </td>
      </tr>
    </table>

    <!-- Progress Summary -->
    <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
      <h3 style="color: #374151; font-size: 18px; margin: 0 0 15px 0;">
        Your Learning Journey 🌸
      </h3>
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">
        Total reviews completed: <strong>${data.totalReviews}</strong>
      </p>
      ${data.lastStudyDate ? `
        <p style="color: #6b7280; font-size: 14px; margin: 0;">
          Last study session: <strong>${formatRelativeTime(data.lastStudyDate)}</strong>
        </p>
      ` : ''}
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 40px 0;">
      <a href="${data.studyUrl}"
         style="display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); color: #ffffff; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(139, 92, 246, 0.25);">
        Start Today's Study Session 📖
      </a>
    </div>

    <!-- Motivational Quote -->
    <div style="border-left: 4px solid #ec4899; padding-left: 20px; margin: 30px 0;">
      <p style="color: #6b7280; font-style: italic; font-size: 14px; margin: 0;">
        "${getMotivationalQuote()}"
      </p>
    </div>

    <!-- Tips Section -->
    <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 30px;">
      <p style="color: #92400e; font-size: 14px; margin: 0;">
        💡 <strong>Study Tip:</strong> ${getStudyTip()}
      </p>
    </div>
  `

  return baseEmailTemplate(content, data)
}

export const dailyReminderText = (data: DailyReminderData) => {
  const encouragement = getEncouragementMessage(data.currentStreak, data.dueReviews)

  const content = `
Hello ${data.userName}!

${encouragement}

YOUR STATS:
- Current Streak: ${data.currentStreak} days
- Reviews Due: ${data.dueReviews}
- Total Reviews: ${data.totalReviews}
${data.lastStudyDate ? `- Last Study: ${formatRelativeTime(data.lastStudyDate)}` : ''}

Start Today's Study Session: ${data.studyUrl}

"${getMotivationalQuote()}"

Study Tip: ${getStudyTip()}
  `

  return baseTextTemplate(content, data)
}

// Helper functions
function getEncouragementMessage(streak: number, dueReviews: number): string {
  if (streak === 0 && dueReviews > 0) {
    return "It's time to start a new streak! Your reviews are waiting for you."
  }
  if (streak > 0 && streak < 7) {
    return `Great job on your ${streak}-day streak! Keep it going!`
  }
  if (streak >= 7 && streak < 30) {
    return `Amazing ${streak}-day streak! You're building a strong habit!`
  }
  if (streak >= 30) {
    return `Incredible ${streak}-day streak! You're a dedicated learner!`
  }
  if (dueReviews === 0) {
    return "All caught up! Consider learning something new today."
  }
  return "Ready for another day of learning?"
}

function getMotivationalQuote(): string {
  const quotes = [
    "七転び八起き (Fall down seven times, stand up eight)",
    "継続は力なり (Continuity is power)",
    "千里の道も一歩から (A journey of a thousand miles begins with a single step)",
    "習うより慣れよ (Practice makes perfect)",
    "為せば成る (Where there's a will, there's a way)",
  ]
  return quotes[Math.floor(Math.random() * quotes.length)]
}

function getStudyTip(): string {
  const tips = [
    "Review items just before you forget them for optimal retention",
    "Focus on understanding context rather than memorizing translations",
    "Practice writing kanji by hand to improve recognition",
    "Use new vocabulary in sentences to strengthen memory",
    "Take short breaks every 25 minutes to maintain focus",
    "Review difficult items more frequently throughout the day",
    "Connect new kanji to ones you already know through radicals",
  ]
  return tips[Math.floor(Math.random() * tips.length)]
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))

  if (hours < 1) return 'Less than an hour ago'
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`

  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`

  return date.toLocaleDateString()
}