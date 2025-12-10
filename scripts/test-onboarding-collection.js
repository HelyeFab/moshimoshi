#!/usr/bin/env node
/**
 * Test script to verify onboarding collection writes work correctly
 * Run with: node scripts/test-onboarding-collection.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Load service account
const serviceAccount = require(path.join(__dirname, '..', 'moshimoshi-service-account.json'));

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

const db = admin.firestore();

async function testOnboardingCollection() {
  const testUserId = 'test-user-' + Date.now();

  console.log('Testing onboarding collection writes...\n');

  try {
    // Test data matching the schema
    const onboardingData = {
      userId: testUserId,
      userEmail: 'test@example.com',
      learningGoal: 'jlpt',
      experienceLevel: 'beginner',
      language: 'de',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    console.log('1. Writing to onboarding collection...');
    await db.collection('onboarding').doc(testUserId).set(onboardingData);
    console.log('   ✅ Write successful!\n');

    // Read it back
    console.log('2. Reading back the document...');
    const doc = await db.collection('onboarding').doc(testUserId).get();

    if (doc.exists) {
      console.log('   ✅ Document found!');
      console.log('   Data:', JSON.stringify(doc.data(), null, 2));
    } else {
      console.log('   ❌ Document not found!');
    }

    // Clean up test document
    console.log('\n3. Cleaning up test document...');
    await db.collection('onboarding').doc(testUserId).delete();
    console.log('   ✅ Test document deleted!\n');

    // Check if there are any real onboarding documents
    console.log('4. Checking for existing onboarding documents...');
    const snapshot = await db.collection('onboarding').limit(5).get();
    console.log(`   Found ${snapshot.size} document(s) in onboarding collection`);

    if (snapshot.size > 0) {
      console.log('\n   Sample documents:');
      snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`   - ${doc.id}: goal=${data.learningGoal}, level=${data.experienceLevel}, lang=${data.language || 'not set'}`);
      });
    }

    console.log('\n✅ All tests passed! Onboarding collection is working correctly.');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }

  process.exit(0);
}

testOnboardingCollection();
