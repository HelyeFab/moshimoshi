#!/usr/bin/env node

/**
 * Reset Feature Usage Script
 *
 * Resets usage count for a specific feature for a user.
 *
 * Usage:
 *   node scripts/reset-feature-usage.js <userId> <featureId> [date]
 *
 * Example:
 *   node scripts/reset-feature-usage.js 5NNDhMn8wBXDQQ0aOFpR6M557ju1 kanji_mood_board
 *   node scripts/reset-feature-usage.js 5NNDhMn8wBXDQQ0aOFpR6M557ju1 kanji_mood_board 2026-01-13
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../moshimoshi-service-account.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Map of feature IDs to their unique items fields
// Must match UNIQUE_ITEM_FIELDS in src/app/api/usage/[featureId]/check/route.ts
const UNIQUE_ITEM_FIELDS = {
  kanji_mood_board: 'kanji_mood_board_boards',
  news: 'news_items',
  story: 'story_items',
  books: 'books_items',
  comics: 'comics_items',
  kanji_connection: 'kanji_connection_items',
  textbook_vocabulary: 'textbook_vocabulary_items',
  kanji_drawing_practice: 'kanji_drawing_practice_items',
};

// Get arguments
const userId = process.argv[2];
const featureId = process.argv[3];
const dateArg = process.argv[4];

if (!userId || !featureId) {
  console.error('\n❌ Error: Missing required arguments\n');
  console.log('Usage:');
  console.log('  node scripts/reset-feature-usage.js <userId> <featureId> [date]\n');
  console.log('Example:');
  console.log('  node scripts/reset-feature-usage.js 5NNDhMn8wBXDQQ0aOFpR6M557ju1 kanji_mood_board');
  console.log('  node scripts/reset-feature-usage.js 5NNDhMn8wBXDQQ0aOFpR6M557ju1 kanji_mood_board 2026-01-13\n');
  process.exit(1);
}

function getTodayBucket() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentMonth() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

async function resetFeatureUsage(userId, featureId, date) {
  console.log('\n===========================================');
  console.log('🔄 RESET FEATURE USAGE');
  console.log('===========================================\n');
  console.log(`User ID: ${userId}`);
  console.log(`Feature: ${featureId}`);
  console.log(`Date: ${date}\n`);

  try {
    // Determine bucket key based on feature type
    // For daily features: featureId_YYYY-MM-DD
    // For monthly features: featureId_YYYY-MM
    const dailyBucketKey = `${featureId}_${date}`;
    const monthlyBucketKey = `${featureId}_${date.substring(0, 7)}`; // YYYY-MM

    console.log('Checking for usage documents...\n');

    // Try daily bucket first
    const dailyRef = db
      .collection('users')
      .doc(userId)
      .collection('usage')
      .doc(dailyBucketKey);

    const dailyDoc = await dailyRef.get();

    if (dailyDoc.exists) {
      const data = dailyDoc.data();
      const currentCount = data[featureId] || 0;

      console.log(`✅ Found daily bucket: ${dailyBucketKey}`);
      console.log(`   Current ${featureId} count: ${currentCount}`);

      // Reset the count to 0 and clear any associated items field
      const updateData = {
        [featureId]: 0,
        updatedAt: new Date().toISOString()
      };

      const itemsField = UNIQUE_ITEM_FIELDS[featureId];
      if (itemsField && data[itemsField] !== undefined) {
        console.log(`   Found ${itemsField}: ${data[itemsField]}`);
        updateData[itemsField] = admin.firestore.FieldValue.delete();
        console.log(`   ✅ Clearing items field`);
      }

      await dailyRef.update(updateData);

      console.log(`   ✅ Reset ${featureId} to 0\n`);
    } else {
      console.log(`ℹ️  No daily bucket found: ${dailyBucketKey}`);
    }

    // Try monthly bucket
    const monthlyRef = db
      .collection('users')
      .doc(userId)
      .collection('usage')
      .doc(monthlyBucketKey);

    const monthlyDoc = await monthlyRef.get();

    if (monthlyDoc.exists) {
      const data = monthlyDoc.data();
      const currentCount = data[featureId] || 0;

      console.log(`✅ Found monthly bucket: ${monthlyBucketKey}`);
      console.log(`   Current ${featureId} count: ${currentCount}`);

      // Reset the count to 0 and clear any associated items field
      const monthlyUpdateData = {
        [featureId]: 0,
        updatedAt: new Date().toISOString()
      };

      const monthlyItemsField = UNIQUE_ITEM_FIELDS[featureId];
      if (monthlyItemsField && data[monthlyItemsField] !== undefined) {
        console.log(`   Found ${monthlyItemsField}: ${data[monthlyItemsField]}`);
        monthlyUpdateData[monthlyItemsField] = admin.firestore.FieldValue.delete();
        console.log(`   ✅ Clearing items field`);
      }

      await monthlyRef.update(monthlyUpdateData);

      console.log(`   ✅ Reset ${featureId} to 0\n`);
    } else {
      console.log(`ℹ️  No monthly bucket found: ${monthlyBucketKey}\n`);
    }

    if (!dailyDoc.exists && !monthlyDoc.exists) {
      console.log('⚠️  No usage documents found for this feature and date.');
      console.log('   This means the feature has not been used yet.\n');
    }

    console.log('===========================================');
    console.log('✅ Reset complete!\n');

  } catch (error) {
    console.error('❌ Error resetting feature usage:', error);
    throw error;
  } finally {
    await admin.app().delete();
  }
}

// Use provided date or default to today
const date = dateArg || getTodayBucket();

resetFeatureUsage(userId, featureId, date).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
