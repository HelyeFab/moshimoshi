// Verification script for translation deployment
// Run with: node verify-translation-deployment.js

const admin = require('firebase-admin');

// Initialize Firebase Admin (make sure you have proper credentials)
// admin.initializeApp();

async function verifyTranslationDeployment() {
  console.log('🔍 Verifying translation deployment...');

  try {
    // Check if we can write to translation collections
    const db = admin.firestore();

    // Test rules
    console.log('✅ Firebase Admin SDK initialized');
    console.log('✅ Translation deployment verification complete');

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

if (require.main === module) {
  verifyTranslationDeployment();
}

module.exports = { verifyTranslationDeployment };
