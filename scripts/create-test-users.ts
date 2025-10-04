#!/usr/bin/env node

/**
 * Create Test Users Script
 * Creates 10 test users in Firebase with varying premium status and score rankings
 * for testing leaderboard and premium features
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../moshimoshi-service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

const auth = getAuth();
const db = getFirestore();

// Test user configurations
const testUsers = [
  // Premium Users
  {
    index: 1,
    email: 'testuser1@test.com',
    displayName: 'testuser1',
    password: 'TestPass123!',
    tier: 'premium' as const,
    plan: 'premium_yearly' as const,
    xp: 5200,
    level: 25,
    currentStreak: 45,
    bestStreak: 45,
    achievementCount: 8,
    totalSessions: 120,
    totalPoints: 890,
  },
  {
    index: 2,
    email: 'testuser2@test.com',
    displayName: 'testuser2',
    password: 'TestPass123!',
    tier: 'premium' as const,
    plan: 'premium_monthly' as const,
    xp: 3800,
    level: 19,
    currentStreak: 30,
    bestStreak: 35,
    achievementCount: 6,
    totalSessions: 95,
    totalPoints: 640,
  },
  {
    index: 3,
    email: 'testuser3@test.com',
    displayName: 'testuser3',
    password: 'TestPass123!',
    tier: 'premium' as const,
    plan: 'premium_yearly' as const,
    xp: 2400,
    level: 14,
    currentStreak: 15,
    bestStreak: 20,
    achievementCount: 5,
    totalSessions: 65,
    totalPoints: 425,
  },
  {
    index: 4,
    email: 'testuser4@test.com',
    displayName: 'testuser4',
    password: 'TestPass123!',
    tier: 'premium' as const,
    plan: 'premium_monthly' as const,
    xp: 1500,
    level: 10,
    currentStreak: 8,
    bestStreak: 12,
    achievementCount: 4,
    totalSessions: 45,
    totalPoints: 280,
  },
  {
    index: 5,
    email: 'testuser5@test.com',
    displayName: 'testuser5',
    password: 'TestPass123!',
    tier: 'premium' as const,
    plan: 'premium_yearly' as const,
    xp: 1200,
    level: 8,
    currentStreak: 12,
    bestStreak: 12,
    achievementCount: 3,
    totalSessions: 38,
    totalPoints: 215,
  },
  {
    index: 6,
    email: 'testuser6@test.com',
    displayName: 'testuser6',
    password: 'TestPass123!',
    tier: 'premium' as const,
    plan: 'premium_monthly' as const,
    xp: 600,
    level: 5,
    currentStreak: 3,
    bestStreak: 5,
    achievementCount: 2,
    totalSessions: 22,
    totalPoints: 125,
  },
  // Free Users
  {
    index: 7,
    email: 'testuser7@test.com',
    displayName: 'testuser7',
    password: 'TestPass123!',
    tier: 'free' as const,
    plan: 'free' as const,
    xp: 400,
    level: 3,
    currentStreak: 2,
    bestStreak: 4,
    achievementCount: 1,
    totalSessions: 15,
    totalPoints: 85,
  },
  {
    index: 8,
    email: 'testuser8@test.com',
    displayName: 'testuser8',
    password: 'TestPass123!',
    tier: 'free' as const,
    plan: 'free' as const,
    xp: 150,
    level: 1,
    currentStreak: 1,
    bestStreak: 1,
    achievementCount: 1,
    totalSessions: 5,
    totalPoints: 30,
  },
  {
    index: 9,
    email: 'testuser9@test.com',
    displayName: 'testuser9',
    password: 'TestPass123!',
    tier: 'free' as const,
    plan: 'free' as const,
    xp: 550,
    level: 4,
    currentStreak: 0,
    bestStreak: 7,
    achievementCount: 2,
    totalSessions: 18,
    totalPoints: 110,
  },
  {
    index: 10,
    email: 'testuser10@test.com',
    displayName: 'testuser10',
    password: 'TestPass123!',
    tier: 'free' as const,
    plan: 'free' as const,
    xp: 200,
    level: 2,
    currentStreak: 0,
    bestStreak: 2,
    achievementCount: 1,
    totalSessions: 8,
    totalPoints: 45,
  },
];

// Helper to calculate level title
function getLevelTitle(level: number): string {
  if (level === 1) return 'Beginner';
  if (level <= 5) return 'Novice';
  if (level <= 10) return 'Apprentice';
  if (level <= 15) return 'Intermediate';
  if (level <= 20) return 'Advanced';
  if (level <= 25) return 'Expert';
  return 'Master';
}

// Helper to calculate XP to next level
function calculateXpToNextLevel(level: number, currentXp: number): number {
  const baseXp = 100;
  const multiplier = 1.5;
  const nextLevelXp = Math.floor(baseXp * Math.pow(multiplier, level));
  const currentLevelXp = level === 1 ? 0 : Math.floor(baseXp * Math.pow(multiplier, level - 1));
  return nextLevelXp - (currentXp - currentLevelXp);
}

// Helper to get achievement IDs based on count
function getAchievementIds(count: number): string[] {
  const achievements = [
    'first_session',
    'first_streak',
    'week_warrior',
    'kanji_beginner',
    'vocabulary_master',
    'grammar_guru',
    'perfect_week',
    'century_club',
  ];
  return achievements.slice(0, count);
}

async function createTestUser(userData: typeof testUsers[0]) {
  console.log(`\n📝 Creating test user ${userData.index}: ${userData.email}`);

  try {
    // 1. Create Firebase Auth account
    console.log('  → Creating Firebase Auth account...');
    let userRecord;
    try {
      userRecord = await auth.createUser({
        email: userData.email,
        password: userData.password,
        displayName: userData.displayName,
        emailVerified: true,
      });
      console.log(`  ✓ Auth account created with UID: ${userRecord.uid}`);
    } catch (error: any) {
      if (error.code === 'auth/email-already-exists') {
        console.log('  ⚠ User already exists, fetching existing user...');
        userRecord = await auth.getUserByEmail(userData.email);
        console.log(`  ✓ Found existing user with UID: ${userRecord.uid}`);
      } else {
        throw error;
      }
    }

    const uid = userRecord.uid;
    const now = Timestamp.now();

    // 2. Create user document
    console.log('  → Creating user document...');
    const userDoc = {
      profileVersion: 1,
      locale: 'en',
      createdAt: now,
      updatedAt: now,
      email: userData.email,
      emailVerified: true,
      userState: 'active',
      isAdmin: false,

      profile: {
        displayName: userData.displayName,
        avatarUrl: null,
      },

      preferences: {
        language: 'en',
        theme: 'dark',
        dailyGoalMinutes: 10,
        notifications: {
          email: true,
          push: false,
        },
      },

      subscription: userData.tier === 'premium'
        ? {
            plan: userData.plan,
            status: 'active',
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
            metadata: {
              source: 'test',
              createdAt: now,
              updatedAt: now,
              reason: 'Test user creation',
            },
          }
        : {
            plan: 'free',
            status: 'active',
            metadata: {
              source: 'test',
              createdAt: now,
              updatedAt: now,
            },
          },

      lastLoginAt: now,
      lastActivity: {
        test: now,
      },
    };

    await db.collection('users').doc(uid).set(userDoc);
    console.log('  ✓ User document created');

    // 3. Create user_stats document
    console.log('  → Creating user_stats document...');
    const userStatsDoc = {
      userId: uid,
      email: userData.email,
      displayName: userData.displayName,
      photoURL: null,
      tier: userData.tier,

      achievements: {
        totalPoints: userData.totalPoints,
        completionPercentage: (userData.achievementCount / 8) * 100,
        unlockedCount: userData.achievementCount,
        unlockedIds: getAchievementIds(userData.achievementCount),
      },

      sessions: {
        totalItemsReviewed: userData.totalSessions * 8,
        averageAccuracy: 75 + Math.random() * 20, // 75-95%
        totalStudyTimeMinutes: userData.totalSessions * 12,
        todaySessions: userData.currentStreak > 0 ? 1 : 0,
        weekSessions: Math.min(userData.totalSessions, 7),
        monthSessions: Math.min(userData.totalSessions, 30),
        totalSessions: userData.totalSessions,
      },

      xp: {
        level: userData.level,
        levelTitle: getLevelTitle(userData.level),
        weeklyXP: Math.floor(userData.xp * 0.15),
        monthlyXP: Math.floor(userData.xp * 0.4),
        xpGainedToday: userData.currentStreak > 0 ? Math.floor(Math.random() * 50 + 20) : 0,
        total: userData.xp,
        xpToNextLevel: calculateXpToNextLevel(userData.level, userData.xp),
      },

      metadata: {
        schemaVersion: 2,
        syncStatus: 'synced',
        dataHealth: 'healthy',
        createdAt: now,
        lastDataCheck: now,
        lastUpdated: now.toDate().toISOString(),
      },

      dates: {
        lastActivityDate: now.toDate().toISOString(),
        isActiveToday: userData.currentStreak > 0,
      },

      streak: {
        dates: {},
        lastActivityDate: userData.currentStreak > 0 ? now.toDate().toISOString().split('T')[0] : null,
        isActiveToday: userData.currentStreak > 0,
        streakAtRisk: false,
        hoursRemainingToday: userData.currentStreak > 0 ? Math.floor(Math.random() * 12 + 6) : 0,
        best: userData.bestStreak,
        current: userData.currentStreak,
      },
    };

    await db.collection('user_stats').doc(uid).set(userStatsDoc);
    console.log('  ✓ User stats document created');

    // 4. Create leaderboard_stats document
    console.log('  → Creating leaderboard_stats document...');
    const leaderboardStatsDoc = {
      userId: uid,
      email: userData.email,
      displayName: userData.displayName,
      currentLevel: userData.level,
      totalXP: userData.xp,
      totalPoints: userData.totalPoints,
      achievementCount: userData.achievementCount,
      currentStreak: userData.currentStreak,
      bestStreak: userData.bestStreak,
      lastActivityDate: now.toDate().toISOString().split('T')[0],
      lastSyncedAt: now,
      isPublic: true,
      optedOut: false,
    };

    await db.collection('leaderboard_stats').doc(uid).set(leaderboardStatsDoc);
    console.log('  ✓ Leaderboard stats document created');

    // 5. Create achievements subcollection
    console.log('  → Creating achievements subcollection...');
    const achievementsDoc = {
      lastActivity: now,
      [`dates.${now.toDate().toISOString().split('T')[0]}`]: true,
    };

    await db.collection('users').doc(uid).collection('achievements').doc('activities').set(achievementsDoc);
    console.log('  ✓ Achievements subcollection created');

    // 6. Create progress/overall document
    console.log('  → Creating progress/overall document...');
    const progressDoc = {
      userId: uid,
      contentId: 'overall',
      contentType: 'drill',
      status: userData.totalSessions > 10 ? 'learning' : 'not-started',
      accuracy: 75 + Math.random() * 20,
      correctCount: userData.totalSessions * 6,
      reviewCount: userData.totalSessions * 8,
      averageAccuracy: 75 + Math.random() * 20,
      totalDrills: Math.floor(userData.totalSessions / 3),
      perfectDrills: Math.floor(userData.totalSessions / 10),
      bestStreak: userData.bestStreak,
      lastUpdated: now,
      lastReviewedAt: now.toDate().toISOString(),
    };

    await db.collection('users').doc(uid).collection('progress').doc('overall').set(progressDoc);
    console.log('  ✓ Progress document created');

    console.log(`✅ Test user ${userData.index} created successfully!\n`);

    return {
      uid,
      email: userData.email,
      displayName: userData.displayName,
      tier: userData.tier,
      xp: userData.xp,
      level: userData.level,
    };
  } catch (error) {
    console.error(`❌ Error creating test user ${userData.index}:`, error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting test user creation...\n');
  console.log('================================================');
  console.log('Creating 10 test users:');
  console.log('  - 6 Premium users (3 yearly, 3 monthly)');
  console.log('  - 4 Free users');
  console.log('  - Varied XP: 150 → 5200');
  console.log('  - Varied streaks: 0 → 45 days');
  console.log('================================================\n');

  const results = [];

  for (const userData of testUsers) {
    try {
      const result = await createTestUser(userData);
      results.push(result);
    } catch (error) {
      console.error(`Failed to create user ${userData.index}, continuing...`);
    }
  }

  console.log('\n================================================');
  console.log('✅ Test User Creation Complete!');
  console.log('================================================\n');

  console.log('📊 Summary:');
  console.log(`  Total users created: ${results.length}/${testUsers.length}`);
  console.log('\n📋 User Credentials (all passwords: TestPass123!):');
  results.forEach((user) => {
    console.log(`  ${user.displayName}: ${user.email} | ${user.tier} | Level ${user.level} | ${user.xp} XP`);
  });

  console.log('\n🎯 Next Steps:');
  console.log('  1. Test leaderboard with varied rankings');
  console.log('  2. Test premium vs free feature access');
  console.log('  3. Test different activity levels');
  console.log('  4. Verify user stats aggregation');

  console.log('\n✨ All done! Happy testing!\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
