const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function searchDecks() {
  try {
    console.log('🔍 Searching for decks with "Addinc" or similar...\n');

    const snapshot = await db.collection('flashcardDecks')
      .orderBy('updatedAt', 'desc')
      .limit(10)
      .get();

    if (snapshot.empty) {
      console.log('❌ No decks found');
      return;
    }

    console.log(`Found ${snapshot.size} recent decks:\n`);

    snapshot.forEach((doc, index) => {
      const deck = doc.data();
      const updatedDate = new Date(deck.updatedAt);

      console.log(`${index + 1}. "${deck.name}"`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Cards: ${deck.cards?.length || 0}`);
      console.log(`   Updated: ${updatedDate.toLocaleString()}`);
      console.log('');
    });

    // Ask user to confirm which deck
    console.log('\n💡 Please tell me the exact deck name you want to check');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

searchDecks();
