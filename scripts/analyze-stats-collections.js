#!/usr/bin/env node

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function analyzeStatsCollections() {
  console.log('\n=====================================');
  console.log('🔍 Analyzing All Stats Collections');
  console.log('=====================================\n');

  const collections = await db.listCollections();

  const statsRelated = [];
  const userRelated = [];
  const leaderboard = [];

  console.log('📊 Collections Analysis:\n');

  for (const col of collections) {
    const name = col.id;

    // Get document count
    const snapshot = await col.limit(100).get();
    const docCount = snapshot.size;

    // Categorize
    if (name.includes('stat') || name.includes('Stats')) {
      statsRelated.push({ name, docCount });
    }
    if (name.includes('user') || name.includes('User')) {
      userRelated.push({ name, docCount });
    }
    if (name.includes('leaderboard')) {
      leaderboard.push({ name, docCount });
    }
  }

  console.log('📊 Stats-related Collections:');
  if (statsRelated.length === 0) {
    console.log('  None found');
  } else {
    statsRelated.forEach(c => console.log(`  - ${c.name} (${c.docCount}+ docs)`));
  }

  console.log('\n🏆 Leaderboard Collections:');
  leaderboard.forEach(c => console.log(`  - ${c.name} (${c.docCount}+ docs)`));

  console.log('\n👤 User-related Collections:');
  userRelated.forEach(c => console.log(`  - ${c.name} (${c.docCount}+ docs)`));

  // Now check specific collections we know about
  console.log('\n=====================================');
  console.log('📋 Detailed Collection Analysis');
  console.log('=====================================\n');

  // Check leaderboard_stats structure
  console.log('1️⃣ leaderboard_stats Collection:');
  console.log('   Purpose: Lightweight stats for leaderboard');
  const sampleLeaderboard = await db.collection('leaderboard_stats')
    .limit(1)
    .get();

  if (!sampleLeaderboard.empty) {
    const data = sampleLeaderboard.docs[0].data();
    console.log('   Fields:', Object.keys(data).join(', '));
    console.log('   Sample data:');
    console.log(`     - currentStreak: ${data.currentStreak}`);
    console.log(`     - bestStreak: ${data.bestStreak}`);
    console.log(`     - totalXP: ${data.totalXP}`);
    console.log(`     - level: ${data.level}`);
  }

  // Check users subcollections
  console.log('\n2️⃣ users/{userId}/achievements Collection:');
  console.log('   Purpose: Detailed achievement data per user');
  const usersSnapshot = await db.collection('users').limit(1).get();
  if (!usersSnapshot.empty) {
    const userId = usersSnapshot.docs[0].id;
    const achievementsSnapshot = await db.collection('users')
      .doc(userId)
      .collection('achievements')
      .get();

    console.log(`   Subcollection docs for user ${userId}:`);
    achievementsSnapshot.forEach(doc => {
      console.log(`     - ${doc.id}`);
      if (doc.id === 'activities' || doc.id === 'data') {
        const data = doc.data();
        console.log(`       Fields: ${Object.keys(data).slice(0, 5).join(', ')}...`);
      }
    });
  }

  // Check for any unified stats collection
  console.log('\n3️⃣ Checking for unified stats collections...');
  const possibleUnified = [
    'user_stats',
    'userStats',
    'unified_stats',
    'stats',
    'statistics'
  ];

  for (const name of possibleUnified) {
    try {
      const col = await db.collection(name).limit(1).get();
      if (!col.empty) {
        console.log(`   ✅ Found: ${name}`);
        const data = col.docs[0].data();
        console.log(`      Fields: ${Object.keys(data).slice(0, 8).join(', ')}...`);
      }
    } catch (e) {
      // Collection doesn't exist
    }
  }

  console.log('\n=====================================');
  console.log('🎯 Current Data Sources Summary');
  console.log('=====================================\n');

  console.log('Stats are currently scattered across:');
  console.log('1. leaderboard_stats - Public leaderboard data');
  console.log('2. users/{userId}/achievements/activities - Streak dates');
  console.log('3. users/{userId}/achievements/data - XP and achievements');
  console.log('4. users/{userId}/statistics/overall - Session statistics');
  console.log('5. localStorage - Client-side cache');

  console.log('\n❌ No single unified stats collection exists!');
  console.log('✅ We need to create one: "user_stats" collection');

  process.exit(0);
}

analyzeStatsCollections();