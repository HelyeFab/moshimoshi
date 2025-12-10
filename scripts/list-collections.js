#!/usr/bin/env node
/**
 * List all collections in Firestore
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

async function listCollections() {
  console.log('Project ID:', serviceAccount.project_id);
  console.log('\nListing all root collections in Firestore...\n');

  try {
    const collections = await db.listCollections();

    if (collections.length === 0) {
      console.log('No collections found in Firestore.');
    } else {
      console.log(`Found ${collections.length} collection(s):\n`);
      for (const col of collections) {
        const snapshot = await col.limit(1).get();
        console.log(`- ${col.id} (${snapshot.size > 0 ? 'has documents' : 'empty or no access'})`);
      }
    }

    // Specifically check for onboarding collection
    console.log('\n--- Checking onboarding collection specifically ---');
    const onboardingRef = db.collection('onboarding');
    const onboardingSnap = await onboardingRef.get();
    console.log(`onboarding collection has ${onboardingSnap.size} document(s)`);

    if (onboardingSnap.size > 0) {
      console.log('\nDocuments in onboarding:');
      onboardingSnap.forEach(doc => {
        console.log(`  ${doc.id}:`, doc.data());
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  }

  process.exit(0);
}

listCollections();
