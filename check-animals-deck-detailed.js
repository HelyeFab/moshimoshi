const admin = require('firebase-admin');

const serviceAccount = require('/home/beano/DevProjects/NextJs/moshimoshi/moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkDeckUpdate() {
  try {
    const deckId = 'ce09ced7-d1f5-4734-a5a8-434c0134194a';

    console.log('🔍 Checking Japanese-animals deck in Firebase...\n');

    const deckDoc = await db.collection('flashcardDecks').doc(deckId).get();

    if (!deckDoc.exists) {
      console.log('❌ Deck NOT FOUND');
      return;
    }

    const deckData = deckDoc.data();

    console.log('✅ Japanese-animals deck FOUND in Firebase\n');
    console.log('Deck Details:');
    console.log('  ID:', deckDoc.id);
    console.log('  Name:', deckData.name);
    console.log('  Card Count:', deckData.cards?.length || 0);
    console.log('  Created:', new Date(deckData.createdAt).toLocaleString());
    console.log('  Updated:', new Date(deckData.updatedAt).toLocaleString());

    const updateAge = Date.now() - deckData.updatedAt;
    const minutesAgo = Math.floor(updateAge / 60000);
    const secondsAgo = Math.floor((updateAge % 60000) / 1000);

    console.log(`  Time since update: ${minutesAgo}m ${secondsAgo}s ago`);

    if (deckData.cards && deckData.cards.length > 0) {
      console.log('\n📝 First 3 Cards:');
      deckData.cards.slice(0, 3).forEach((card, idx) => {
        console.log(`\n  Card ${idx + 1}:`);
        console.log('    ', JSON.stringify(card, null, 2).split('\n').join('\n    '));
      });
    }

    console.log('\n🔍 Sync Status:');
    if (updateAge < 60000) {
      console.log('  ✅ Updated within last minute - sync working!');
    } else if (updateAge < 180000) {
      console.log(`  ⚠️  Updated ${minutesAgo} minutes ago - may be stale`);
    } else {
      console.log(`  ❌ Updated ${minutesAgo} minutes ago - changes NOT synced`);
    }

  } catch (error) {
    console.error('Error checking deck:', error);
  } finally {
    process.exit(0);
  }
}

checkDeckUpdate();
