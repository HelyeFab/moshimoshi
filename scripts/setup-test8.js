#!/usr/bin/env node

const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'moshimoshi-de237'
  });
}

const db = admin.firestore();
const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

async function setupTest8() {
  const userStatsRef = db.collection('user_stats').doc(userId);
  const today = '2025-11-08';
  const yesterday = '2025-11-07';

  // Set up clean state for Test 8
  await userStatsRef.update({
    'streak.current': 5,
    'streak.best': 9,
    'dates.lastActivityDate': yesterday,
    'dates.lastStreakUpdateDate': yesterday,
    'xp.xpGainedToday': 0,
    'xp.lastXPDate': yesterday,
    'metadata.lastUpdated': new Date().toISOString()
  });

  console.log('✅ Test 8 setup complete:');
  console.log('  Streak: 5 days (can increment to 6 today)');
  console.log('  Last Activity: ' + yesterday);
  console.log('  Daily XP: 0 (fresh for today)');
  console.log('  Ready for mixed activities test!');

  // Show status
  const doc = await userStatsRef.get();
  const data = doc.data();
  console.log('\n📊 Current State:');
  console.log('  Streak:', data.streak?.current || 0);
  console.log('  Best Streak:', data.streak?.best || 0);
  console.log('  XP Gained Today:', data.xp?.xpGainedToday || 0);
  console.log('  Last XP Date:', data.xp?.lastXPDate || 'Never');
  console.log('  Last Activity:', data.dates?.lastActivityDate || 'Never');
  console.log('  Last Streak Update:', data.dates?.lastStreakUpdateDate || 'Never');
}

setupTest8()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
