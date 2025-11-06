const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'moshimoshi-de237'
});

const db = admin.firestore();
const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

async function viewUserData() {
  console.log('='.repeat(80));
  console.log(`FIREBASE USER DATA FOR: ${userId}`);
  console.log('='.repeat(80));
  console.log();

  try {
    // Get authentication details
    console.log('📧 AUTHENTICATION DETAILS');
    console.log('-'.repeat(80));
    try {
      const userRecord = await admin.auth().getUser(userId);
      console.log('Email:', userRecord.email);
      console.log('Email Verified:', userRecord.emailVerified);
      console.log('Display Name:', userRecord.displayName || 'Not set');
      console.log('Photo URL:', userRecord.photoURL || 'Not set');
      console.log('Created:', new Date(userRecord.metadata.creationTime).toISOString());
      console.log('Last Sign In:', new Date(userRecord.metadata.lastSignInTime).toISOString());
      console.log('Disabled:', userRecord.disabled);
      console.log('Custom Claims:', JSON.stringify(userRecord.customClaims || {}, null, 2));
    } catch (error) {
      console.log('Error fetching auth details:', error.message);
    }
    console.log();

    // Common collections to check
    const collectionsToCheck = [
      'users',
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

    // Check top-level collections
    for (const collectionName of collectionsToCheck) {
      if (collectionName === 'users') continue; // Already checked

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
