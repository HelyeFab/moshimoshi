const admin = require('firebase-admin');

const serviceAccount = require('/home/beano/DevProjects/NextJs/moshimoshi/moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkDeckUpdate() {
  try {
    const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';
    const deckId = 'ce09ced7-d1f5-4734-a5a8-434c0134194a'; // Japanese-animals deck

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
    console.log('  Description:', deckData.description);
    console.log('  Card Count:', deckData.cards?.length || 0);
    console.log('  Source:', deckData.source || 'user');
    console.log('  Created:', new Date(deckData.createdAt).toISOString());
    console.log('  Updated:', new Date(deckData.updatedAt).toISOString());
    console.log('  Time since update:', Math.floor((Date.now() - deckData.updatedAt) / 1000), 'seconds ago');

    if (deckData.cards && deckData.cards.length > 0) {
      console.log('\n📝 Sample Cards (first 5):');
      deckData.cards.slice(0, 5).forEach((card, idx) => {
        console.log(`  ${idx + 1}. Front: ${card.front}`);
        console.log(`     Back: ${card.back}`);
        if (card.notes) console.log(`     Notes: ${card.notes}`);
        console.log('');
      });

      console.log(`📊 Total Cards: ${deckData.cards.length}`);
    }

    console.log('\n🔍 Sync Status:');
    const updateAge = Date.now() - deckData.updatedAt;
    if (updateAge < 60000) { // Less than 1 minute
      console.log('  ✅ Deck was recently updated (within last minute)');
      console.log('  ✅ Update sync appears to be working!');
    } else if (updateAge < 300000) { // Less than 5 minutes
      console.log('  ⚠️  Deck was updated', Math.floor(updateAge / 60000), 'minutes ago');
      console.log('  ⚠️  May or may not reflect your latest changes');
    } else {
      console.log('  ❌ Deck was updated', Math.floor(updateAge / 60000), 'minutes ago');
      console.log('  ❌ Does NOT reflect recent changes');
    }

  } catch (error) {
    console.error('Error checking deck:', error);
  } finally {
    process.exit(0);
  }
}

checkDeckUpdate();
