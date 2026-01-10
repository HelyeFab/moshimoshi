const admin = require('firebase-admin');

const serviceAccount = require('/home/beano/DevProjects/NextJs/moshimoshi/moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function testDeletion() {
  try {
    const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

    console.log('🗑️  Test 6: Bidirectional Deletion Test\n');

    // List current decks
    const snapshot = await db.collection('flashcardDecks')
      .where('userId', '==', userId)
      .get();

    console.log('📊 Current decks in Firebase:');
    snapshot.docs.forEach((doc, idx) => {
      const data = doc.data();
      console.log(`  ${idx + 1}. ${data.name} (ID: ${doc.id})`);
    });

    // Delete the Colors deck
    const colorsDeck = snapshot.docs.find(doc => doc.data().name.includes('Colors') || doc.data().name.includes('色'));

    if (colorsDeck) {
      console.log(`\n🎯 Deleting: ${colorsDeck.data().name}`);
      await db.collection('flashcardDecks').doc(colorsDeck.id).delete();
      console.log('✅ Deck deleted from Firebase');

      console.log('\n📋 TEST INSTRUCTIONS:');
      console.log('  1. Check your UI - the Colors deck should still be visible locally');
      console.log('  2. Click "Sync All" button');
      console.log('  3. The Colors deck should disappear from your UI');
      console.log('  4. This confirms Firebase → Local deletion sync works!');
    } else {
      console.log('\n⚠️  Colors deck not found. Choose another deck to delete:');
      console.log('  Which deck number should I delete? (1-' + snapshot.docs.length + ')');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

testDeletion();
