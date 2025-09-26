#!/usr/bin/env node

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function simulateReviewStatsAPI() {
  const userId = 'r7r6at83BUPIjD69XatI4EGIECr1';
  
  console.log('\n=====================================');
  console.log('🔍 Simulating /api/review/stats');
  console.log('=====================================\n');

  // 1. Check if user is premium
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();
  const plan = userData?.subscription?.plan || 'free';
  const isPremium = plan.includes('premium');
  
  console.log('User Plan:', plan);
  console.log('Is Premium:', isPremium);

  if (!isPremium) {
    console.log('\n❌ FREE USER - API returns minimal stats!');
    console.log('Free users get stats from IndexedDB locally');
    console.log('API returns: { streakDays: 0, bestStreak: 0, ... }');
    return;
  }

  // 2. For premium users, check user_stats
  const userStatsDoc = await db.collection('user_stats').doc(userId).get();
  
  if (userStatsDoc.exists) {
    const statsData = userStatsDoc.data();
    
    console.log('\n📊 What API should return for premium:');
    console.log('- streakDays:', statsData?.streak?.current || 0);
    console.log('- bestStreak:', statsData?.streak?.best || 0);
    console.log('- totalXP:', statsData?.xp?.total || 0);
    console.log('- achievements:', statsData?.achievements?.unlockedCount || 0);
  }
}

simulateReviewStatsAPI()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
