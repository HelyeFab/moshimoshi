const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkDecks() {
  try {
    console.log('📊 Checking flashcardDecks collection...\n');

    const snapshot = await db.collection('flashcardDecks')
      .orderBy('updatedAt', 'desc')
      .limit(5)
      .get();

    if (snapshot.empty) {
      console.log('❌ No decks found in Firebase');
      return;
    }

    console.log(`✅ Found ${snapshot.size} recent decks:\n`);

    snapshot.forEach((doc, index) => {
      const deck = doc.data();
      const updatedDate = new Date(deck.updatedAt);
      const createdDate = new Date(deck.createdAt);

      console.log(`${index + 1}. Deck: "${deck.name}"`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   User: ${deck.userId}`);
      console.log(`   Cards: ${deck.cards?.length || 0}`);
      console.log(`   Created: ${createdDate.toLocaleString()}`);
      console.log(`   Updated: ${updatedDate.toLocaleString()}`);
      console.log(`   Source: ${deck.source || 'user'}`);
      console.log(`   Emoji: ${deck.emoji || '🎴'} Color: ${deck.color || 'primary'}`);

      // Show all cards
      if (deck.cards && deck.cards.length > 0) {
        console.log(`   \n   📝 Cards:`);
        deck.cards.forEach((card, i) => {
          const frontText = card.front?.text || card.front;
          const backText = card.back?.text || card.back;
          const hasImage = card.front?.image || card.back?.image;
          console.log(`      ${i + 1}. Front: "${frontText.substring(0, 50)}${frontText.length > 50 ? '...' : ''}"`);
          console.log(`         Back: "${backText.substring(0, 50)}${backText.length > 50 ? '...' : ''}"`);
          if (hasImage) {
            console.log(`         🖼️  Has image`);
          }
          if (card.id) {
            console.log(`         ID: ${card.id}`);
          }
        });
      }
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error checking decks:', error);
  } finally {
    process.exit(0);
  }
}

checkDecks();
