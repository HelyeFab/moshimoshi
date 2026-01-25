const admin = require('firebase-admin');
const path = require('path');
const readline = require('readline');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'moshimoshi-de237'
});

const db = admin.firestore();

// Get userId from command line argument or use default
const userId = process.argv[2];

if (!userId) {
  console.error('❌ Usage: node delete-user.js <userId>');
  console.error('   Example: node delete-user.js bPhnM9Lmy2ToZXAScBl120zfxkL');
  process.exit(1);
}

// Collections that may contain user data (with userId field)
const collectionsWithUserIdField = [
  'review_sessions',
  'review_items',
  'review_sets',
  'user_mnemonics',
  'mnemonic_regenerations',
  'userStats',
  'userProgress',
  'achievements',
  'streaks',
  'flashcards',
  'reviewSessions',
  'watchHistory',
  'leaderboard',
  'preferences',
  'subscriptions',
  'translations',
  'translation_cache'
];

// Collections where the document ID might be the userId
const collectionsWithUserIdAsDocId = [
  'users',
  'userStats',
  'userProgress',
  'preferences',
  'subscriptions'
];

async function deleteSubcollections(docRef) {
  const subcollections = await docRef.listCollections();
  let deletedCount = 0;

  for (const subcol of subcollections) {
    const docs = await subcol.get();
    const batch = db.batch();
    let batchCount = 0;

    for (const doc of docs.docs) {
      // Recursively delete subcollections of this doc
      deletedCount += await deleteSubcollections(doc.ref);

      batch.delete(doc.ref);
      batchCount++;

      // Firestore batch limit is 500
      if (batchCount >= 450) {
        await batch.commit();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    deletedCount += docs.size;
    console.log(`   └─ Deleted ${docs.size} docs from subcollection: ${subcol.id}`);
  }

  return deletedCount;
}

async function deleteUserData() {
  console.log('='.repeat(80));
  console.log(`🔍 CHECKING USER DATA FOR: ${userId}`);
  console.log('='.repeat(80));
  console.log();

  let totalDeleted = 0;
  const summary = [];

  try {
    // 1. Get authentication details first
    console.log('📧 AUTHENTICATION DETAILS');
    console.log('-'.repeat(80));
    let userRecord = null;
    try {
      userRecord = await admin.auth().getUser(userId);
      console.log('Email:', userRecord.email);
      console.log('Display Name:', userRecord.displayName || 'Not set');
      console.log('Created:', new Date(userRecord.metadata.creationTime).toISOString());
      console.log('Last Sign In:', new Date(userRecord.metadata.lastSignInTime).toISOString());
      summary.push({ collection: 'Firebase Auth', count: 1 });
    } catch (error) {
      console.log('⚠️  No auth record found:', error.message);
    }
    console.log();

    // 2. Check user document and subcollections
    console.log('👤 USER PROFILE (users collection)');
    console.log('-'.repeat(80));
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      console.log('Found user document');
      const data = userDoc.data();
      console.log('Email:', data.email);
      console.log('Display Name:', data.displayName || data.name || 'Not set');

      // Check subcollections
      const subcollections = await db.collection('users').doc(userId).listCollections();
      if (subcollections.length > 0) {
        console.log('Subcollections:', subcollections.map(col => col.id).join(', '));
        for (const subcol of subcollections) {
          const subDocs = await subcol.get();
          summary.push({ collection: `users/${userId}/${subcol.id}`, count: subDocs.size });
        }
      }
      summary.push({ collection: 'users', count: 1 });
    } else {
      console.log('No user profile found');
    }
    console.log();

    // 3. Check collections with userId field
    for (const collectionName of collectionsWithUserIdField) {
      console.log(`📚 Checking ${collectionName}...`);
      try {
        const snapshot = await db.collection(collectionName)
          .where('userId', '==', userId)
          .get();

        if (!snapshot.empty) {
          console.log(`   Found ${snapshot.size} document(s)`);
          summary.push({ collection: collectionName, count: snapshot.size });
        }
      } catch (error) {
        // Collection might not exist or have different structure
      }
    }

    // 4. Check Stripe mappings
    console.log('💳 Checking Stripe mappings...');
    try {
      const uidToCustomer = await db.collection('stripe').doc('mappings').collection('uidToCustomer').doc(userId).get();
      if (uidToCustomer.exists) {
        const customerId = uidToCustomer.data()?.customerId;
        console.log(`   Found uidToCustomer mapping: ${customerId}`);
        summary.push({ collection: 'stripe/mappings/uidToCustomer', count: 1 });

        if (customerId) {
          const customerToUid = await db.collection('stripe').doc('mappings').collection('customerToUid').doc(customerId).get();
          if (customerToUid.exists) {
            console.log(`   Found customerToUid mapping`);
            summary.push({ collection: 'stripe/mappings/customerToUid', count: 1 });
          }
        }
      }
    } catch (error) {
      // Stripe collection might not exist
    }

    console.log();
    console.log('='.repeat(80));
    console.log('📊 SUMMARY OF DATA TO DELETE');
    console.log('='.repeat(80));

    if (summary.length === 0) {
      console.log('No data found for this user.');
      process.exit(0);
    }

    for (const item of summary) {
      console.log(`   ${item.collection}: ${item.count} document(s)`);
    }
    console.log();

    // Confirm deletion
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise((resolve) => {
      rl.question('⚠️  Are you sure you want to DELETE all this data? (type "yes" to confirm): ', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Deletion cancelled.');
      process.exit(0);
    }

    console.log();
    console.log('🗑️  DELETING USER DATA...');
    console.log('='.repeat(80));

    // Delete user document and subcollections
    if (userDoc.exists) {
      console.log('Deleting user document and subcollections...');
      const subDeleted = await deleteSubcollections(db.collection('users').doc(userId));
      await db.collection('users').doc(userId).delete();
      totalDeleted += 1 + subDeleted;
      console.log('   ✅ User document deleted');
    }

    // Delete from collections with userId field
    for (const collectionName of collectionsWithUserIdField) {
      try {
        const snapshot = await db.collection(collectionName)
          .where('userId', '==', userId)
          .get();

        if (!snapshot.empty) {
          console.log(`Deleting from ${collectionName}...`);
          const batch = db.batch();
          let batchCount = 0;

          for (const doc of snapshot.docs) {
            batch.delete(doc.ref);
            batchCount++;

            if (batchCount >= 450) {
              await batch.commit();
              batchCount = 0;
            }
          }

          if (batchCount > 0) {
            await batch.commit();
          }

          totalDeleted += snapshot.size;
          console.log(`   ✅ Deleted ${snapshot.size} document(s)`);
        }
      } catch (error) {
        // Collection might not exist
      }
    }

    // Delete Stripe mappings
    try {
      const uidToCustomer = await db.collection('stripe').doc('mappings').collection('uidToCustomer').doc(userId).get();
      if (uidToCustomer.exists) {
        const customerId = uidToCustomer.data()?.customerId;
        console.log('Deleting Stripe mappings...');

        await db.collection('stripe').doc('mappings').collection('uidToCustomer').doc(userId).delete();
        totalDeleted++;
        console.log('   ✅ Deleted uidToCustomer mapping');

        if (customerId) {
          const customerToUid = await db.collection('stripe').doc('mappings').collection('customerToUid').doc(customerId).get();
          if (customerToUid.exists) {
            await db.collection('stripe').doc('mappings').collection('customerToUid').doc(customerId).delete();
            totalDeleted++;
            console.log('   ✅ Deleted customerToUid mapping');
          }
        }
      }
    } catch (error) {
      // Stripe collection might not exist
    }

    // Delete Firebase Auth user last
    if (userRecord) {
      console.log('Deleting Firebase Auth user...');
      await admin.auth().deleteUser(userId);
      totalDeleted++;
      console.log('   ✅ Firebase Auth user deleted');
    }

    console.log();
    console.log('='.repeat(80));
    console.log(`✅ DELETION COMPLETE - ${totalDeleted} total items deleted`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error during deletion:', error);
  } finally {
    process.exit(0);
  }
}

deleteUserData();
