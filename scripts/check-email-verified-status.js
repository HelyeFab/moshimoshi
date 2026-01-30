#!/usr/bin/env node

const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const email = process.argv[2] || 'beano@beano.com';

async function checkStatus() {
  const userRecord = await admin.auth().getUserByEmail(email);
  const userId = userRecord.uid;

  console.log('\n===========================================');
  console.log('📧 EMAIL VERIFIED STATUS');
  console.log('===========================================\n');
  console.log(`Email: ${email}`);
  console.log(`User ID: ${userId}\n`);

  // Check Auth
  console.log('1️⃣  Firebase Auth:');
  console.log(`   emailVerified: ${userRecord.emailVerified}\n`);

  // Check Firestore
  const userDoc = await admin.firestore().collection('users').doc(userId).get();

  if (userDoc.exists) {
    const data = userDoc.data();
    console.log('2️⃣  Firestore users/{userId}:');
    console.log(`   emailVerified: ${data.emailVerified ?? 'NOT SET'}\n`);
  } else {
    console.log('2️⃣  Firestore: Document does not exist\n');
  }

  console.log('===========================================\n');
  await admin.app().delete();
}

checkStatus().catch(e => { console.error(e); process.exit(1); });
