const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'moshimoshi-de237.firebasestorage.app'
});

const bucket = admin.storage().bucket();
const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

async function checkStorage() {
  try {
    // List all files in user's anki-media folder
    const [files] = await bucket.getFiles({
      prefix: `anki-media/${userId}/`
    });

    console.log('🗄️  Firebase Storage - Anki Media Files:\n');

    if (files.length === 0) {
      console.log('  ❌ No files found in Firebase Storage');
      console.log(`  Path checked: anki-media/${userId}/\n`);
    } else {
      console.log(`  ✅ Found ${files.length} files in Firebase Storage\n`);

      // Group by deck
      const byDeck = {};
      let totalSize = 0;

      files.forEach(file => {
        const pathParts = file.name.split('/');
        const deckId = pathParts[2] || 'unknown';

        if (!byDeck[deckId]) {
          byDeck[deckId] = { count: 0, size: 0, files: [] };
        }

        const size = parseInt(file.metadata.size || 0);
        byDeck[deckId].count++;
        byDeck[deckId].size += size;
        totalSize += size;

        // Keep first 3 filenames as samples
        if (byDeck[deckId].files.length < 3) {
          byDeck[deckId].files.push({
            name: pathParts[3],
            size: size
          });
        }
      });

      // Print summary
      console.log('  📊 By Deck:\n');
      Object.keys(byDeck).forEach(deckId => {
        const deck = byDeck[deckId];
        console.log(`    Deck ID: ${deckId}`);
        console.log(`    Files: ${deck.count}`);
        console.log(`    Total Size: ${(deck.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`    Sample files:`);
        deck.files.forEach(f => {
          console.log(`      - ${f.name} (${(f.size / 1024).toFixed(2)} KB)`);
        });
        if (deck.count > 3) {
          console.log(`      ... and ${deck.count - 3} more files`);
        }
        console.log('');
      });

      console.log(`  📦 Total: ${files.length} files, ${(totalSize / 1024 / 1024).toFixed(2)} MB\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

checkStorage();
