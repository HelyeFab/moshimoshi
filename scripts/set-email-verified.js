#!/usr/bin/env node

/**
 * Set Email Verified Script
 *
 * Sets emailVerified to true for a user
 *
 * Usage:
 *   node scripts/set-email-verified.js <email>
 *
 * Example:
 *   node scripts/set-email-verified.js beano@beano.com
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../moshimoshi-service-account.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Get email argument
const email = process.argv[2];

if (!email) {
  console.error('\n❌ Error: Missing email argument\n');
  console.log('Usage:');
  console.log('  node scripts/set-email-verified.js <email>\n');
  console.log('Example:');
  console.log('  node scripts/set-email-verified.js beano@beano.com\n');
  process.exit(1);
}

async function setEmailVerified(email) {
  console.log('\n===========================================');
  console.log('✉️  SET EMAIL VERIFIED');
  console.log('===========================================\n');
  console.log(`Email: ${email}\n`);

  try {
    // Get user by email
    console.log('Looking up user...');
    const userRecord = await admin.auth().getUserByEmail(email);
    const userId = userRecord.uid;

    console.log(`✅ Found user ID: ${userId}`);
    console.log(`   Current emailVerified: ${userRecord.emailVerified}\n`);

    if (userRecord.emailVerified) {
      console.log('ℹ️  Email is already verified. Nothing to do.\n');
    } else {
      console.log('Updating emailVerified to true...');

      // Update the user record
      await admin.auth().updateUser(userId, {
        emailVerified: true
      });

      console.log('✅ Email verification status updated!\n');
    }

    console.log('===========================================');
    console.log('✅ Complete!\n');

  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.error(`❌ Error: No user found with email: ${email}\n`);
    } else {
      console.error('❌ Error setting email verified:', error);
    }
    throw error;
  } finally {
    await admin.app().delete();
  }
}

setEmailVerified(email).catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
