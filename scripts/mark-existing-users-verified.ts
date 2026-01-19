/**
 * Mark Users as Email Verified
 *
 * This script marks users as email verified in Firebase Auth.
 *
 * Usage:
 *   npx tsx scripts/mark-existing-users-verified.ts [--email=user@example.com]
 *
 * Options:
 *   --email=EMAIL  Mark a specific user by email address
 *                  If not provided, marks all existing users
 */

import * as admin from 'firebase-admin';

// Initialize Firebase
if (!admin.apps.length) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const serviceAccount = require('../moshimoshi-service-account.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.warn('No service account file found, using application default credentials');
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const emailArg = args.find(a => a.startsWith('--email='));
const specificEmail = emailArg ? emailArg.split('=')[1] : null;

/**
 * Mark a single user as verified by email
 */
async function markUserVerified(email: string): Promise<void> {
  try {
    console.log(`\n🔍 Looking up user: ${email}`);

    const user = await admin.auth().getUserByEmail(email);

    if (user.emailVerified) {
      console.log(`✅ User is already verified`);
      console.log(`   UID: ${user.uid}`);
      return;
    }

    console.log(`📝 Marking user as verified...`);
    console.log(`   UID: ${user.uid}`);

    await admin.auth().updateUser(user.uid, {
      emailVerified: true
    });

    console.log(`✅ Successfully verified user: ${email}`);
  } catch (error) {
    if ((error as any).code === 'auth/user-not-found') {
      console.error(`❌ User not found: ${email}`);
    } else {
      console.error(`❌ Error verifying user:`, error instanceof Error ? error.message : 'Unknown error');
    }
    throw error;
  }
}

/**
 * Mark all existing users as verified
 */
async function markAllUsersVerified(): Promise<void> {
  console.log('\n🚀 Mark All Users as Verified');
  console.log('================================\n');

  let stats = {
    total: 0,
    alreadyVerified: 0,
    updated: 0,
    failed: 0,
  };

  try {
    const listUsersResult = await admin.auth().listUsers(1000);
    const users = listUsersResult.users;

    console.log(`📊 Found ${users.length} users\n`);

    for (const user of users) {
      stats.total++;

      try {
        if (user.emailVerified) {
          console.log(`✓ ${user.email || user.uid} - Already verified`);
          stats.alreadyVerified++;
        } else {
          console.log(`📝 ${user.email || user.uid} - Marking as verified...`);
          await admin.auth().updateUser(user.uid, {
            emailVerified: true
          });
          stats.updated++;
          console.log(`   ✅ Verified`);
        }
      } catch (error) {
        console.error(`   ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        stats.failed++;
      }
    }
  } catch (error) {
    console.error('❌ Error listing users:', error);
    throw error;
  }

  console.log('\n================================');
  console.log('📊 Summary');
  console.log('================================');
  console.log(`   Total users: ${stats.total}`);
  console.log(`   Already verified: ${stats.alreadyVerified}`);
  console.log(`   Newly verified: ${stats.updated}`);
  console.log(`   Failed: ${stats.failed}`);
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Mark Users as Email Verified');
  console.log('================================');

  if (specificEmail) {
    console.log(`📌 Target: Single user (${specificEmail})\n`);
    await markUserVerified(specificEmail);
  } else {
    console.log(`📌 Target: All users\n`);
    await markAllUsersVerified();
  }

  console.log('\n✨ Done!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
