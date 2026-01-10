const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkDeckSize() {
  try {
    const snapshot = await db.collection('flashcardDecks')
      .where('name', '==', 'Addinc Card - new')
      .get();

    if (snapshot.empty) {
      console.log('❌ Deck not found');
      return;
    }

    const doc = snapshot.docs[0];
    const deck = doc.data();

    // Calculate approximate size
    const jsonString = JSON.stringify(deck);
    const sizeInBytes = Buffer.byteLength(jsonString, 'utf8');
    const sizeInKB = (sizeInBytes / 1024).toFixed(2);
    const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);

    console.log('\n📊 Deck Size Analysis:\n');
    console.log(`Deck: "${deck.name}"`);
    console.log(`Total Cards: ${deck.cards?.length || 0}`);
    console.log(`\nDocument Size:`);
    console.log(`  ${sizeInBytes} bytes`);
    console.log(`  ${sizeInKB} KB`);
    console.log(`  ${sizeInMB} MB`);
    console.log(`\n${sizeInMB < 1 ? '✅' : '❌'} Firestore Limit: 1 MB ${sizeInMB < 1 ? '(PASS)' : '(EXCEEDED!)'}`);

    // Check if any cards have images
    const cardsWithImages = deck.cards?.filter(c => c.front?.image || c.back?.image) || [];
    console.log(`\n🖼️  Cards with images: ${cardsWithImages.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkDeckSize();
