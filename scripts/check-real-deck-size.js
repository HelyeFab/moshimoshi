/**
 * Check the ACTUAL size of the deck in Firebase
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkDeckSize() {
  console.log('=== Checking ACTUAL Deck Size in Firebase ===\n');

  try {
    const doc = await db.collection('flashcardDecks').doc('1').get();

    if (!doc.exists) {
      console.log('❌ Deck ID 1 not found');
      process.exit(1);
    }

    const data = doc.data();
    const dataStr = JSON.stringify(data);
    const sizeBytes = Buffer.byteLength(dataStr, 'utf8');
    const sizeKB = sizeBytes / 1024;
    const sizeMB = sizeKB / 1024;

    console.log('Deck name:', data.name);
    console.log('Card count:', data.cardCount || data.cards?.length || 0);
    console.log('');
    console.log('ACTUAL size in Firebase:');
    console.log('  Bytes:', sizeBytes.toLocaleString());
    console.log('  KB:', sizeKB.toFixed(2));
    console.log('  MB:', sizeMB.toFixed(4));
    console.log('');
    console.log('Firestore limit: 1 MB (1,048,576 bytes)');
    console.log('Used:', ((sizeBytes / 1048576) * 100).toFixed(2) + '%');
    console.log('Remaining space:', ((1048576 - sizeBytes) / 1024).toFixed(2), 'KB');
    console.log('');
    console.log('Status:', sizeMB > 1 ? '❌ EXCEEDS LIMIT' : '✅ Within limit');
    console.log('');

    // Calculate average card size
    if (data.cards && data.cards.length > 0) {
      const firstCard = data.cards[0];
      const cardStr = JSON.stringify(firstCard);
      const avgCardSize = Buffer.byteLength(cardStr, 'utf8');

      console.log('Card analysis:');
      console.log('  First card size:', avgCardSize, 'bytes');
      console.log('  Estimated avg per card:', avgCardSize, 'bytes');
      console.log('');
      console.log('Projection for 4152 cards:');
      const estimatedSize = (avgCardSize * 4152);
      const estimatedMB = estimatedSize / 1024 / 1024;
      console.log('  Total size:', (estimatedSize / 1024).toFixed(2), 'KB', '(' + estimatedMB.toFixed(2), 'MB)');
      console.log('  Would fit in Firestore:', estimatedMB <= 1 ? '✅ YES' : '❌ NO');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkDeckSize();
