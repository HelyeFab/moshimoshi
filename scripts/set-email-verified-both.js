#!/usr/bin/env node

/**
 * Set Email Verified (Both Auth and Firestore)
 *
 * Sets emailVerified to true in BOTH:
 * 1. Firebase Authentication
 * 2. Firestore users/{userId} document
 */

const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const email = process.argv[2];

if (!email) {
  console.error('\n❌ Usage: node scripts/set-email-verified-both.js <email>\n');
  process.exit(1);
}

async function setEmailVerified(email) {
  console.log('\n===========================================');
  console.log('✉️  SET EMAIL VERIFIED (AUTH + FIRESTORE)');
  console.log('===========================================\n');

  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    const userId = userRecord.uid;

    console.log(`Email: ${email}`);
    console.log(`User ID: ${userId}\n`);

    // Update Firebase Auth
    console.log('1️⃣  Updating Firebase Auth...');
    if (!userRecord.emailVerified) {
      await admin.auth().updateUser(userId, { emailVerified: true });
      console.log('   ✅ Set to true\n');
    } else {
      console.log('   ℹ️  Already true\n');
    }

    // Update Firestore
    console.log('2️⃣  Updating Firestore users/{userId}...');
    const userRef = admin.firestore().collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      const data = userDoc.data();
      if (data.emailVerified !== true) {
        await userRef.update({
          emailVerified: true,
          updatedAt: new Date()
        });
        console.log('   ✅ Set to true\n');
      } else {
        console.log('   ℹ️  Already true\n');
      }
    } else {
      console.log('   ⚠️  Document does not exist (skipping)\n');
    }

    console.log('===========================================');
    console.log('✅ Complete!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await admin.app().delete();
  }
}

setEmailVerified(email).catch(e => { console.error(e); process.exit(1); });
