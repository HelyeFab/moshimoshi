const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin with service account
const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkUserPreferences() {
  try {
    console.log('\n🔍 Checking preferences in Firebase...\n');

    // Your user ID
    const userId = 'r7r6at83BUPIjD69XatI4EGIECr1';

    // Check if user document exists
    console.log('1. Checking user document...');
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      console.log('✅ User document exists');
      console.log('User data:', userDoc.data());
    } else {
      console.log('❌ User document does not exist');
    }

    // Check preferences subcollection
    console.log('\n2. Checking preferences subcollection...');
    const prefsCollection = userRef.collection('preferences');
    const prefsSnapshot = await prefsCollection.get();

    if (prefsSnapshot.empty) {
      console.log('❌ No preferences documents found');
    } else {
      console.log(`✅ Found ${prefsSnapshot.size} preference document(s):`);
      prefsSnapshot.forEach(doc => {
        console.log(`  - Document ID: ${doc.id}`);
        console.log('    Data:', JSON.stringify(doc.data(), null, 2));
      });
    }

    // Check specific settings document
    console.log('\n3. Checking settings document specifically...');
    const settingsRef = userRef.collection('preferences').doc('settings');
    const settingsDoc = await settingsRef.get();

    if (settingsDoc.exists) {
      console.log('✅ Settings document exists');
      console.log('Settings data:', JSON.stringify(settingsDoc.data(), null, 2));
    } else {
      console.log('❌ Settings document does not exist');

      // Try to create a test preferences document
      console.log('\n4. Creating test preferences document...');
      const testPrefs = {
        userId: userId,
        theme: 'dark',
        language: 'en',
        palette: 'sakura',
        notifications: {
          dailyReminder: true,
          achievementAlerts: true,
          weeklyProgress: false,
          marketingEmails: false,
        },
        learning: {
          autoplay: true,
          furigana: true,
          romaji: false,
          soundEffects: true,
          hapticFeedback: true,
        },
        privacy: {
          publicProfile: false,
          showProgress: true,
          shareAchievements: false,
        },
        accessibility: {
          largeText: false,
          highContrast: false,
          reduceMotion: false,
          screenReader: false,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        syncedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await settingsRef.set(testPrefs);
      console.log('✅ Test preferences document created successfully');
      console.log('\nYou should now be able to see this in Firebase Console:');
      console.log(`Path: users/${userId}/preferences/settings`);
    }

    // List all collections under user
    console.log('\n5. Listing all subcollections under user...');
    const collections = await userRef.listCollections();
    console.log('Subcollections found:');
    for (const collection of collections) {
      console.log(`  - ${collection.id}`);
      const snapshot = await collection.limit(1).get();
      console.log(`    Document count: ${snapshot.size}`);
    }

  } catch (error) {
    console.error('Error checking preferences:', error);
  } finally {
    await admin.app().delete();
    process.exit();
  }
}

// Run the check
checkUserPreferences();