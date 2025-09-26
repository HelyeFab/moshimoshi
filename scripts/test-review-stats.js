#!/usr/bin/env node

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function testReviewStats() {
  const userId = 'r7r6at83BUPIjD69XatI4EGIECr1';
  
  console.log('\n=====================================');
  console.log('🔍 Testing Review Stats Data');
  console.log('=====================================\n');

  // Check user_stats collection
  const userStatsDoc = await db.collection('user_stats').doc(userId).get();
  
  if (userStatsDoc.exists) {
    const data = userStatsDoc.data();
    
    console.log('📊 User Stats Data:');
    console.log('- Current Streak:', data.streak?.current || 0);
    console.log('- Best Streak:', data.streak?.best || 0);
    console.log('- Total XP:', data.xp?.total || 0);
    console.log('- Level:', data.xp?.level || 1);
    console.log('- Achievements:', data.achievements?.unlockedCount || 0);
    console.log('- Total Sessions:', data.sessions?.totalSessions || 0);
    console.log('- Average Accuracy:', data.sessions?.averageAccuracy || 0);
    console.log('- Study Time (min):', data.sessions?.totalStudyTimeMinutes || 0);
    
    console.log('\n✅ Review stats should now show:');
    console.log(`  - Streak: ${data.streak?.current} (best: ${data.streak?.best})`);
    console.log(`  - Study time: ${data.sessions?.totalStudyTimeMinutes} minutes`);
    console.log(`  - Accuracy: ${data.sessions?.averageAccuracy}%`);
  } else {
    console.log('❌ User stats not found!');
  }
}

testReviewStats()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
