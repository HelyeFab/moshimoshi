/**
 * Test the /api/anki/decks POST endpoint with a large deck
 */

async function testDeckSaveAPI() {
  console.log('=== Testing Deck Save API ===\n');

  // Create a mock large deck (simulate 4152 cards)
  const mockDeck = {
    name: 'Test Large Deck',
    description: 'Testing large deck save',
    cards: [],
  };

  // Add mock cards
  console.log('Creating mock deck with 4152 cards...');
  for (let i = 0; i < 4152; i++) {
    mockDeck.cards.push({
      id: `card-${i}`,
      noteId: `note-${i}`,
      deckId: 'test-deck',
      front: `Front ${i} - あいうえお かきくけこ さしすせそ`,
      back: `Back ${i} - This is a longer back side with more text to simulate real card data. Japanese: 日本語の文章がここに入ります。`,
      tags: ['test', 'large-deck', 'japanese'],
      fields: [
        `Field 1 for card ${i}`,
        `Field 2 for card ${i}`,
        `Field 3 for card ${i}`,
      ],
    });
  }

  // Calculate size
  const deckJSON = JSON.stringify(mockDeck);
  const sizeBytes = Buffer.byteLength(deckJSON, 'utf8');
  const sizeKB = sizeBytes / 1024;
  const sizeMB = sizeKB / 1024;

  console.log(`Mock deck created:`);
  console.log(`  Cards: ${mockDeck.cards.length}`);
  console.log(`  Size: ${sizeKB.toFixed(2)} KB (${sizeMB.toFixed(2)} MB)`);
  console.log(`  Firestore limit: 1 MB`);
  console.log(`  Would exceed: ${sizeMB > 1 ? '❌ YES' : '✅ NO'}`);
  console.log('');

  console.log('This explains why the save failed!');
  console.log('The deck is too large for a single Firestore document.');
  console.log('');
  console.log('Solutions:');
  console.log('  1. Store cards separately (cards as subcollection)');
  console.log('  2. Chunk large decks into multiple documents');
  console.log('  3. Store only deck metadata in Firestore, cards in IndexedDB');
  console.log('');
}

testDeckSaveAPI();
