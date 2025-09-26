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

async function checkUserStreak(userId) {
  console.log('=====================================');
  console.log(`Checking streak data for user: ${userId}`);
  console.log('=====================================\n');

  try {
    // Check the activities collection
    const activitiesRef = db.collection('userActivities').doc(userId);
    const activitiesDoc = await activitiesRef.get();

    if (activitiesDoc.exists) {
      const activities = activitiesDoc.data();
      console.log('📊 Activities Data Found:');
      console.log('-------------------------');

      // Display dates if available
      if (activities.dates) {
        const dates = Object.keys(activities.dates).sort();
        console.log(`📅 Activity Dates (${dates.length} total):`);

        // Show last 10 dates
        const recentDates = dates.slice(-10);
        recentDates.forEach(date => {
          console.log(`   - ${date}`);
        });

        if (dates.length > 10) {
          console.log(`   ... and ${dates.length - 10} more dates`);
        }

        // Calculate streaks
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        let currentStreak = 0;
        let tempStreak = 0;
        let checkDate = new Date();

        // Calculate current streak by checking backwards from today
        while (true) {
          const dateStr = checkDate.toISOString().split('T')[0];
          if (activities.dates[dateStr]) {
            tempStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else if (dateStr === today && activities.dates[yesterday]) {
            // Today not done yet but yesterday was - streak continues
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }

        currentStreak = tempStreak;

        console.log(`\n🔥 Calculated Current Streak: ${currentStreak} days`);
      }

      console.log(`\n📈 Stored Stats:`);
      console.log(`   Current Streak: ${activities.currentStreak || 0} days`);
      console.log(`   Best Streak: ${activities.bestStreak || 0} days`);

      if (activities.lastActivity) {
        const lastActive = new Date(activities.lastActivity);
        const daysAgo = Math.floor((Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`   Last Activity: ${lastActive.toLocaleString()} (${daysAgo} days ago)`);
      }

    } else {
      console.log('❌ No activities data found in Firebase');
    }

    // Also check achievements collection for additional stats
    console.log('\n=====================================');
    console.log('Checking achievements data...');
    console.log('=====================================\n');

    const achievementsRef = db.collection('userAchievements').doc(userId);
    const achievementsDoc = await achievementsRef.get();

    if (achievementsDoc.exists) {
      const achievements = achievementsDoc.data();
      console.log('🏆 Achievements Data Found:');
      console.log('-------------------------');
      console.log(`   Total XP: ${achievements.totalXp || 0}`);
      console.log(`   Current Level: ${achievements.currentLevel || 1}`);
      console.log(`   Total Points: ${achievements.totalPoints || 0}`);
      console.log(`   Lessons Completed: ${achievements.lessonsCompleted || 0}`);

      if (achievements.unlocked && achievements.unlocked.length > 0) {
        console.log(`   Achievements Unlocked: ${achievements.unlocked.length}`);

        // Show last 3 achievements
        const recentAchievements = achievements.unlocked.slice(-3);
        console.log(`   Recent Achievements:`);
        recentAchievements.forEach(ach => {
          console.log(`      - ${ach}`);
        });
      }

      if (achievements.lastUpdated) {
        const lastUpdated = new Date(achievements.lastUpdated);
        console.log(`   Last Updated: ${lastUpdated.toLocaleString()}`);
      }
    } else {
      console.log('❌ No achievements data found in Firebase');
    }

    // Check user profile for additional info
    console.log('\n=====================================');
    console.log('Checking user profile...');
    console.log('=====================================\n');

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log('👤 User Profile Found:');
      console.log('-------------------------');
      console.log(`   Email: ${userData.email || 'Not set'}`);
      console.log(`   Display Name: ${userData.displayName || 'Not set'}`);
      console.log(`   Tier: ${userData.tier || 'free'}`);

      if (userData.subscription) {
        console.log(`   Subscription Status: ${userData.subscription.status || 'unknown'}`);
      }

      if (userData.createdAt) {
        const created = new Date(userData.createdAt);
        const daysOld = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`   Account Age: ${daysOld} days`);
      }
    } else {
      console.log('❌ No user profile found in Firebase');
    }

  } catch (error) {
    console.error('❌ Error checking Firebase:', error);
  }

  console.log('\n=====================================');
  console.log('Check complete!');
  console.log('=====================================');

  process.exit(0);
}

// Get user ID from command line or use the one provided
const userId = process.argv[2] || 'r7r6at83BUPIjD69XatI4EGIECr1';
checkUserStreak(userId);