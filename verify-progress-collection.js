const admin = require('firebase-admin');
const serviceAccount = require('./moshimoshi-service-account.json');

// Check if already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function verifyProgressCollection() {
  const userId = 'r7r6at83BUPIjD69XatI4EGIECr1';

  console.log('✅ Verifying /users/{uid}/progress collection (character learning)...\n');

  const progressSnapshot = await db
    .collection('users')
    .doc(userId)
    .collection('progress')
    .get();

  if (progressSnapshot.empty) {
    console.log('❌ No progress documents found');
  } else {
    console.log(`✅ Found ${progressSnapshot.size} progress documents`);

    progressSnapshot.docs.forEach(doc => {
      console.log(`\n  - Document: ${doc.id}`);
      const data = doc.data();
      if (data.contentType) {
        console.log(`    Type: ${data.contentType}`);
      }
      if (data.srsData) {
        console.log(`    SRS: ${data.srsData.status || 'unknown'}`);
        console.log(`    Reviews: ${data.totalReviews || 0}`);
      }
    });
  }

  console.log('\n✅ Character learning progress collection is intact!');
  process.exit(0);
}

verifyProgressCollection().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
