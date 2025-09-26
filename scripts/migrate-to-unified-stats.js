#!/usr/bin/env node

/**
 * Migration Script: Populate user_stats Collection
 *
 * This script:
 * 1. Reads data from all existing sources
 * 2. Fixes corrupted data (especially dates)
 * 3. Creates unified user_stats documents
 * 4. Validates the migration
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Helper to clean nested dates
function cleanNestedDates(data) {
  const cleanDates = {};

  if (!data || typeof data !== 'object') {
    return cleanDates;
  }

  // Extract dates from nested structure
  if (data.dates && typeof data.dates === 'object') {
    Object.entries(data.dates).forEach(([key, value]) => {
      if (key.match(/^\d{4}-\d{2}-\d{2}$/) && value === true) {
        cleanDates[key] = true;
      }
    });
  }

  // Check for corrupted root-level dates (dates.2025-09-23)
  Object.keys(data).forEach(key => {
    if (key.startsWith('dates.') && key.match(/dates\.\d{4}-\d{2}-\d{2}$/)) {
      const dateOnly = key.replace('dates.', '');
      cleanDates[dateOnly] = true;
      console.log(`  📌 Found corrupted date: ${key} -> ${dateOnly}`);
    } else if (key.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Direct date at root level
      cleanDates[key] = true;
    }
  });

  return cleanDates;
}

// Calculate streak from dates
function calculateStreakFromDates(dates, existingBest = 0) {
  const validDates = Object.keys(dates).filter(date =>
    date.match(/^\d{4}-\d{2}-\d{2}$/)
  ).sort().reverse();

  if (validDates.length === 0) {
    return {
      current: 0,
      best: existingBest,
      isActiveToday: false,
      lastActivityDate: null
    };
  }

  const today = new Date().toISOString().split('T')[0];
  const isActiveToday = validDates.includes(today);

  let currentStreak = 0;
  let expectedDate = new Date();
  expectedDate.setHours(0, 0, 0, 0);

  for (const dateStr of validDates) {
    const date = new Date(dateStr + 'T00:00:00');
    date.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor((expectedDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff === 0) {
      currentStreak++;
      expectedDate.setDate(expectedDate.getDate() - 1);
    } else if (currentStreak === 0 && daysDiff === 1) {
      // Yesterday active, today not yet
      currentStreak++;
      expectedDate.setDate(expectedDate.getDate() - 2);
    } else {
      break;
    }
  }

  return {
    current: currentStreak,
    best: Math.max(existingBest, currentStreak),
    isActiveToday,
    lastActivityDate: validDates[0] || null
  };
}

// Calculate level from XP
function calculateLevel(totalXP) {
  if (totalXP < 100) return 1;
  if (totalXP < 300) return 2;
  if (totalXP < 600) return 3;
  if (totalXP < 1000) return 4;
  if (totalXP < 1500) return 5;
  if (totalXP < 2100) return 6;
  if (totalXP < 2800) return 7;
  if (totalXP < 3600) return 8;
  if (totalXP < 4500) return 9;
  if (totalXP < 5500) return 10;
  return 10 + Math.floor((totalXP - 5500) / 1000);
}

// Get level title
function getLevelTitle(level) {
  if (level <= 5) return 'Beginner';
  if (level <= 10) return 'Novice';
  if (level <= 15) return 'Apprentice';
  if (level <= 20) return 'Student';
  if (level <= 25) return 'Scholar';
  if (level <= 30) return 'Adept';
  if (level <= 35) return 'Expert';
  if (level <= 40) return 'Master';
  if (level <= 50) return 'Grandmaster';
  if (level <= 60) return 'Sensei';
  if (level <= 80) return 'Legend';
  if (level <= 100) return 'Mythic';
  return 'Kami';
}

// Calculate XP to next level
function calculateXPToNextLevel(currentXP, currentLevel) {
  const xpTable = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500];

  if (currentLevel < 10) {
    return xpTable[currentLevel] - currentXP;
  }

  const nextLevelXP = 5500 + ((currentLevel - 9) * 1000);
  return nextLevelXP - currentXP;
}

async function migrateUser(userId) {
  console.log(`\n👤 Migrating user: ${userId}`);
  console.log('----------------------------------------');

  try {
    // Check if already migrated
    const existingStats = await db.collection('user_stats').doc(userId).get();
    if (existingStats.exists && existingStats.data()?.metadata?.schemaVersion === 2) {
      console.log('  ✅ Already migrated with latest schema');
      return { status: 'skipped', userId };
    }

    // Fetch all data sources
    const [userDoc, leaderboardDoc, achievementsDoc, activitiesDoc, statsDoc] = await Promise.all([
      db.collection('users').doc(userId).get(),
      db.collection('leaderboard_stats').doc(userId).get(),
      db.collection('users').doc(userId).collection('achievements').doc('data').get(),
      db.collection('users').doc(userId).collection('achievements').doc('activities').get(),
      db.collection('users').doc(userId).collection('statistics').doc('overall').get()
    ]);

    const userData = userDoc.data() || {};
    const leaderboardData = leaderboardDoc.data() || {};
    const achievementsData = achievementsDoc.data() || {};
    const activitiesData = activitiesDoc.data() || {};
    const statsData = statsDoc.data() || {};

    // Clean and extract dates
    console.log('  🔧 Cleaning dates...');
    const cleanDates = cleanNestedDates(activitiesData);
    console.log(`  📅 Found ${Object.keys(cleanDates).length} valid activity dates`);

    // Calculate streak
    const existingBest = Math.max(
      leaderboardData.bestStreak || 0,
      activitiesData.bestStreak || 0
    );
    const streakResult = calculateStreakFromDates(cleanDates, existingBest);
    console.log(`  🔥 Streak: current=${streakResult.current}, best=${streakResult.best}`);

    // Calculate XP and level - check multiple sources including progress field
    const totalXP = userData.progress?.totalXp || achievementsData.totalXp || leaderboardData.totalXP || 0;
    const level = calculateLevel(totalXP);

    // Build unified stats document
    const unifiedStats = {
      // User Info
      userId,
      email: userData.email || '',
      displayName: userData.displayName || userData.profile?.displayName || leaderboardData.displayName || 'Anonymous',
      photoURL: userData.photoURL || userData.profile?.avatarUrl || leaderboardData.photoURL || null,
      tier: userData.subscription?.plan?.startsWith('premium') ? 'premium' : 'free',

      // Streak Data
      streak: {
        current: streakResult.current,
        best: streakResult.best,
        dates: cleanDates,
        lastActivityDate: streakResult.lastActivityDate,
        isActiveToday: streakResult.isActiveToday,
        streakAtRisk: false // Will be calculated by service
      },

      // XP & Level
      xp: {
        total: totalXP,
        level,
        levelTitle: getLevelTitle(level),
        weeklyXP: leaderboardData.weeklyXP || 0,
        monthlyXP: leaderboardData.monthlyXP || 0,
        xpToNextLevel: calculateXPToNextLevel(totalXP, level),
        xpGainedToday: 0
      },

      // Achievements
      achievements: {
        totalPoints: achievementsData.totalPoints || leaderboardData.achievementPoints || 0,
        unlockedCount: achievementsData.unlocked?.length || 0,
        unlockedIds: achievementsData.unlocked || [],
        completionPercentage: achievementsData.statistics?.percentageComplete || 0,
        byCategory: achievementsData.statistics?.byCategory || {}
      },

      // Session Stats
      sessions: {
        totalSessions: statsData.totalSessions || 0,
        totalItemsReviewed: statsData.totalItemsReviewed || 0,
        averageAccuracy: statsData.averageAccuracy || 0,
        totalStudyTimeMinutes: statsData.totalStudyTime || 0,
        todaySessions: 0,
        weekSessions: 0,
        monthSessions: 0
      },

      // Metadata
      metadata: {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        schemaVersion: 2,
        syncStatus: 'synced',
        dataHealth: 'healthy',
        migratedFrom: ['users', 'leaderboard_stats', 'achievements', 'statistics'],
        migrationDate: new Date().toISOString()
      }
    };

    // Save to user_stats collection
    await db.collection('user_stats').doc(userId).set(unifiedStats);

    console.log('  ✅ Migration successful!');
    console.log('  📊 Summary:');
    console.log(`     - Email: ${unifiedStats.email}`);
    console.log(`     - Display Name: ${unifiedStats.displayName}`);
    console.log(`     - Tier: ${unifiedStats.tier}`);
    console.log(`     - Streak: ${unifiedStats.streak.current} (best: ${unifiedStats.streak.best})`);
    console.log(`     - XP: ${unifiedStats.xp.total} (Level ${unifiedStats.xp.level})`);
    console.log(`     - Achievements: ${unifiedStats.achievements.unlockedCount}`);

    return { status: 'migrated', userId, stats: unifiedStats };

  } catch (error) {
    console.error(`  ❌ Error migrating user ${userId}:`, error);
    return { status: 'error', userId, error: error.message };
  }
}

async function runMigration(specificUserId = null) {
  console.log('\n=====================================');
  console.log('🚀 Starting User Stats Migration');
  console.log('=====================================\n');

  const results = {
    migrated: [],
    skipped: [],
    errors: []
  };

  if (specificUserId) {
    // Migrate specific user
    console.log(`Migrating specific user: ${specificUserId}`);
    const result = await migrateUser(specificUserId);
    results[result.status === 'migrated' ? 'migrated' : result.status === 'skipped' ? 'skipped' : 'errors'].push(result);
  } else {
    // Migrate all users
    const usersSnapshot = await db.collection('users').get();
    console.log(`Found ${usersSnapshot.size} users to process\n`);

    for (const doc of usersSnapshot.docs) {
      const result = await migrateUser(doc.id);
      results[result.status === 'migrated' ? 'migrated' : result.status === 'skipped' ? 'skipped' : 'errors'].push(result);

      // Small delay to avoid overwhelming Firebase
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Print summary
  console.log('\n=====================================');
  console.log('📊 Migration Summary');
  console.log('=====================================\n');
  console.log(`✅ Migrated: ${results.migrated.length} users`);
  console.log(`⏭️  Skipped: ${results.skipped.length} users`);
  console.log(`❌ Errors: ${results.errors.length} users`);

  if (results.errors.length > 0) {
    console.log('\n❌ Failed Users:');
    results.errors.forEach(r => {
      console.log(`  - ${r.userId}: ${r.error}`);
    });
  }

  // Verify migration
  console.log('\n🔍 Verifying migration...');
  const statsCount = await db.collection('user_stats').get();
  console.log(`📈 Total documents in user_stats: ${statsCount.size}`);

  console.log('\n✅ Migration complete!');
}

// Check command line arguments
const args = process.argv.slice(2);
const specificUserId = args[0];

if (specificUserId === '--help') {
  console.log('Usage:');
  console.log('  node migrate-to-unified-stats.js           # Migrate all users');
  console.log('  node migrate-to-unified-stats.js USER_ID   # Migrate specific user');
  process.exit(0);
}

// Run migration
runMigration(specificUserId)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });