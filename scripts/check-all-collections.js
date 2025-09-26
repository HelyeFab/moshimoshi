#!/usr/bin/env node

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
  });
}

const db = admin.firestore();

async function checkAllUserData(userId) {
  console.log('=====================================');
  console.log(`🔍 Deep search for user: ${userId}`);
  console.log('=====================================\n');

  try {
    // List all root collections first
    console.log('📂 Checking all root collections...\n');
    const collections = await db.listCollections();

    for (const collection of collections) {
      console.log(`\n📁 Collection: ${collection.id}`);
      console.log('-------------------------');

      // Check if this collection has a document with the userId
      const doc = await collection.doc(userId).get();
      if (doc.exists) {
        console.log(`✅ Found document for user!`);
        const data = doc.data();

        // Pretty print the data
        if (collection.id === 'achievements' || collection.id === 'activities') {
          // Special handling for achievements/activities
          if (data.dates) {
            const dates = Object.keys(data.dates).sort();
            console.log(`   📅 Activity Dates: ${dates.length} days recorded`);
            console.log(`   First activity: ${dates[0]}`);
            console.log(`   Last activity: ${dates[dates.length - 1]}`);

            // Show last 5 dates
            console.log(`   Recent dates:`);
            dates.slice(-5).forEach(date => {
              console.log(`      - ${date}`);
            });
          }

          if (data.currentStreak !== undefined) {
            console.log(`   🔥 Current Streak: ${data.currentStreak} days`);
          }
          if (data.bestStreak !== undefined) {
            console.log(`   🏆 Best Streak: ${data.bestStreak} days`);
          }
          if (data.totalXp !== undefined) {
            console.log(`   ⭐ Total XP: ${data.totalXp}`);
          }
          if (data.currentLevel !== undefined) {
            console.log(`   📊 Level: ${data.currentLevel}`);
          }
          if (data.unlocked) {
            console.log(`   🎯 Achievements Unlocked: ${Array.isArray(data.unlocked) ? data.unlocked.length : 'Data present'}`);
          }
        } else {
          // Generic data display
          console.log('   Data:', JSON.stringify(data, null, 2).substring(0, 500));
        }

        // Check for subcollections
        const subcollections = await collection.doc(userId).listCollections();
        if (subcollections.length > 0) {
          console.log(`   📂 Subcollections found:`);
          for (const subcol of subcollections) {
            const subdocs = await subcol.get();
            console.log(`      - ${subcol.id} (${subdocs.size} documents)`);
          }
        }
      } else {
        // Try searching within the collection for any documents that reference this user
        const query = await collection.where('userId', '==', userId).limit(5).get();
        if (!query.empty) {
          console.log(`✅ Found ${query.size} document(s) with userId field`);
          query.forEach(doc => {
            const data = doc.data();
            console.log(`   Doc ID: ${doc.id}`);
            if (data.currentStreak !== undefined) console.log(`   Current Streak: ${data.currentStreak}`);
            if (data.bestStreak !== undefined) console.log(`   Best Streak: ${data.bestStreak}`);
          });
        }
      }
    }

    console.log('\n=====================================');
    console.log('🎯 Specifically checking likely collections...');
    console.log('=====================================\n');

    // Check specific collection patterns that might exist
    const possibleCollections = [
      'achievements',
      'activities',
      'userActivities',
      'userAchievements',
      'user_achievements',
      'user_activities',
      'streaks',
      'userStreaks',
      'user_streaks',
      'stats',
      'userStats',
      'user_stats',
      'progress',
      'userProgress'
    ];

    for (const colName of possibleCollections) {
      try {
        const doc = await db.collection(colName).doc(userId).get();
        if (doc.exists) {
          console.log(`✅ Found in '${colName}':`);
          const data = doc.data();
          if (data.currentStreak !== undefined) {
            console.log(`   Current Streak: ${data.currentStreak}`);
          }
          if (data.bestStreak !== undefined) {
            console.log(`   Best Streak: ${data.bestStreak}`);
          }
          if (data.dates) {
            const dateCount = Object.keys(data.dates).length;
            console.log(`   Activity dates: ${dateCount} days`);
          }
        }
      } catch (e) {
        // Collection might not exist, that's okay
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }

  console.log('\n=====================================');
  console.log('Search complete!');
  console.log('=====================================');

  process.exit(0);
}

// Get user ID
const userId = process.argv[2] || 'r7r6at83BUPIjD69XatI4EGIECr1';
checkAllUserData(userId);