/**
 * Achievement alert email template
 */

import { baseEmailTemplate, baseTextTemplate, EmailTemplateProps } from './base-template'

export interface AchievementAlertData extends EmailTemplateProps {
  achievementName: string
  achievementDescription: string
  achievementIcon: string
  achievementRarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  achievementPoints: number
  totalPoints: number
  totalAchievements: number
  percentageComplete: number
  profileUrl: string
  nextAchievements?: Array<{
    name: string
    description: string
    progress: number
  }>
}

export const achievementAlertHtml = (data: AchievementAlertData) => {
  const rarityColors = {
    common: '#6b7280',
    uncommon: '#10b981',
    rare: '#3b82f6',
    epic: '#8b5cf6',
    legendary: '#f59e0b',
  }

  const rarityLabels = {
    common: 'Common',
    uncommon: 'Uncommon',
    rare: 'Rare',
    epic: 'Epic',
    legendary: 'Legendary',
  }

  const content = `
    <!-- Celebration Header -->
    <div style="text-align: center; margin-bottom: 30px;">
      <h2 style="color: #1f2937; font-size: 28px; margin: 0 0 10px 0;">
        🎉 Congratulations, ${data.userName}! 🎉
      </h2>
      <p style="color: #6b7280; font-size: 16px; margin: 0;">
        You've unlocked a new achievement!
      </p>
    </div>

    <!-- Achievement Card -->
    <div style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px; position: relative; overflow: hidden;">
      <!-- Rarity Badge -->
      <div style="position: absolute; top: 10px; right: 10px; background-color: ${rarityColors[data.achievementRarity]}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">
        ${rarityLabels[data.achievementRarity]}
      </div>

      <!-- Achievement Icon -->
      <div style="font-size: 64px; margin-bottom: 15px;">
        ${data.achievementIcon}
      </div>

      <!-- Achievement Name -->
      <h3 style="color: #111827; font-size: 24px; margin: 0 0 10px 0; font-weight: bold;">
        ${data.achievementName}
      </h3>

      <!-- Achievement Description -->
      <p style="color: #4b5563; font-size: 14px; margin: 0 0 20px 0;">
        ${data.achievementDescription}
      </p>

      <!-- Points Earned -->
      <div style="display: inline-block; background-color: white; padding: 10px 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <span style="color: #f59e0b; font-size: 20px; font-weight: bold;">
          +${data.achievementPoints} points
        </span>
      </div>
    </div>

    <!-- Progress Stats -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
      <tr>
        <td width="30%" style="text-align: center; padding: 15px;">
          <p style="color: #6b7280; font-size: 12px; margin: 0 0 5px 0;">Total Points</p>
          <p style="color: #1f2937; font-size: 20px; margin: 0; font-weight: bold;">
            ${data.totalPoints.toLocaleString()}
          </p>
        </td>
        <td width="40%" style="text-align: center; padding: 15px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px; margin: 0 0 5px 0;">Achievements</p>
          <p style="color: #1f2937; font-size: 20px; margin: 0; font-weight: bold;">
            ${data.totalAchievements}
          </p>
        </td>
        <td width="30%" style="text-align: center; padding: 15px;">
          <p style="color: #6b7280; font-size: 12px; margin: 0 0 5px 0;">Completion</p>
          <p style="color: #1f2937; font-size: 20px; margin: 0; font-weight: bold;">
            ${data.percentageComplete}%
          </p>
        </td>
      </tr>
    </table>

    <!-- Next Achievements -->
    ${data.nextAchievements && data.nextAchievements.length > 0 ? `
      <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
        <h4 style="color: #374151; font-size: 16px; margin: 0 0 15px 0;">
          🎯 Next Achievements to Unlock
        </h4>
        ${data.nextAchievements.map(achievement => `
          <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #e5e7eb;">
            <p style="color: #1f2937; font-size: 14px; margin: 0 0 5px 0; font-weight: 600;">
              ${achievement.name}
            </p>
            <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px 0;">
              ${achievement.description}
            </p>
            <!-- Progress Bar -->
            <div style="background-color: #e5e7eb; height: 8px; border-radius: 4px; overflow: hidden;">
              <div style="background: linear-gradient(90deg, #8b5cf6 0%, #ec4899 100%); height: 100%; width: ${achievement.progress}%; transition: width 0.3s;"></div>
            </div>
            <p style="color: #9ca3af; font-size: 11px; margin: 5px 0 0 0;">
              ${achievement.progress}% complete
            </p>
          </div>
        `).join('')}
      </div>
    ` : ''}

    <!-- CTA Button -->
    <div style="text-align: center; margin: 40px 0;">
      <a href="${data.profileUrl}"
         style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); color: #ffffff; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(139, 92, 246, 0.25);">
        View All Achievements 🏆
      </a>
    </div>

    <!-- Share Section -->
    <div style="text-align: center; padding: 20px; background-color: #fef3c7; border-radius: 8px;">
      <p style="color: #92400e; font-size: 14px; margin: 0;">
        🌟 Share your achievement with friends and inspire them to learn Japanese too!
      </p>
    </div>
  `

  return baseEmailTemplate(content, data)
}

export const achievementAlertText = (data: AchievementAlertData) => {
  const content = `
🎉 Congratulations, ${data.userName}!

You've unlocked: ${data.achievementName}
${data.achievementDescription}

Rarity: ${data.achievementRarity.toUpperCase()}
Points Earned: +${data.achievementPoints}

YOUR PROGRESS:
- Total Points: ${data.totalPoints.toLocaleString()}
- Total Achievements: ${data.totalAchievements}
- Completion: ${data.percentageComplete}%

${data.nextAchievements && data.nextAchievements.length > 0 ? `
NEXT ACHIEVEMENTS:
${data.nextAchievements.map(a => `- ${a.name} (${a.progress}% complete)`).join('\n')}
` : ''}

View all achievements: ${data.profileUrl}
  `

  return baseTextTemplate(content, data)
}