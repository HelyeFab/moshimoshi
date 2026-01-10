const admin = require('firebase-admin');

const serviceAccount = require('/home/beano/DevProjects/NextJs/moshimoshi/moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkAnkiDecks() {
  try {
    const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

    console.log('🔍 Checking for Anki decks in Firebase...\n');

    const snapshot = await db.collection('flashcardDecks')
      .where('userId', '==', userId)
      .get();

    const ankiDecks = snapshot.docs.filter(doc => doc.data().source === 'anki');
    const userDecks = snapshot.docs.filter(doc => doc.data().source !== 'anki');

    console.log('📊 Firebase Deck Summary:');
    console.log(`  Total decks: ${snapshot.docs.length}`);
    console.log(`  User decks (should be synced): ${userDecks.length}`);
    console.log(`  Anki decks (should be ZERO): ${ankiDecks.length}`);

    if (ankiDecks.length > 0) {
      console.log('\n❌ CRITICAL ERROR: Anki decks found in Firebase!');
      console.log('\nAnki decks that should NOT be here:');
      ankiDecks.forEach(doc => {
        const data = doc.data();
        console.log(`  - ${data.name} (ID: ${doc.id})`);
      });
      console.log('\n⚠️  This violates the architecture requirement!');
      console.log('   Anki decks should only be in R2, never in Firebase flashcardDecks collection.');
    } else {
      console.log('\n✅ PASS: No Anki decks in Firebase (correct!)');
      console.log('   Anki filtering is working as expected.');
    }

    console.log('\n📋 User Decks in Firebase:');
    userDecks.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${data.name} (source: ${data.source || 'user'})`);
    });

    console.log('\n📝 TEST INSTRUCTIONS:');
    console.log('  1. Import an Anki deck in the UI (if you have one)');
    console.log('  2. Click "Sync All" button');
    console.log('  3. Run this script again: node check-anki-decks.js');
    console.log('  4. Expected: Anki deck count should still be ZERO');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkAnkiDecks();
