const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkDeck() {
  try {
    console.log('📊 Checking "Addinc Card" deck...\n');

    const snapshot = await db.collection('flashcardDecks')
      .where('name', '==', 'Addinc Card - new')
      .get();

    if (snapshot.empty) {
      console.log('❌ Deck "Addinc Card" not found in Firebase');
      return;
    }

    const doc = snapshot.docs[0];
    const deck = doc.data();
    const updatedDate = new Date(deck.updatedAt);
    const createdDate = new Date(deck.createdAt);

    console.log(`Deck: "${deck.name}"`);
    console.log(`ID: ${doc.id}`);
    console.log(`Total Cards: ${deck.cards?.length || 0}`);
    console.log(`Created: ${createdDate.toLocaleString()}`);
    console.log(`Updated: ${updatedDate.toLocaleString()}`);
    console.log(`\n${'='.repeat(80)}\n`);

    if (deck.cards && deck.cards.length > 0) {
      console.log(`📝 ALL ${deck.cards.length} CARDS:\n`);

      deck.cards.forEach((card, i) => {
        const frontText = card.front?.text || card.front;
        const backText = card.back?.text || card.back;
        const frontImage = card.front?.image;
        const backImage = card.back?.image;

        console.log(`${i + 1}. Card ID: ${card.id || 'NO ID'}`);
        console.log(`   Front: "${frontText}"`);
        if (frontImage) {
          console.log(`   🖼️  Front Image: ${frontImage.url?.substring(0, 60)}...`);
        }
        console.log(`   Back: "${backText}"`);
        if (backImage) {
          console.log(`   🖼️  Back Image: ${backImage.url?.substring(0, 60)}...`);
        }

        // Show metadata if exists
        if (card.metadata) {
          const meta = card.metadata;
          if (meta.status) console.log(`   Status: ${meta.status}`);
          if (meta.notes) console.log(`   Notes: ${meta.notes}`);
          if (meta.easeFactor) console.log(`   Ease Factor: ${meta.easeFactor}`);
          if (meta.interval) console.log(`   Interval: ${meta.interval} days`);
        }
        console.log('');
      });

      // Show last 5 cards specifically
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🆕 LAST 5 CARDS (Most Recently Added):\n`);

      const lastFive = deck.cards.slice(-5);
      lastFive.forEach((card, i) => {
        const actualIndex = deck.cards.length - 5 + i;
        const frontText = card.front?.text || card.front;
        const backText = card.back?.text || card.back;
        const hasImage = card.front?.image || card.back?.image;

        console.log(`Card #${actualIndex + 1}: "${frontText}" → "${backText}"${hasImage ? ' 🖼️' : ''}`);
        if (card.front?.image) {
          console.log(`   Front Image URL: ${card.front.image.url}`);
        }
        if (card.back?.image) {
          console.log(`   Back Image URL: ${card.back.image.url}`);
        }
      });
    }

  } catch (error) {
    console.error('❌ Error checking deck:', error);
  } finally {
    process.exit(0);
  }
}

checkDeck();
