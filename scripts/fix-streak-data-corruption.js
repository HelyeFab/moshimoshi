#!/usr/bin/env node

/**
 * Migration script to fix corrupted streak data in Firebase
 * This fixes the issue where dates are stored at root level as "dates.2025-09-17"
 * instead of inside the dates map
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = admin.firestore();

/**
 * Clean nested date structures from Firebase data
 */
function cleanNestedDates(data) {
  const cleanDates = {};

  if (!data || typeof data !== 'object') {
    return cleanDates;
  }

  // Helper function to extract dates from any level
  const extractDates = (obj, prefix = '') => {
    if (!obj || typeof obj !== 'object') return;

    Object.entries(obj).forEach(([key, value]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      // Check if this key looks like a date
      if (key.match(/^\d{4}-\d{2}-\d{2}$/)) {
        cleanDates[key] = true;
      }
      // Check if the full key contains a date (like dates.2025-09-17)
      else if (fullKey.includes('.')) {
        const parts = fullKey.split('.');
        const lastPart = parts[parts.length - 1];
        if (lastPart.match(/^\d{4}-\d{2}-\d{2}$/)) {
          cleanDates[lastPart] = true;
        }
      }

      // Recursively check nested objects
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Don't recurse into objects that are clearly not date containers
        if (!['currentStreak', 'bestStreak', 'lastActivity', 'lastUpdated'].includes(key)) {
          extractDates(value, fullKey);
        }
      }
    });
  };

  // Start extraction from the root
  extractDates(data);

  return cleanDates;
}

/**
 * Calculate streak from dates
 */
function calculateStreakFromDates(dates, existingBestStreak = 0) {
  if (!dates || Object.keys(dates).length === 0) {
    return {
      currentStreak: 0,
      bestStreak: existingBestStreak
    };
  }

  // Sort dates in descending order
  const sortedDates = Object.keys(dates).sort().reverse();

  // Get today's date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  let currentStreak = 0;
  let expectedDate = new Date(today);

  for (const dateStr of sortedDates) {
    const date = new Date(dateStr + 'T00:00:00');
    date.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor((expectedDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff === 0) {
      currentStreak++;
      expectedDate.setDate(expectedDate.getDate() - 1);
    } else if (currentStreak === 0 && daysDiff === 1) {
      currentStreak++;
      expectedDate.setDate(expectedDate.getDate() - 2);
    } else {
      break;
    }
  }

  const bestStreak = Math.max(existingBestStreak, currentStreak);

  return {
    currentStreak,
    bestStreak
  };
}

/**
 * Fix corrupted data for a single user
 */
async function fixUserData(userId) {
  try {
    const activityRef = db
      .collection('users')
      .doc(userId)
      .collection('achievements')
      .doc('activities');

    const doc = await activityRef.get();

    if (!doc.exists) {
      console.log(`No activity data found for user ${userId}`);
      return null;
    }

    const rawData = doc.data();
    console.log(`\n=== Processing user ${userId} ===`);
    console.log('Raw data keys:', Object.keys(rawData));

    // Check for corrupted dates at root level
    const corruptedDates = [];
    Object.keys(rawData).forEach(key => {
      if (key.startsWith('dates.') && key.match(/dates\.\d{4}-\d{2}-\d{2}$/)) {
        corruptedDates.push(key);
      }
    });

    if (corruptedDates.length > 0) {
      console.log(`Found ${corruptedDates.length} corrupted date(s) at root level:`, corruptedDates);
    }

    // Clean all dates using the helper function
    const cleanDates = cleanNestedDates(rawData);

    // Also check for dates directly at the root level
    Object.entries(rawData).forEach(([key, value]) => {
      if (key.startsWith('dates.') && key.match(/dates\.\d{4}-\d{2}-\d{2}$/)) {
        const dateOnly = key.replace('dates.', '');
        cleanDates[dateOnly] = true;
        console.log(`Extracted corrupted date: ${key} -> ${dateOnly}`);
      }
    });

    console.log(`Clean dates found: ${Object.keys(cleanDates).length}`);
    console.log('Dates:', Object.keys(cleanDates).sort());

    // Calculate the correct streak
    const existingBestStreak = rawData.bestStreak || 0;
    const streakResult = calculateStreakFromDates(cleanDates, existingBestStreak);

    console.log('Calculated streak:', streakResult);

    // Prepare clean data structure
    const cleanData = {
      dates: cleanDates,
      currentStreak: streakResult.currentStreak,
      bestStreak: streakResult.bestStreak,
      lastActivity: rawData.lastActivity || 0,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    };

    // Delete corrupted fields first
    const deleteUpdate = {};
    corruptedDates.forEach(key => {
      deleteUpdate[key] = admin.firestore.FieldValue.delete();
    });

    if (Object.keys(deleteUpdate).length > 0) {
      console.log('Deleting corrupted fields...');
      await activityRef.update(deleteUpdate);
    }

    // Update with clean structure
    console.log('Updating with clean data structure...');
    await activityRef.set(cleanData);

    console.log(`✅ Successfully fixed data for user ${userId}`);
    console.log(`   Current streak: ${streakResult.currentStreak}`);
    console.log(`   Best streak: ${streakResult.bestStreak}`);

    return {
      userId,
      fixed: true,
      corruptedFields: corruptedDates,
      currentStreak: streakResult.currentStreak,
      bestStreak: streakResult.bestStreak
    };

  } catch (error) {
    console.error(`❌ Error fixing data for user ${userId}:`, error);
    return {
      userId,
      fixed: false,
      error: error.message
    };
  }
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('🚀 Starting streak data corruption fix migration...\n');

  const userId = process.argv[2];

  if (userId) {
    // Fix single user
    console.log(`Fixing data for user: ${userId}`);
    const result = await fixUserData(userId);

    if (result) {
      console.log('\n=== Migration Summary ===');
      console.log(result);
    }
  } else {
    // Fix all users
    console.log('No user ID provided. To fix all users, run with --all flag');
    console.log('Usage:');
    console.log('  node scripts/fix-streak-data-corruption.js USER_ID    # Fix single user');
    console.log('  node scripts/fix-streak-data-corruption.js --all      # Fix all users');

    if (process.argv[2] === '--all') {
      console.log('\nFixing all users...\n');

      try {
        // Get all users with activity data
        const usersSnapshot = await db.collection('users').get();
        const results = [];

        for (const userDoc of usersSnapshot.docs) {
          const userId = userDoc.id;
          const activityDoc = await db
            .collection('users')
            .doc(userId)
            .collection('achievements')
            .doc('activities')
            .get();

          if (activityDoc.exists) {
            const result = await fixUserData(userId);
            if (result) {
              results.push(result);
            }
          }
        }

        console.log('\n=== Migration Summary ===');
        console.log(`Total users processed: ${results.length}`);
        console.log(`Successfully fixed: ${results.filter(r => r.fixed).length}`);
        console.log(`Failed: ${results.filter(r => !r.fixed).length}`);

        const fixedUsers = results.filter(r => r.fixed && r.corruptedFields.length > 0);
        if (fixedUsers.length > 0) {
          console.log('\nUsers with corrupted data that were fixed:');
          fixedUsers.forEach(r => {
            console.log(`  - ${r.userId}: ${r.corruptedFields.length} corrupted fields fixed`);
          });
        }

      } catch (error) {
        console.error('Error during migration:', error);
        process.exit(1);
      }
    }
  }

  console.log('\n✨ Migration complete!');
  process.exit(0);
}

// Run migration
migrate().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});