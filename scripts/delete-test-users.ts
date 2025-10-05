#!/usr/bin/env tsx
/**
 * Delete Test Users Script
 * Deletes all test users created by create-test-users.ts from Firebase
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

// Test user emails to delete
const testUserEmails = [
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

async function deleteUserData(uid: string, email: string) {
  console.log(`  → Deleting Firestore data for ${email}...`);

  try {
    // Delete from collections
    const collections = [
      'users',
      'user_stats',
      'leaderboard_stats',
    ];

    for (const collection of collections) {
      try {
        await db.collection(collection).doc(uid).delete();
        console.log(`    ✓ Deleted from ${collection}`);
      } catch (error: any) {
        if (error.code !== 'NOT_FOUND') {
          console.log(`    ⚠ Could not delete from ${collection}: ${error.message}`);
        }
      }
    }

    // Delete subcollections from users document
    const subcollections = ['achievements', 'progress', 'lists', 'bookmarks'];

    for (const subcollection of subcollections) {
      try {
        const snapshot = await db.collection('users').doc(uid).collection(subcollection).get();
        const batch = db.batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        if (snapshot.size > 0) {
          await batch.commit();
          console.log(`    ✓ Deleted ${snapshot.size} document(s) from users/${subcollection}`);
        }
      } catch (error: any) {
        console.log(`    ⚠ Could not delete subcollection ${subcollection}: ${error.message}`);
      }
    }

  } catch (error: any) {
    console.log(`    ⚠ Error deleting Firestore data: ${error.message}`);
  }
}

async function deleteTestUser(email: string, index: number) {
  console.log(`\n🗑️  Deleting test user ${index}: ${email}`);

  try {
    // Get user by email
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
      console.log(`  ✓ Found user with UID: ${userRecord.uid}`);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        console.log(`  ⚠ User not found in Auth, skipping...`);
        return { email, status: 'not_found' };
      }
      throw error;
    }

    const uid = userRecord.uid;

    // Delete Firestore data
    await deleteUserData(uid, email);

    // Delete from Firebase Auth
    console.log(`  → Deleting from Firebase Auth...`);
    await auth.deleteUser(uid);
    console.log(`  ✓ Deleted from Firebase Auth`);

    console.log(`✅ Test user ${index} deleted successfully!`);
    return { email, status: 'deleted', uid };

  } catch (error: any) {
    console.error(`❌ Error deleting test user ${index}:`, error.message);
    return { email, status: 'error', error: error.message };
  }
}

async function main() {
  console.log('🚀 Starting test user deletion...\n');
  console.log('================================================');
  console.log(`Deleting ${testUserEmails.length} test users`);
  console.log('================================================\n');

  const results = [];

  for (let i = 0; i < testUserEmails.length; i++) {
    const result = await deleteTestUser(testUserEmails[i], i + 1);
    results.push(result);
  }

  console.log('\n================================================');
  console.log('📊 Deletion Summary');
  console.log('================================================\n');

  const deleted = results.filter((r) => r.status === 'deleted');
  const notFound = results.filter((r) => r.status === 'not_found');
  const errors = results.filter((r) => r.status === 'error');

  console.log(`✅ Deleted: ${deleted.length}`);
  console.log(`⚠️  Not Found: ${notFound.length}`);
  console.log(`❌ Errors: ${errors.length}`);

  if (deleted.length > 0) {
    console.log('\n🗑️  Deleted users:');
    deleted.forEach((r) => console.log(`  - ${r.email}`));
  }

  if (notFound.length > 0) {
    console.log('\n⚠️  Not found (already deleted?):');
    notFound.forEach((r) => console.log(`  - ${r.email}`));
  }

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach((r) => console.log(`  - ${r.email}: ${r.error}`));
  }

  console.log('\n✨ Cleanup complete!\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
