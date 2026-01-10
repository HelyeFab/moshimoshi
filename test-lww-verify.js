const admin = require('firebase-admin');

const serviceAccount = require('/home/beano/DevProjects/NextJs/moshimoshi/moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function verifyLWW() {
  try {
    const deckId = 'ce09ced7-d1f5-4734-a5a8-434c0134194a';

    console.log('🔍 Verifying LWW Conflict Resolution...\n');

    const deckDoc = await db.collection('flashcardDecks').doc(deckId).get();
    const deckData = deckDoc.data();

    console.log('📊 Firebase State After Sync:');
    console.log('  Name:', deckData.name);
    console.log('  Description:', deckData.description);
    console.log('  Updated:', new Date(deckData.updatedAt).toLocaleString());
    console.log('  Timestamp:', deckData.updatedAt);

    const updateAge = Date.now() - deckData.updatedAt;
    console.log('  Age:', Math.floor(updateAge / 1000), 'seconds ago');

    console.log('\n🧪 TEST RESULT:');

    if (deckData.description && deckData.description.includes('🟢 NEWER VERSION')) {
      console.log('  ✅ PASS: Local version won (newer timestamp)');
      console.log('  ✅ LWW conflict resolution is working correctly!');
      if (updateAge < 60000) {
        console.log('  ✅ Timestamp is recent (< 1 minute ago)');
      }
    } else if (deckData.description && deckData.description.includes('🔴 OLDER VERSION')) {
      console.log('  ❌ FAIL: Firebase version won (older timestamp)');
      console.log('  ❌ LWW conflict resolution is NOT working!');
      console.log('  ❌ The older Firebase version should have been overwritten');
    } else {
      console.log('  ⚠️  INCONCLUSIVE: Description does not match test values');
      console.log('  ⚠️  Did you edit the deck with the test description?');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

verifyLWW();
