const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'moshimoshi-de237.firebasestorage.app'
});

const db = admin.firestore();
const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

async function verifyMetadata() {
  try {
    console.log('🔍 Verifying media metadata in Firestore...\n');

    // First, check one deck's media directly
    const decksSnapshot = await db
      .collection('users').doc(userId)
      .collection('ankiDecks')
      .limit(1)
      .get();

    if (decksSnapshot.empty) {
      console.log('❌ No ankiDecks found');
      process.exit(0);
    }

    const deckId = decksSnapshot.docs[0].id;
    console.log(`✅ Found deck: ${deckId}\n`);

    // Check media in this deck
    const mediaSnapshot = await db
      .collection('users').doc(userId)
      .collection('ankiDecks').doc(deckId)
      .collection('media')
      .limit(10)
      .get();

    console.log(`📦 Found ${mediaSnapshot.size} media files in this deck\n`);

    if (!mediaSnapshot.empty) {
      console.log('Sample metadata:');
      mediaSnapshot.docs.slice(0, 3).forEach(doc => {
        const data = doc.data();
        console.log(`  - ${data.filename} (${(data.size / 1024).toFixed(2)} KB)`);
      });
    }

    console.log('\n🔍 Now trying collectionGroup query (what quota endpoint uses)...\n');

    // Try without where clause first
    const allMediaSnapshot = await db
      .collectionGroup('media')
      .limit(10)
      .get();

    console.log(`✅ CollectionGroup query returned ${allMediaSnapshot.size} results (no filter)\n`);

    // Now try with userId filter (this is what fails)
    console.log('Trying with userId filter...');
    const userMediaSnapshot = await db
      .collectionGroup('media')
      .where('userId', '==', userId)
      .get();

    console.log(`✅ Found ${userMediaSnapshot.size} media files for user via collectionGroup\n`);

    let totalSize = 0;
    userMediaSnapshot.forEach(doc => {
      totalSize += doc.data().size || 0;
    });

    console.log(`💾 Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('FAILED_PRECONDITION')) {
      console.log('\n⚠️  This means Firestore index is missing.');
      console.log('The index will be created automatically when you use the query from your app.');
      console.log('It may take a few minutes to build.');
    }
  }

  process.exit(0);
}

verifyMetadata();
