#!/usr/bin/env node
/**
 * Create a test document in the onboarding collection (won't delete it)
 */

const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'moshimoshi-service-account.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

const db = admin.firestore();

async function createTestOnboarding() {
  const testUserId = 'test-onboarding-demo';

  const onboardingData = {
    userId: testUserId,
    userEmail: 'demo@example.com',
    learningGoal: 'anime',
    experienceLevel: 'intermediate',
    language: 'ja',
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  console.log('Creating test document in onboarding collection...');
  await db.collection('onboarding').doc(testUserId).set(onboardingData);
  console.log('✅ Created! Check Firebase Console at:');
  console.log(`   https://console.firebase.google.com/project/${serviceAccount.project_id}/firestore/data/~2Fonboarding~2F${testUserId}`);

  process.exit(0);
}

createTestOnboarding();
