const admin = require('firebase-admin');

const serviceAccount = require('/home/beano/DevProjects/NextJs/moshimoshi/moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function testUpdateSync() {
  try {
    const deckId = 'ce09ced7-d1f5-4734-a5a8-434c0134194a';

    console.log('🔍 Current deck state in Firebase...\n');

    const deckDoc = await db.collection('flashcardDecks').doc(deckId).get();
    const deckData = deckDoc.data();

    console.log('BEFORE:');
    console.log('  Name:', deckData.name);
    console.log('  Description:', deckData.description || '(empty)');
    console.log('  Updated:', new Date(deckData.updatedAt).toLocaleString());
    console.log('  Card Count:', deckData.cards?.length || 0);

    // Now let's manually update it to test the sync
    console.log('\n✏️  Updating deck with test description...\n');

    const testDescription = 'TEST UPDATE - ' + new Date().toLocaleTimeString();

    await db.collection('flashcardDecks').doc(deckId).update({
      description: testDescription,
      updatedAt: Date.now()
    });

    console.log('✅ Deck updated in Firebase');

    // Read it back
    const updatedDoc = await db.collection('flashcardDecks').doc(deckId).get();
    const updatedData = updatedDoc.data();

    console.log('\nAFTER:');
    console.log('  Name:', updatedData.name);
    console.log('  Description:', updatedData.description);
    console.log('  Updated:', new Date(updatedData.updatedAt).toLocaleString());
    console.log('  Card Count:', updatedData.cards?.length || 0);

    console.log('\n📋 INSTRUCTIONS:');
    console.log('  1. Now click "Sync All" in the UI');
    console.log('  2. Check if the description changes to:', testDescription);
    console.log('  3. This will verify that Firebase → Local sync is working');
    console.log('  4. Then edit the deck in the UI and save');
    console.log('  5. Check the browser console for sync logs');
    console.log('  6. Run check-animals-deck-detailed.js to verify Local → Firebase sync');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

testUpdateSync();
