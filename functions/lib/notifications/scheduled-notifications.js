"use strict";
/**
 * Firebase Scheduled Functions for Notifications
 * These replace Vercel cron jobs to avoid plan limitations
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeWatanocNews = exports.weeklyProgressNotification = exports.dailyReminderNotification = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
// Initialize if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
/**
 * Daily Reminder - Runs every day at 12:00 PM UTC
 * Sends daily study reminders to users who have enabled them
 */
exports.dailyReminderNotification = functions
    .pubsub
    .schedule('0 12 * * *')
    .timeZone('UTC')
    .onRun(async (context) => {
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
            var _a, _b, _c, _d, _e;
            const userData = doc.data();
            const userId = doc.id;
            try {
                // Check user's timezone and preferred time
                const userTimezone = ((_a = userData.preferences) === null || _a === void 0 ? void 0 : _a.timezone) || 'UTC';
                const reminderHour = ((_c = (_b = userData.preferences) === null || _b === void 0 ? void 0 : _b.notifications) === null || _c === void 0 ? void 0 : _c.reminderTime) || 9; // Default 9 AM
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
                    userName: userData.displayName || ((_d = userData.email) === null || _d === void 0 ? void 0 : _d.split('@')[0]) || 'Learner',
                    email: userData.email,
                    currentStreak: stats.currentStreak || 0,
                    totalReviews: stats.totalReviews || 0,
                    dueReviews: stats.dueReviews || 0,
                    lastStudyDate: ((_e = stats.lastStudyDate) === null || _e === void 0 ? void 0 : _e.toDate()) || null,
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
                    timestamp: firestore_1.Timestamp.now(),
                    metadata: { streak: stats.currentStreak, dueReviews: stats.dueReviews }
                });
                console.log(`Daily reminder sent to user ${userId}`);
            }
            catch (error) {
                console.error(`Failed to send daily reminder to user ${userId}:`, error);
                // Log the error
                await db.collection('notificationLogs').add({
                    userId,
                    type: 'daily_reminder',
                    status: 'failed',
                    error: error.message,
                    timestamp: firestore_1.Timestamp.now()
                });
            }
        });
        await Promise.allSettled(promises);
        console.log('Daily reminder job completed');
    }
    catch (error) {
        console.error('Daily reminder job failed:', error);
        throw error;
    }
});
/**
 * Weekly Progress Report - Runs every Sunday at 6:00 PM UTC
 * Sends weekly progress summaries to users
 */
exports.weeklyProgressNotification = functions
    .pubsub
    .schedule('0 18 * * 0')
    .timeZone('UTC')
    .onRun(async (context) => {
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
            var _a, _b;
            const userData = doc.data();
            const userId = doc.id;
            try {
                // Check if user has been active in the last 30 days
                const lastActiveDate = (_a = userData.lastActive) === null || _a === void 0 ? void 0 : _a.toDate();
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
                    .where('completedAt', '>=', firestore_1.Timestamp.fromDate(weekAgo))
                    .get();
                // Calculate weekly metrics
                const sessions = sessionsSnapshot.docs.map(doc => doc.data());
                const totalReviews = sessions.reduce((sum, s) => sum + (s.totalItems || 0), 0);
                const correctReviews = sessions.reduce((sum, s) => sum + (s.correctItems || 0), 0);
                const studyTime = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
                const daysStudied = new Set(sessions.map(s => { var _a; return (_a = s.completedAt) === null || _a === void 0 ? void 0 : _a.toDate().toDateString(); })).size;
                // Get achievements unlocked this week
                const achievementsSnapshot = await db
                    .collection('userAchievements')
                    .doc(userId)
                    .collection('achievements')
                    .where('unlockedAt', '>=', firestore_1.Timestamp.fromDate(weekAgo))
                    .get();
                const achievements = achievementsSnapshot.docs.map(doc => {
                    var _a;
                    return (Object.assign(Object.assign({}, doc.data()), { unlockedAt: (_a = doc.data().unlockedAt) === null || _a === void 0 ? void 0 : _a.toDate() }));
                });
                // Prepare notification data
                const notificationData = {
                    userId,
                    userName: userData.displayName || ((_b = userData.email) === null || _b === void 0 ? void 0 : _b.split('@')[0]) || 'Learner',
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
                    timestamp: firestore_1.Timestamp.now(),
                    metadata: {
                        totalReviews,
                        daysStudied,
                        achievements: achievements.length
                    }
                });
                console.log(`Weekly progress sent to user ${userId}`);
            }
            catch (error) {
                console.error(`Failed to send weekly progress to user ${userId}:`, error);
                // Log the error
                await db.collection('notificationLogs').add({
                    userId,
                    type: 'weekly_progress',
                    status: 'failed',
                    error: error.message,
                    timestamp: firestore_1.Timestamp.now()
                });
            }
        });
        await Promise.allSettled(promises);
        console.log('Weekly progress job completed');
    }
    catch (error) {
        console.error('Weekly progress job failed:', error);
        throw error;
    }
});
/**
 * News Scraping - Watanoc (Daily at 2:00 PM UTC)
 * Moved from Vercel to Firebase due to cron limitations
 */
exports.scrapeWatanocNews = functions
    .pubsub
    .schedule('0 14 * * *')
    .timeZone('UTC')
    .onRun(async (context) => {
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
    }
    catch (error) {
        console.error('Watanoc news scraping failed:', error);
        throw error;
    }
});
//# sourceMappingURL=scheduled-notifications.js.map