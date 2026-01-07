const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'moshimoshi-de237.firebasestorage.app'
});

const db = admin.firestore();
const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

async function listCollections() {
  try {
    console.log(`📁 Listing all collections under users/${userId}...\n`);

    const userRef = db.collection('users').doc(userId);
    const collections = await userRef.listCollections();

    if (collections.length === 0) {
      console.log('❌ No collections found under this user');
      process.exit(0);
    }

    console.log(`✅ Found ${collections.length} collections:\n`);

    for (const collection of collections) {
      console.log(`  📂 ${collection.id}`);

      const snapshot = await collection.limit(3).get();
      console.log(`     ${snapshot.size} documents (showing up to 3)`);

      snapshot.docs.forEach(doc => {
        console.log(`       - ${doc.id}`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

listCollections();
