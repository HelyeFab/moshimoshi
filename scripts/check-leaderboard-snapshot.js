#!/usr/bin/env node

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function checkLeaderboardSnapshot() {
  console.log('\n=====================================');
  console.log('🔍 Checking Leaderboard Snapshot');
  console.log('=====================================\n');

  // Get the allTime snapshot
  const snapshot = await db.collection('leaderboard_snapshots').doc('allTime-latest').get();
  
  if (snapshot.exists) {
    const data = snapshot.data();
    console.log('Snapshot last updated:', new Date(data.lastUpdated).toLocaleString());
    console.log('Total entries:', data.entries?.length || 0);
    console.log('\nLeaderboard Order:');
    
    if (data.entries) {
      data.entries.forEach((entry, index) => {
        console.log(`${index + 1}. ${entry.displayName} - Rank: ${entry.rank}, Points: ${entry.totalPoints}, XP: ${entry.totalXP}, Achievements: ${entry.achievementCount}`);
      });
    }
  } else {
    console.log('❌ No snapshot found!');
  }
}

checkLeaderboardSnapshot()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
