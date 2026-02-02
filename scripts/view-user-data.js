#!/usr/bin/env node

/**
 * View User Data Script
 *
 * Displays comprehensive user data including:
 * - Authentication details
 * - User profile
 * - Subcollections (usage, etc.)
 * - Waitlist status
 * - Discount eligibility
 * - Other collections
 *
 * Usage:
 *   node scripts/view-user-data.js <email>
 *
 * Example:
 *   node scripts/view-user-data.js seanconnery23@gmail.com
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'moshimoshi-de237'
});

const db = admin.firestore();

// Get email from command line
const email = process.argv[2];

if (!email) {
  console.error('\n❌ Error: Missing email argument\n');
  console.log('Usage:');
  console.log('  node scripts/view-user-data.js <email>\n');
  console.log('Example:');
  console.log('  node scripts/view-user-data.js seanconnery23@gmail.com\n');
  process.exit(1);
}

async function viewUserData() {
  console.log('='.repeat(80));
  console.log(`FIREBASE USER DATA FOR: ${email}`);
  console.log('='.repeat(80));
  console.log();

  try {
    // Get user by email
    let userId;
    let userRecord;

    console.log('📧 AUTHENTICATION DETAILS');
    console.log('-'.repeat(80));
    try {
      userRecord = await admin.auth().getUserByEmail(email);
      userId = userRecord.uid;
      console.log('UID:', userRecord.uid);
      console.log('Email:', userRecord.email);
      console.log('Email Verified:', userRecord.emailVerified);
      console.log('Display Name:', userRecord.displayName || 'Not set');
      console.log('Photo URL:', userRecord.photoURL || 'Not set');
      console.log('Created:', new Date(userRecord.metadata.creationTime).toISOString());
      console.log('Last Sign In:', new Date(userRecord.metadata.lastSignInTime).toISOString());
      console.log('Disabled:', userRecord.disabled);
      console.log('Custom Claims:', JSON.stringify(userRecord.customClaims || {}, null, 2));
    } catch (error) {
      console.log('❌ Error fetching auth details:', error.message);
      process.exit(1);
    }
    console.log();

    // Check waitlist status
    console.log('📋 WAITLIST STATUS');
    console.log('-'.repeat(80));
    try {
      const waitlistSnapshot = await db.collection('waitlist')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (waitlistSnapshot.empty) {
        console.log('❌ Not on waitlist');
      } else {
        const waitlistData = waitlistSnapshot.docs[0].data();
        console.log('✅ On waitlist');
        console.log('   linkedUid:', waitlistData.linkedUid || 'null');
        console.log('   discountGranted:', waitlistData.discountGranted || false);
        console.log('   joinedAt:', waitlistData.joinedAt ? waitlistData.joinedAt.toDate() : 'null');
      }
    } catch (error) {
      console.log('Error checking waitlist:', error.message);
    }
    console.log();

    // Check discount eligibility
    console.log('💰 DISCOUNT ELIGIBILITY');
    console.log('-'.repeat(80));
    try {
      const discountRef = db.collection('stripe').doc('discounts').collection('users').doc(userId);
      const discountDoc = await discountRef.get();

      console.log('Path: stripe/discounts/users/' + userId);
      if (!discountDoc.exists) {
        console.log('❌ No discount document found');
      } else {
        const data = discountDoc.data();
        console.log('✅ Discount document exists');
        console.log('   eligible:', data.eligible);
        console.log('   promotionCodeId:', data.promotionCodeId || 'null');
        console.log('   source:', data.source || 'null');
        console.log('   redeemed:', data.redeemed || false);
        console.log('   redeemedAt:', data.redeemedAt ? data.redeemedAt.toDate() : 'null');

        if (data.eligible && !data.redeemed) {
          console.log('\n   ✅ READY FOR CHECKOUT - Discount will be auto-applied');
        } else if (data.redeemed) {
          console.log('\n   ⚠️  Discount already redeemed');
        }
      }
    } catch (error) {
      console.log('Error checking discount:', error.message);
    }
    console.log();

    // Check user document in users collection
    console.log('👤 USER PROFILE (users collection)');
    console.log('-'.repeat(80));
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      console.log(JSON.stringify(userDoc.data(), null, 2));

      // Check for subcollections
      const subcollections = await db.collection('users').doc(userId).listCollections();
      if (subcollections.length > 0) {
        console.log('\n📁 Subcollections:', subcollections.map(col => col.id).join(', '));

        // Fetch data from each subcollection
        for (const subcol of subcollections) {
          console.log(`\n  └─ ${subcol.id}:`);
          const subDocs = await subcol.get();
          console.log(`     Documents: ${subDocs.size}`);

          if (subDocs.size <= 5) {
            // Show all if 5 or fewer
            subDocs.forEach(doc => {
              console.log(`     - ${doc.id}:`, JSON.stringify(doc.data(), null, 8).substring(0, 200) + '...');
            });
          } else {
            console.log(`     (Too many to display, showing first 3)`);
            subDocs.docs.slice(0, 3).forEach(doc => {
              console.log(`     - ${doc.id}:`, JSON.stringify(doc.data(), null, 8).substring(0, 200) + '...');
            });
          }
        }
      }
    } else {
      console.log('No user profile found');
    }
    console.log();

    // Common collections to check
    const collectionsToCheck = [
      'userStats',
      'userProgress',
      'achievements',
      'streaks',
      'flashcards',
      'reviewSessions',
      'watchHistory',
      'leaderboard',
      'preferences',
      'subscriptions'
    ];

    // Check top-level collections
    for (const collectionName of collectionsToCheck) {
      console.log(`📚 ${collectionName.toUpperCase()}`);
      console.log('-'.repeat(80));

      try {
        // Try to find user-specific data
        const snapshot = await db.collection(collectionName)
          .where('userId', '==', userId)
          .limit(10)
          .get();

        if (!snapshot.empty) {
          console.log(`Found ${snapshot.size} document(s)`);
          snapshot.forEach(doc => {
            console.log(`\n📄 Document ID: ${doc.id}`);
            console.log(JSON.stringify(doc.data(), null, 2));
          });
        } else {
          // Also check if there's a document with userId as the ID
          const directDoc = await db.collection(collectionName).doc(userId).get();
          if (directDoc.exists) {
            console.log(`📄 Document ID: ${userId}`);
            console.log(JSON.stringify(directDoc.data(), null, 2));
          } else {
            console.log('No data found in this collection');
          }
        }
      } catch (error) {
        console.log(`Error checking collection: ${error.message}`);
      }
      console.log();
    }

    console.log('='.repeat(80));
    console.log('✅ DATA FETCH COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Error fetching user data:', error);
  } finally {
    process.exit(0);
  }
}

viewUserData();
