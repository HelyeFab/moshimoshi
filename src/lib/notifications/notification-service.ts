/**
 * Notification Service
 * Handles all notification sending logic
 */

import { Resend } from 'resend'
import { doc, setDoc, getDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { adminDb } from '@/lib/firebase/admin'
import {
  dailyReminderHtml,
  dailyReminderText,
  DailyReminderData,
  achievementAlertHtml,
  achievementAlertText,
  AchievementAlertData,
  weeklyProgressHtml,
  weeklyProgressText,
  WeeklyProgressData,
} from './email-templates'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface NotificationLog {
  userId: string
  type: 'daily_reminder' | 'achievement_alert' | 'weekly_progress' | 'marketing'
  channel: 'email' | 'push' | 'in_app'
  sentAt: Date
  status: 'sent' | 'failed' | 'bounced' | 'opened' | 'clicked'
  metadata?: any
  error?: string
}

export interface UserNotificationPreferences {
  dailyReminder: boolean
  achievementAlerts: boolean
  weeklyProgress: boolean
  marketingEmails: boolean
  reminderTime?: string // e.g., "09:00"
  timezone?: string // e.g., "America/New_York"
}

export class NotificationService {
  private static instance: NotificationService

  private constructor() {}

  static getInstance(): NotificationService {
    if (!this.instance) {
      this.instance = new NotificationService()
    }
    return this.instance
  }

  /**
   * Send daily study reminder email
   */
  async sendDailyReminder(userId: string): Promise<boolean> {
    try {
      // Get user data and preferences
      const userData = await this.getUserData(userId)
      if (!userData) {
        console.error(`User not found: ${userId}`)
        return false
      }

      // Check if user has daily reminders enabled
      const preferences = await this.getUserNotificationPreferences(userId)
      if (!preferences.dailyReminder) {
        console.log(`Daily reminders disabled for user: ${userId}`)
        return false
      }

      // Get user's study statistics
      const stats = await this.getUserStudyStats(userId)

      // Prepare email data
      const emailData: DailyReminderData = {
        userName: userData.displayName || 'Learner',
        currentStreak: stats.currentStreak,
        totalReviews: stats.totalReviews,
        dueReviews: stats.dueReviews,
        lastStudyDate: stats.lastStudyDate,
        studyUrl: `${process.env.NEXT_PUBLIC_APP_URL}/review`,
        unsubscribeUrl: this.getUnsubscribeUrl(userId, 'daily_reminder'),
        preferencesUrl: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
      }

      // Send email
      const { data, error } = await resend.emails.send({
        from: 'Moshimoshi <noreply@moshimoshi.app>',
        to: userData.email,
        subject: `${stats.dueReviews > 0 ? `📚 ${stats.dueReviews} reviews waiting` : '🌸 Ready for today\'s Japanese practice?'}`,
        html: dailyReminderHtml(emailData),
        text: dailyReminderText(emailData),
        tags: [
          { name: 'category', value: 'daily_reminder' },
          { name: 'user_id', value: userId },
        ],
      })

      if (error) {
        throw error
      }

      // Log the notification
      await this.logNotification({
        userId,
        type: 'daily_reminder',
        channel: 'email',
        sentAt: new Date(),
        status: 'sent',
        metadata: { emailId: data?.id },
      })

      return true
    } catch (error) {
      console.error(`Failed to send daily reminder to ${userId}:`, error)

      // Log failed notification
      await this.logNotification({
        userId,
        type: 'daily_reminder',
        channel: 'email',
        sentAt: new Date(),
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return false
    }
  }

  /**
   * Send achievement alert email
   */
  async sendAchievementAlert(userId: string, achievementId: string): Promise<boolean> {
    try {
      // Get user data and preferences
      const userData = await this.getUserData(userId)
      if (!userData) {
        console.error(`User not found: ${userId}`)
        return false
      }

      // Check if user has achievement alerts enabled
      const preferences = await this.getUserNotificationPreferences(userId)
      if (!preferences.achievementAlerts) {
        console.log(`Achievement alerts disabled for user: ${userId}`)
        return false
      }

      // Get achievement data
      const achievement = await this.getAchievementData(achievementId)
      if (!achievement) {
        console.error(`Achievement not found: ${achievementId}`)
        return false
      }

      // Get user's achievement stats
      const stats = await this.getUserAchievementStats(userId)

      // Prepare email data
      const emailData: AchievementAlertData = {
        userName: userData.displayName || 'Learner',
        achievementName: achievement.name,
        achievementDescription: achievement.description,
        achievementIcon: achievement.icon,
        achievementRarity: achievement.rarity,
        achievementPoints: achievement.points,
        totalPoints: stats.totalPoints,
        totalAchievements: stats.totalAchievements,
        percentageComplete: stats.percentageComplete,
        profileUrl: `${process.env.NEXT_PUBLIC_APP_URL}/profile/achievements`,
        nextAchievements: stats.nextAchievements,
        unsubscribeUrl: this.getUnsubscribeUrl(userId, 'achievement_alerts'),
        preferencesUrl: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
      }

      // Send email
      const { data, error } = await resend.emails.send({
        from: 'Moshimoshi <noreply@moshimoshi.app>',
        to: userData.email,
        subject: `🏆 Achievement Unlocked: ${achievement.name}!`,
        html: achievementAlertHtml(emailData),
        text: achievementAlertText(emailData),
        tags: [
          { name: 'category', value: 'achievement_alert' },
          { name: 'user_id', value: userId },
          { name: 'achievement_id', value: achievementId },
        ],
      })

      if (error) {
        throw error
      }

      // Log the notification
      await this.logNotification({
        userId,
        type: 'achievement_alert',
        channel: 'email',
        sentAt: new Date(),
        status: 'sent',
        metadata: { emailId: data?.id, achievementId },
      })

      return true
    } catch (error) {
      console.error(`Failed to send achievement alert to ${userId}:`, error)

      await this.logNotification({
        userId,
        type: 'achievement_alert',
        channel: 'email',
        sentAt: new Date(),
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return false
    }
  }

  /**
   * Send weekly progress report email
   */
  async sendWeeklyProgressReport(userId: string): Promise<boolean> {
    try {
      // Get user data and preferences
      const userData = await this.getUserData(userId)
      if (!userData) {
        console.error(`User not found: ${userId}`)
        return false
      }

      // Check if user has weekly progress enabled
      const preferences = await this.getUserNotificationPreferences(userId)
      if (!preferences.weeklyProgress) {
        console.log(`Weekly progress reports disabled for user: ${userId}`)
        return false
      }

      // Calculate week range
      const weekEndDate = new Date()
      const weekStartDate = new Date(weekEndDate.getTime() - 7 * 24 * 60 * 60 * 1000)

      // Get user's weekly statistics
      const weeklyData = await this.getUserWeeklyStats(userId, weekStartDate, weekEndDate)

      // Prepare email data
      const emailData: WeeklyProgressData = {
        userName: userData.displayName || 'Learner',
        weekStartDate,
        weekEndDate,
        stats: weeklyData.stats,
        progress: weeklyData.progress,
        achievements: weeklyData.achievements,
        topPerformingDays: weeklyData.topPerformingDays,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
        unsubscribeUrl: this.getUnsubscribeUrl(userId, 'weekly_progress'),
        preferencesUrl: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
      }

      // Send email
      const { data, error } = await resend.emails.send({
        from: 'Moshimoshi <noreply@moshimoshi.app>',
        to: userData.email,
        subject: `📊 Your Weekly Japanese Learning Report`,
        html: weeklyProgressHtml(emailData),
        text: weeklyProgressText(emailData),
        tags: [
          { name: 'category', value: 'weekly_progress' },
          { name: 'user_id', value: userId },
        ],
      })

      if (error) {
        throw error
      }

      // Log the notification
      await this.logNotification({
        userId,
        type: 'weekly_progress',
        channel: 'email',
        sentAt: new Date(),
        status: 'sent',
        metadata: { emailId: data?.id, weekStartDate, weekEndDate },
      })

      return true
    } catch (error) {
      console.error(`Failed to send weekly progress to ${userId}:`, error)

      await this.logNotification({
        userId,
        type: 'weekly_progress',
        channel: 'email',
        sentAt: new Date(),
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return false
    }
  }

  /**
   * Helper methods for data fetching
   */
  private async getUserData(userId: string): Promise<any> {
    // Use admin SDK for server-side operations
    if (typeof window === 'undefined' && adminDb) {
      const userDoc = await adminDb.collection('users').doc(userId).get()
      return userDoc.exists ? userDoc.data() : null
    }

    // Use client SDK for client-side operations
    if (db) {
      const userDoc = await getDoc(doc(db, 'users', userId))
      return userDoc.exists() ? userDoc.data() : null
    }

    return null
  }

  private async getUserNotificationPreferences(userId: string): Promise<UserNotificationPreferences> {
    // Get from user's preferences document
    const prefsDoc = await this.getDocument('users', userId, 'preferences', 'settings')

    return {
      dailyReminder: prefsDoc?.notifications?.dailyReminder ?? true,
      achievementAlerts: prefsDoc?.notifications?.achievementAlerts ?? true,
      weeklyProgress: prefsDoc?.notifications?.weeklyProgress ?? false,
      marketingEmails: prefsDoc?.notifications?.marketingEmails ?? false,
      reminderTime: prefsDoc?.notifications?.reminderTime ?? '09:00',
      timezone: prefsDoc?.notifications?.timezone,
    }
  }

  private async getUserStudyStats(userId: string): Promise<any> {
    // Get from review statistics collection
    const stats = await this.getDocument('users', userId, 'statistics', 'reviews')

    return {
      currentStreak: stats?.currentStreak || 0,
      totalReviews: stats?.totalReviews || 0,
      dueReviews: stats?.dueReviews || 0,
      lastStudyDate: stats?.lastStudyDate?.toDate() || null,
    }
  }

  private async getUserAchievementStats(userId: string): Promise<any> {
    // Get from achievements collection
    const achievements = await this.getDocument('users', userId, 'achievements', 'summary')

    return {
      totalPoints: achievements?.totalPoints || 0,
      totalAchievements: achievements?.unlockedCount || 0,
      percentageComplete: achievements?.percentageComplete || 0,
      nextAchievements: achievements?.nextAchievements || [],
    }
  }

  private async getUserWeeklyStats(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    // This would query review sessions within the date range
    // For now, returning mock data structure
    return {
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
    }
  }

  private async getAchievementData(achievementId: string): Promise<any> {
    // Get from achievements definition collection
    const achievementDoc = await this.getDocument('achievements', achievementId)
    return achievementDoc
  }

  private async getDocument(...path: string[]): Promise<any> {
    if (typeof window === 'undefined' && adminDb) {
      const docRef = adminDb.doc(path.join('/'))
      const doc = await docRef.get()
      return doc.exists ? doc.data() : null
    }

    if (db) {
      const docRef = doc(db, ...path)
      const docSnap = await getDoc(docRef)
      return docSnap.exists() ? docSnap.data() : null
    }

    return null
  }

  private async logNotification(log: NotificationLog): Promise<void> {
    try {
      const logData = {
        ...log,
        sentAt: Timestamp.fromDate(log.sentAt),
      }

      if (typeof window === 'undefined' && adminDb) {
        await adminDb
          .collection('users')
          .doc(log.userId)
          .collection('notificationLogs')
          .add(logData)
      } else if (db) {
        const logsRef = collection(db, 'users', log.userId, 'notificationLogs')
        await setDoc(doc(logsRef), logData)
      }
    } catch (error) {
      console.error('Failed to log notification:', error)
    }
  }

  private getUnsubscribeUrl(userId: string, notificationType: string): string {
    const token = this.generateUnsubscribeToken(userId, notificationType)
    return `${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/unsubscribe?token=${token}`
  }

  private generateUnsubscribeToken(userId: string, notificationType: string): string {
    // Simple token generation - in production, use a proper JWT or signed token
    return Buffer.from(`${userId}:${notificationType}:${Date.now()}`).toString('base64')
  }
}

export const notificationService = NotificationService.getInstance()