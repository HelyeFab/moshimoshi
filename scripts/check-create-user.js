const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'moshimoshi-de237'
});

const email = 'charles@beano.com';
const password = 'Beano200419!';

async function checkAndCreateUser() {
  try {
    // Try to get user by email
    console.log(`Checking if user ${email} exists...`);
    let userRecord;

    try {
      userRecord = await admin.auth().getUserByEmail(email);
      console.log('✅ User exists!');
      console.log('User ID:', userRecord.uid);
      console.log('Email:', userRecord.email);
      console.log('Email Verified:', userRecord.emailVerified);
      console.log('Created:', userRecord.metadata.creationTime);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.log('❌ User does not exist. Creating user...');

        // Create the user
        userRecord = await admin.auth().createUser({
          email: email,
          password: password,
          emailVerified: true, // Auto-verify for testing
          displayName: 'Charles Test User'
        });

        console.log('✅ User created successfully!');
        console.log('User ID:', userRecord.uid);
        console.log('Email:', userRecord.email);

        // Create user profile in Firestore
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

        console.log('✅ User profile created in Firestore');
      } else {
        throw error;
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkAndCreateUser();
