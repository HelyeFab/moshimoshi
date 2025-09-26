#!/usr/bin/env node

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function checkTest1Data() {
  const userId = 'S5rT5OeF6PdX9qw1wxTe80Ck5Kn2'; // test-1's ID
  
  console.log('\n=====================================');
  console.log('🔍 Checking test-1 Data');
  console.log('=====================================\n');

  const userStats = await db.collection('user_stats').doc(userId).get();
  
  if (userStats.exists) {
    const data = userStats.data();
    console.log('test-1 user_stats:');
    console.log('- achievements.totalPoints:', data.achievements?.totalPoints);
    console.log('- achievements.unlockedCount:', data.achievements?.unlockedCount);
    console.log('- achievements.unlockedIds:', data.achievements?.unlockedIds);
    console.log('- xp.total:', data.xp?.total);
    console.log('- streak.current:', data.streak?.current);
    
    console.log('\nScore calculation for All Time:');
    const totalPoints = data.achievements?.totalPoints || 0;
    const totalXP = data.xp?.total || 0;
    const bestStreak = data.streak?.best || 0;
    const score = totalPoints + totalXP + (bestStreak * 3);
    console.log(`Score = ${totalPoints} (points) + ${totalXP} (XP) + ${bestStreak}*3 (streak) = ${score}`);
  }
}

checkTest1Data()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
