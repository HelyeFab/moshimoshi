const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'moshimoshi-de237'
});

const email = 'charles@beano.com';

async function checkUserProfile() {
  try {
    // Get user from Auth
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log('User ID:', userRecord.uid);

    // Check Firestore profile
    const userDoc = await admin.firestore().collection('users').doc(userRecord.uid).get();

    if (userDoc.exists) {
      console.log('✅ Firestore profile exists');
      console.log(JSON.stringify(userDoc.data(), null, 2));
    } else {
      console.log('❌ Firestore profile MISSING - creating it now...');

      await admin.firestore().collection('users').doc(userRecord.uid).set({
        email: email,
        displayName: 'Charles Test User',
        createdAt: new Date(),
        updatedAt: new Date(),
        tier: 'free',
        userState: 'active',
        emailVerified: true,
        subscription: {
          status: 'inactive',
          plan: 'free'
        }
      });

      console.log('✅ Firestore profile created!');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkUserProfile();
