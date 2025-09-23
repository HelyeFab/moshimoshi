#!/usr/bin/env node

/**
 * Script to fix premium user status in Firestore
 * Run with: node scripts/fix-premium-status.js <userEmail>
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
});

const db = admin.firestore();

async function fixPremiumStatus(email) {
  try {
    // Find user by email
    const usersSnapshot = await db.collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.error(`No user found with email: ${email}`);
      process.exit(1);
    }

    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();

    console.log(`\nFound user: ${userId}`);
    console.log('Current subscription data:', JSON.stringify(userData.subscription, null, 2));

    // Update to premium status
    const updateData = {
      subscription: {
        plan: 'premium_monthly', // or 'premium_yearly'
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        stripeCustomerId: userData.subscription?.stripeCustomerId || 'manual_premium',
        metadata: {
          source: 'manual_fix',
          updatedAt: new Date(),
          fixedBy: 'fix-premium-status script'
        }
      },
      updatedAt: new Date()
    };

    await db.collection('users').doc(userId).set(updateData, { merge: true });

    console.log('\n✅ Successfully updated user to premium status');
    console.log('New subscription data:', JSON.stringify(updateData.subscription, null, 2));

    // Verify the update
    const updatedDoc = await db.collection('users').doc(userId).get();
    const updatedData = updatedDoc.data();

    console.log('\nVerification - Current subscription in Firestore:');
    console.log(JSON.stringify(updatedData.subscription, null, 2));

    // Test if the user can access study lists
    console.log('\nTesting study list access...');
    const studyListsRef = db.collection('users').doc(userId).collection('studyLists');

    try {
      // Try to create a test document
      const testDoc = await studyListsRef.add({
        name: 'Test List',
        type: 'mixed',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        version: 1,
        userId: userId,
        items: [],
        deleted: false
      });

      console.log('✅ Successfully created test study list:', testDoc.id);

      // Clean up test document
      await testDoc.delete();
      console.log('✅ Cleaned up test document');

    } catch (error) {
      console.error('❌ Failed to access study lists:', error.message);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error fixing premium status:', error);
    process.exit(1);
  }
}

// Get email from command line
const email = process.argv[2];

if (!email) {
  console.log('Usage: node scripts/fix-premium-status.js <userEmail>');
  console.log('Example: node scripts/fix-premium-status.js user@example.com');
  process.exit(1);
}

console.log(`Fixing premium status for: ${email}`);
fixPremiumStatus(email);