/**
 * Firebase Scheduled Functions for Notifications
 * These replace Vercel cron jobs to avoid plan limitations
 */

import { onSchedule, ScheduledEvent } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

// Initialize if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Daily Reminder - Runs every day at 12:00 PM UTC
 * Sends daily study reminders to users who have enabled them
 */
export const dailyReminderNotification = onSchedule(
  {
    schedule: '0 12 * * *',
    timeZone: 'UTC',
    region: 'europe-west1'
  },
  async (event: ScheduledEvent) => {
    console.log('Running daily reminder notification job');

    try {
      // Get users with daily reminders enabled
      const usersSnapshot = await db
        .collection('users')
        .where('preferences.notifications.dailyReminders', '==', true)
        .where('preferences.notifications.email', '==', true)
        .get();

      console.log(`Found ${usersSnapshot.size} users with daily reminders enabled`);

      // Process each user
      const promises = usersSnapshot.docs.map(async (doc) => {
        const userData = doc.data();
        const userId = doc.id;

        try {
          // Check user's timezone and preferred time
          const userTimezone = userData.preferences?.timezone || 'UTC';
          const reminderHour = userData.preferences?.notifications?.reminderTime || 9; // Default 9 AM

          // Calculate if it's the right time for this user
          const now = new Date();
          const userTime = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));

          if (userTime.getHours() !== reminderHour) {
            // Not the right time for this user
            return;
          }

          // Get user's learning stats
          const statsDoc = await db.collection('userStats').doc(userId).get();
          const stats = statsDoc.data() || {};

          // Prepare notification data
          const notificationData = {
            userId,
            userName: userData.displayName || userData.email?.split('@')[0] || 'Learner',
            email: userData.email,
            currentStreak: stats.currentStreak || 0,
            totalReviews: stats.totalReviews || 0,
            dueReviews: stats.dueReviews || 0,
            lastStudyDate: stats.lastStudyDate?.toDate() || null,
            studyUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.app'}/review`,
            unsubscribeUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.app'}/api/notifications/unsubscribe?token=${Buffer.from(userId).toString('base64')}`,
            preferencesUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.app'}/settings`
          };

          // Call your notification API
          const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.app'}/api/notifications/send-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.CRON_SECRET}`
            },
            body: JSON.stringify({
              type: 'dailyReminder',
              data: notificationData
            })
          });

          if (!response.ok) {
            throw new Error(`Failed to send notification: ${response.statusText}`);
          }

          // Log the notification
          await db.collection('notificationLogs').add({
            userId,
            type: 'daily_reminder',
            status: 'sent',
            timestamp: Timestamp.now(),
            metadata: { streak: stats.currentStreak, dueReviews: stats.dueReviews }
          });

          console.log(`Daily reminder sent to user ${userId}`);
        } catch (error) {
          console.error(`Failed to send daily reminder to user ${userId}:`, error);

          // Log the error
          await db.collection('notificationLogs').add({
            userId,
            type: 'daily_reminder',
            status: 'failed',
            error: error.message,
            timestamp: Timestamp.now()
          });
        }
      });

      await Promise.allSettled(promises);
      console.log('Daily reminder job completed');

    } catch (error) {
      console.error('Daily reminder job failed:', error);
      throw error;
    }
  });

/**
 * Weekly Progress Report - Runs every Sunday at 6:00 PM UTC
 * Sends weekly progress summaries to users
 */
export const weeklyProgressNotification = onSchedule(
  {
    schedule: '0 18 * * 0',
    timeZone: 'UTC',
    region: 'europe-west1'
  },
  async (event: ScheduledEvent) => {
    console.log('Running weekly progress notification job');

    try {
      // Get users with weekly summaries enabled
      const usersSnapshot = await db
        .collection('users')
        .where('preferences.notifications.weeklySummary', '==', true)
        .where('preferences.notifications.email', '==', true)
        .get();

      console.log(`Found ${usersSnapshot.size} users with weekly summaries enabled`);

      // Process each user
      const promises = usersSnapshot.docs.map(async (doc) => {
        const userData = doc.data();
        const userId = doc.id;

        try {
          // Check if user has been active in the last 30 days
          const lastActiveDate = userData.lastActive?.toDate();
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

          if (lastActiveDate && lastActiveDate < thirtyDaysAgo) {
            console.log(`User ${userId} inactive for 30+ days, skipping`);
            return;
          }

          // Get weekly stats
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          const statsDoc = await db.collection('userStats').doc(userId).get();
          const stats = statsDoc.data() || {};

          // Get review sessions from the past week
          const sessionsSnapshot = await db
            .collection('reviewSessions')
            .where('userId', '==', userId)
            .where('completedAt', '>=', Timestamp.fromDate(weekAgo))
            .get();

          // Calculate weekly metrics
          const sessions = sessionsSnapshot.docs.map(doc => doc.data());
          const totalReviews = sessions.reduce((sum, s) => sum + (s.totalItems || 0), 0);
          const correctReviews = sessions.reduce((sum, s) => sum + (s.correctItems || 0), 0);
          const studyTime = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
          const daysStudied = new Set(sessions.map(s =>
            s.completedAt?.toDate().toDateString()
          )).size;

          // Get achievements unlocked this week
          const achievementsSnapshot = await db
            .collection('userAchievements')
            .doc(userId)
            .collection('achievements')
            .where('unlockedAt', '>=', Timestamp.fromDate(weekAgo))
            .get();

          const achievements = achievementsSnapshot.docs.map(doc => ({
            ...doc.data(),
            unlockedAt: doc.data().unlockedAt?.toDate()
          }));

          // Prepare notification data
          const notificationData = {
            userId,
            userName: userData.displayName || userData.email?.split('@')[0] || 'Learner',
            email: userData.email,
            weekStartDate: weekAgo,
            weekEndDate: new Date(),
            stats: {
              totalReviews,
              correctReviews,
              accuracy: totalReviews > 0 ? Math.round((correctReviews / totalReviews) * 100) : 0,
              studyTime: Math.round(studyTime / 60), // Convert to minutes
              daysStudied,
              currentStreak: stats.currentStreak || 0,
              longestStreak: stats.longestStreak || 0
            },
            progress: {
              kanjiLearned: stats.weeklyKanjiLearned || 0,
              kanjiMastered: stats.weeklyKanjiMastered || 0,
              vocabularyLearned: stats.weeklyVocabularyLearned || 0,
              sentencesCompleted: stats.weeklySentencesCompleted || 0
            },
            achievements: achievements.slice(0, 3), // Top 3 achievements
            dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.app'}/dashboard`,
            unsubscribeUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.app'}/api/notifications/unsubscribe?token=${Buffer.from(userId).toString('base64')}`,
            preferencesUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.app'}/settings`
          };

          // Call your notification API
          const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.app'}/api/notifications/send-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.CRON_SECRET}`
            },
            body: JSON.stringify({
              type: 'weeklyProgress',
              data: notificationData
            })
          });

          if (!response.ok) {
            throw new Error(`Failed to send notification: ${response.statusText}`);
          }

          // Log the notification
          await db.collection('notificationLogs').add({
            userId,
            type: 'weekly_progress',
            status: 'sent',
            timestamp: Timestamp.now(),
            metadata: {
              totalReviews,
              daysStudied,
              achievements: achievements.length
            }
          });

          console.log(`Weekly progress sent to user ${userId}`);
        } catch (error) {
          console.error(`Failed to send weekly progress to user ${userId}:`, error);

          // Log the error
          await db.collection('notificationLogs').add({
            userId,
            type: 'weekly_progress',
            status: 'failed',
            error: error.message,
            timestamp: Timestamp.now()
          });
        }
      });

      await Promise.allSettled(promises);
      console.log('Weekly progress job completed');

    } catch (error) {
      console.error('Weekly progress job failed:', error);
      throw error;
    }
  });

/**
 * News Scraping - Watanoc (Daily at 2:00 PM UTC)
 * Moved from Vercel to Firebase due to cron limitations
 */
export const scrapeWatanocNews = onSchedule(
  {
    schedule: '0 14 * * *',
    timeZone: 'UTC',
    region: 'europe-west1'
  },
  async (event: ScheduledEvent) => {
    console.log('Running Watanoc news scraping job');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.app'}/api/news/scrape?source=watanoc`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.CRON_SECRET}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to scrape Watanoc news: ${response.statusText}`);
      }

      console.log('Watanoc news scraping completed');
    } catch (error) {
      console.error('Watanoc news scraping failed:', error);
      throw error;
    }
  });