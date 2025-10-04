#!/usr/bin/env node

/**
 * Verify Test Users Script
 * Verifies that all 10 test users were created successfully
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../moshimoshi-service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

const auth = getAuth();
const db = getFirestore();

const testEmails = [
  'testuser1@test.com',
  'testuser2@test.com',
  'testuser3@test.com',
  'testuser4@test.com',
  'testuser5@test.com',
  'testuser6@test.com',
  'testuser7@test.com',
  'testuser8@test.com',
  'testuser9@test.com',
  'testuser10@test.com',
];

async function verifyUser(email: string) {
  try {
    // 1. Check auth account
    const userRecord = await auth.getUserByEmail(email);
    const uid = userRecord.uid;

    // 2. Check user document
    const userDoc = await db.collection('users').doc(uid).get();
    const userExists = userDoc.exists;
    const userData = userDoc.data();

    // 3. Check user_stats document
    const statsDoc = await db.collection('user_stats').doc(uid).get();
    const statsExists = statsDoc.exists;
    const statsData = statsDoc.data();

    // 4. Check leaderboard_stats document
    const leaderboardDoc = await db.collection('leaderboard_stats').doc(uid).get();
    const leaderboardExists = leaderboardDoc.exists;
    const leaderboardData = leaderboardDoc.data();

    const allGood = userExists && statsExists && leaderboardExists;

    return {
      email,
      uid,
      authExists: true,
      userExists,
      statsExists,
      leaderboardExists,
      allGood,
      tier: userData?.subscription?.plan || 'unknown',
      xp: statsData?.xp?.total || 0,
      level: statsData?.xp?.level || 0,
      streak: statsData?.streak?.current || 0,
    };
  } catch (error: any) {
    return {
      email,
      uid: null,
      authExists: false,
      userExists: false,
      statsExists: false,
      leaderboardExists: false,
      allGood: false,
      error: error.message,
    };
  }
}

async function main() {
  console.log('🔍 Verifying test users...\n');

  const results = [];

  for (const email of testEmails) {
    const result = await verifyUser(email);
    results.push(result);

    const status = result.allGood ? '✅' : '❌';
    const details = result.allGood
      ? `${result.tier} | Level ${result.level} | ${result.xp} XP | ${result.streak} day streak`
      : `Error: ${result.error || 'Missing documents'}`;

    console.log(`${status} ${email}`);
    console.log(`   ${details}\n`);
  }

  console.log('\n================================================');
  console.log('📊 Verification Summary');
  console.log('================================================\n');

  const successCount = results.filter((r) => r.allGood).length;
  console.log(`✅ Successfully verified: ${successCount}/${testEmails.length}`);

  const failedUsers = results.filter((r) => !r.allGood);
  if (failedUsers.length > 0) {
    console.log(`\n❌ Failed users: ${failedUsers.length}`);
    failedUsers.forEach((user) => {
      console.log(`   - ${user.email}: ${user.error || 'Missing documents'}`);
    });
  }

  // Show tier breakdown
  const premiumUsers = results.filter((r) =>
    r.tier?.includes('premium')
  ).length;
  const freeUsers = results.filter((r) => r.tier === 'free').length;

  console.log(`\n📈 Tier Distribution:`);
  console.log(`   Premium: ${premiumUsers}`);
  console.log(`   Free: ${freeUsers}`);

  // Show XP range
  const xpValues = results.filter((r) => r.allGood).map((r) => r.xp!);
  const minXp = Math.min(...xpValues);
  const maxXp = Math.max(...xpValues);

  console.log(`\n🎯 XP Range:`);
  console.log(`   Min: ${minXp} XP`);
  console.log(`   Max: ${maxXp} XP`);

  // Show leaderboard preview
  console.log(`\n🏆 Leaderboard Preview (sorted by XP):`);
  const sorted = results
    .filter((r) => r.allGood)
    .sort((a, b) => b.xp! - a.xp!);

  sorted.forEach((user, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
    console.log(
      `   ${medal} ${index + 1}. ${user.email.split('@')[0]} - Level ${user.level} - ${user.xp} XP - ${user.tier}`
    );
  });

  console.log('\n✨ Verification complete!\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
