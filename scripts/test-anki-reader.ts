import fs from 'fs';
import { readAnkiPackage } from 'anki-reader';

async function testAnkiReader() {
  const filePath = '/home/beano/Downloads/Japanese_course_based_on_Tae_Kims_grammar_guide__anime.apkg';
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer]);

  console.log('Reading Anki package...');
  const { collection, media } = await readAnkiPackage(blob);

  const decks = collection.getDecks();
  console.log('\n=== DECKS ===');
  console.log(`Total decks: ${Object.keys(decks).length}`);

  for (const [deckId, deck] of Object.entries(decks)) {
    console.log(`\nDeck ID: ${deckId}`);
    console.log(`Deck Name: ${deck.getName()}`);

    const cards = deck.getCards();
    console.log(`Total cards: ${Object.keys(cards).length}`);

    // Show first 3 cards
    const cardEntries = Object.entries(cards).slice(0, 3);
    console.log('\n=== FIRST 3 CARDS ===');

    for (const [cardId, card] of cardEntries) {
      console.log(`\n--- Card ${cardId} ---`);
      console.log(`Deck ID: ${card.getDeckId()}`);
      console.log(`Note ID: ${card.getNoteId()}`);
      console.log(`Model ID: ${card.getModelId()}`);

      const fields = card.getFields();
      console.log(`\nFields (${Object.keys(fields).length}):`);
      for (const [fieldName, fieldValue] of Object.entries(fields)) {
        const preview = fieldValue.substring(0, 100);
        console.log(`  ${fieldName}: ${preview}${fieldValue.length > 100 ? '...' : ''}`);
      }

      console.log(`\nFront:`);
      console.log(card.getFront().substring(0, 200));

      console.log(`\nBack:`);
      console.log(card.getBack().substring(0, 200));
    }
  }

  console.log(`\n=== MEDIA FILES ===`);
  console.log(`Total media: ${Object.keys(media).length}`);
  console.log(`Sample media files:`, Object.keys(media).slice(0, 5));
}

testAnkiReader().catch(console.error);
