
import { AnkiParser } from '../src/lib/anki/parser';

const fs = require('fs');

async function test() {
  try {
    const fileBuffer = fs.readFileSync('/home/beano/Downloads/Japanese_course_based_on_Tae_Kims_grammar_guide__anime.apkg');
    console.log('\n🔍 Attempting to parse anki21b file...');
    console.log('');

    const result = await AnkiParser.parseApkg(fileBuffer);

    console.log('\n✅ SUCCESS! File parsed successfully!');
    console.log('');
    console.log('📊 Parse Results:');
    console.log('  - Deck name:', result.deckName);
    console.log('  - Total cards:', result.cards?.length || 0);
    console.log('  - Has media:', result.media ? Object.keys(result.media).length : 0, 'files');
    console.log('');

    if (result.cards && result.cards.length > 0) {
      console.log('📇 Sample card (first card):');
      const firstCard = result.cards[0];
      console.log('  - Front:', firstCard.front?.substring(0, 100) || 'N/A');
      console.log('  - Back:', firstCard.back?.substring(0, 100) || 'N/A');
      console.log('');
    }

    console.log('🎉 anki21b format is now supported!');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ FAILED to parse file');
    console.error('');
    console.error('Error:', error.message);
    console.error('');

    if (error.stack) {
      console.error('Stack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

test();
