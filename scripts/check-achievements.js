#!/usr/bin/env node

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function checkAchievements() {
  const userId = 'r7r6at83BUPIjD69XatI4EGIECr1';

  console.log('Checking achievements for:', userId);
  console.log('=====================================\n');

  // Check user_stats
  const statsDoc = await db.collection('user_stats').doc(userId).get();
  if (statsDoc.exists) {
    const data = statsDoc.data();
    console.log('Achievements in user_stats:', data.achievements);
  }

  // Check old achievements location
  const achievementsDoc = await db.collection('users').doc(userId).collection('achievements').doc('data').get();
  if (achievementsDoc.exists) {
    const data = achievementsDoc.data();
    console.log('\nOld achievements data (should be deleted):');
    console.log('- Unlocked:', data.unlocked?.length || 0, 'achievements');
    console.log('- Unlocked IDs:', data.unlocked);
    console.log('- Total Points:', data.totalPoints || 0);
  }

  // Check localStorage format (what we expect)
  console.log('\n=====================================');
  console.log('Checking other users in user_stats:');

  const allStats = await db.collection('user_stats').limit(10).get();
  console.log('Sample of users in user_stats:');

  allStats.forEach(doc => {
    const data = doc.data();
    console.log(`- ${doc.id.substring(0, 8)}... : achievements=${data.achievements?.unlockedCount || 0}, XP=${data.xp?.total || 0}`);
  });

  console.log('\nTotal users checked:', allStats.size);
}

checkAchievements().then(() => process.exit(0));