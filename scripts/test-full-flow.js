#!/usr/bin/env node

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function testFullFlow() {
  const userId = 'r7r6at83BUPIjD69XatI4EGIECr1';
  
  console.log('\n=====================================');
  console.log('🔍 Full Data Flow Test');
  console.log('=====================================\n');

  // 1. Check user_stats directly
  const userStatsDoc = await db.collection('user_stats').doc(userId).get();
  if (!userStatsDoc.exists) {
    console.log('❌ user_stats document missing!');
    return;
  }

  const statsData = userStatsDoc.data();
  console.log('📊 Data in user_stats:');
  console.log('- streak.current:', statsData.streak?.current);
  console.log('- streak.best:', statsData.streak?.best);
  console.log('- xp.total:', statsData.xp?.total);
  console.log('- achievements.unlockedCount:', statsData.achievements?.unlockedCount);

  // 2. Simulate what aggregateUserStats should return
  console.log('\n📡 What API should return:');
  const streakDays = statsData?.streak?.current || 0;
  const bestStreak = statsData?.streak?.best || 0;
  console.log('- streakDays:', streakDays);
  console.log('- bestStreak:', bestStreak);

  // 3. Check what useReviewStats expects
  console.log('\n🎯 What useReviewStats expects:');
  console.log('- data.streakDays (for currentStreak)');
  console.log('- data.bestStreak (for bestStreak)');
  
  // 4. What UI should display
  console.log('\n✅ What UI should show:');
  console.log('- Current Streak: ' + streakDays + ' days');
  console.log('- Best Streak: ' + bestStreak + ' days');
}

testFullFlow()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
