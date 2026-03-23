#!/usr/bin/env node

const path = require('path');
const admin = require('firebase-admin');

const USER_EMAIL = 'emmanuelfabiani23@gmail.com';

const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function checkPremium() {
  console.log('🔍 Checking premium status for:', USER_EMAIL);

  const userRecord = await admin.auth().getUserByEmail(USER_EMAIL);
  const userId = userRecord.uid;

  console.log('✅ User ID:', userId);

  // Check custom claims
  console.log('\n📋 Custom claims:', userRecord.customClaims);

  // Check subscriptions collection
  const subsSnapshot = await db.collection('subscriptions')
    .where('userId', '==', userId)
    .get();

  console.log('\n💳 Subscriptions:');
  if (subsSnapshot.empty) {
    console.log('   No subscriptions found');
  } else {
    subsSnapshot.forEach(doc => {
      const data = doc.data();
      console.log('   -', doc.id);
      console.log('     Status:', data.status);
      console.log('     Plan:', data.planId);
      console.log('     Active:', data.status === 'active');
    });
  }

  process.exit(0);
}

checkPremium().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
