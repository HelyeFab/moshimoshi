#!/usr/bin/env node

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
  });
}

const db = admin.firestore();

async function checkUserSubcollections(userId) {
  console.log('=====================================');
  console.log(`🔍 Checking subcollections for user: ${userId}`);
  console.log('=====================================\n');

  try {
    const userRef = db.collection('users').doc(userId);

    // Check achievements subcollection
    console.log('📊 Achievements Subcollection:');
    console.log('-------------------------');
    const achievementsSnapshot = await userRef.collection('achievements').get();
    achievementsSnapshot.forEach(doc => {
      console.log(`\n📄 Document ID: ${doc.id}`);
      const data = doc.data();

      if (data.dates) {
        const dates = Object.keys(data.dates).sort();
        console.log(`   📅 Activity Dates: ${dates.length} days recorded`);
        console.log(`   First activity: ${dates[0] || 'N/A'}`);
        console.log(`   Last activity: ${dates[dates.length - 1] || 'N/A'}`);

        // Calculate current streak from dates
        const today = new Date().toISOString().split('T')[0];
        let streak = 0;
        let checkDate = new Date();

        while (dates.includes(checkDate.toISOString().split('T')[0])) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        }

        console.log(`   🔥 Calculated Current Streak: ${streak} days`);

        // Show recent dates
        console.log(`   Recent activity dates:`);
        dates.slice(-7).forEach(date => {
          console.log(`      - ${date}`);
        });
      }

      if (data.currentStreak !== undefined) {
        console.log(`   🔥 Stored Current Streak: ${data.currentStreak} days`);
      }
      if (data.bestStreak !== undefined) {
        console.log(`   🏆 Best Streak: ${data.bestStreak} days`);
      }
      if (data.totalXp !== undefined) {
        console.log(`   ⭐ Total XP: ${data.totalXp}`);
      }
      if (data.currentLevel !== undefined) {
        console.log(`   📊 Current Level: ${data.currentLevel}`);
      }
      if (data.totalPoints !== undefined) {
        console.log(`   💎 Total Points: ${data.totalPoints}`);
      }
      if (data.unlocked) {
        console.log(`   🎯 Achievements Unlocked: ${data.unlocked.length || 0}`);
        if (data.unlocked.length > 0) {
          console.log(`      Recent unlocks:`);
          data.unlocked.slice(-3).forEach(ach => {
            console.log(`         - ${ach}`);
          });
        }
      }
      if (data.lastActivity) {
        const date = new Date(data.lastActivity);
        console.log(`   ⏰ Last Activity: ${date.toLocaleString()}`);
      }
    });

    // Check xp_events subcollection
    console.log('\n\n📈 XP Events Subcollection:');
    console.log('-------------------------');
    const xpEventsSnapshot = await userRef.collection('xp_events').orderBy('timestamp', 'desc').limit(5).get();

    xpEventsSnapshot.forEach(doc => {
      const data = doc.data();
      const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
      console.log(`   ${timestamp.toLocaleDateString()} - ${data.xpGained || 0} XP (${data.source || 'unknown'})`);
    });

    // Check statistics subcollection
    console.log('\n\n📊 Statistics Subcollection:');
    console.log('-------------------------');
    const statsSnapshot = await userRef.collection('statistics').get();
    statsSnapshot.forEach(doc => {
      console.log(`\n📄 Document ID: ${doc.id}`);
      const data = doc.data();
      console.log(`   Total Sessions: ${data.totalSessions || 0}`);
      console.log(`   Total Items Reviewed: ${data.totalItemsReviewed || 0}`);
      console.log(`   Average Accuracy: ${data.averageAccuracy || 0}%`);
      console.log(`   Total Study Time: ${data.totalStudyTime || 0} minutes`);
    });

    // Check progress subcollection
    console.log('\n\n📚 Progress Subcollection:');
    console.log('-------------------------');
    const progressSnapshot = await userRef.collection('progress').get();
    progressSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`   ${doc.id}: Level ${data.level || 0} - ${data.itemsCompleted || 0} items`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }

  console.log('\n=====================================');
  console.log('Subcollection check complete!');
  console.log('=====================================');

  process.exit(0);
}

const userId = process.argv[2] || 'r7r6at83BUPIjD69XatI4EGIECr1';
checkUserSubcollections(userId);