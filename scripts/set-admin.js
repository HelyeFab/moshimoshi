/**
 * Script to set a user as admin in Firestore
 * Run with: node scripts/set-admin.js <user-email>
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
  require('fs').readFileSync(path.join(__dirname, '../firebase-admin-key.json'), 'utf8')
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function setUserAsAdmin(email) {
  if (!email) {
    console.error('Please provide an email address');
    console.log('Usage: node scripts/set-admin.js <user-email>');
    process.exit(1);
  }

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

    console.log(`Found user: ${email} (${userId})`);
    console.log('Current admin status:', userData.admin || false);

    // Set admin to true
    await db.collection('users').doc(userId).update({
      admin: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Successfully set ${email} as admin`);

    // Verify the update
    const updatedDoc = await db.collection('users').doc(userId).get();
    const updatedData = updatedDoc.data();
    console.log('Verified admin status:', updatedData.admin);

  } catch (error) {
    console.error('Error setting admin status:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Get email from command line arguments
const email = process.argv[2];
setUserAsAdmin(email);