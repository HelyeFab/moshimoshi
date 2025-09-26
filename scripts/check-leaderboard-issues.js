#!/usr/bin/env node

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function checkLeaderboardIssues() {
  console.log('\n=====================================');
  console.log('🔍 Checking Leaderboard Issues');
  console.log('=====================================\n');

  // 1. Check total users
  const allUsers = await db.collection('users').get();
  console.log(`Total users in 'users' collection: ${allUsers.size}`);

  // 2. Check user_stats collection
  const allStats = await db.collection('user_stats').get();
  console.log(`Total users in 'user_stats' collection: ${allStats.size}`);
  
  // 3. Check who's missing
  const usersWithoutStats = [];
  for (const userDoc of allUsers.docs) {
    const statsDoc = await db.collection('user_stats').doc(userDoc.id).get();
    if (!statsDoc.exists) {
      const userData = userDoc.data();
      usersWithoutStats.push({
        id: userDoc.id,
        email: userData.email,
        displayName: userData.displayName,
        createdAt: userData.createdAt
      });
    }
  }

  console.log(`\nUsers without user_stats: ${usersWithoutStats.length}`);
  if (usersWithoutStats.length > 0) {
    console.log('\nMissing users (first 10):');
    usersWithoutStats.slice(0, 10).forEach(user => {
      console.log(`- ${user.id.substring(0, 8)}... : ${user.email || 'No email'} (${user.displayName || 'No name'})`);
    });
  }

  // 4. Check opt-out status
  const optOuts = await db.collection('leaderboard_optouts').get();
  console.log(`\nUsers opted out of leaderboard: ${optOuts.size}`);

  // 5. Check latest leaderboard snapshot
  const snapshot = await db.collection('leaderboard_snapshots').doc('allTime-latest').get();
  if (snapshot.exists) {
    const data = snapshot.data();
    console.log(`\nLatest leaderboard snapshot:`);
    console.log(`- Total players: ${data.totalPlayers}`);
    console.log(`- Entries shown: ${data.entries?.length || 0}`);
    console.log(`- Last updated: ${new Date(data.lastUpdated).toLocaleString()}`);
    
    // Check if specific user is in leaderboard
    const targetUserId = 'r7r6at83BUPIjD69XatI4EGIECr1';
    const userEntry = data.entries?.find(e => e.userId === targetUserId);
    if (userEntry) {
      console.log(`\n✅ User ${targetUserId.substring(0, 8)}... is in leaderboard:`);
      console.log(`  - Rank: ${userEntry.rank}`);
      console.log(`  - Achievement Count: ${userEntry.achievementCount}`);
      console.log(`  - XP: ${userEntry.totalXP}`);
    } else {
      console.log(`\n❌ User ${targetUserId.substring(0, 8)}... NOT in leaderboard`);
    }
  }

  // 6. Check if old users are being filtered out
  console.log('\n📊 Checking user registration dates:');
  const usersByDate = {};
  allUsers.forEach(doc => {
    const data = doc.data();
    const year = data.createdAt ? new Date(data.createdAt.seconds * 1000).getFullYear() : 'Unknown';
    usersByDate[year] = (usersByDate[year] || 0) + 1;
  });
  
  Object.entries(usersByDate).sort().forEach(([year, count]) => {
    console.log(`  ${year}: ${count} users`);
  });

  return usersWithoutStats;
}

checkLeaderboardIssues()
  .then(missingUsers => {
    if (missingUsers.length > 0) {
      console.log('\n⚠️  ACTION REQUIRED: Run migration for missing users');
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
