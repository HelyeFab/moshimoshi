const admin = require('firebase-admin');

const serviceAccount = require('/home/beano/DevProjects/NextJs/moshimoshi/moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function testDeletion() {
  try {
    const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

    console.log('🗑️  Testing Firebase → Local Deletion Sync\n');

    // List current decks
    const snapshot = await db.collection('flashcardDecks')
      .where('userId', '==', userId)
      .get();

    console.log('📊 Current decks in Firebase:');
    snapshot.docs.forEach((doc, idx) => {
      const data = doc.data();
      console.log(`  ${idx + 1}. ${data.name} (ID: ${doc.id})`);
    });

    // Find the flashcards-sample deck
    const sampleDeck = snapshot.docs.find(doc => doc.data().name === 'flashcards-sample');

    if (!sampleDeck) {
      console.log('\n⚠️  flashcards-sample deck not found. Using first deck instead...');
      const targetDeck = snapshot.docs[0];
      if (!targetDeck) {
        console.log('❌ No decks available to test deletion');
        return;
      }
      console.log(`\n📋 Will delete: ${targetDeck.data().name}`);
      console.log(`   ID: ${targetDeck.id}`);

      console.log('\n🔍 TEST INSTRUCTIONS:');
      console.log('  1. Note the deck name above');
      console.log('  2. Verify this deck exists in your UI');
      console.log('  3. Press ENTER to delete it from Firebase...');

      // Wait for user confirmation
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      await new Promise(resolve => {
        rl.question('Press ENTER to continue...', () => {
          rl.close();
          resolve();
        });
      });

      await db.collection('flashcardDecks').doc(targetDeck.id).delete();
      console.log('\n✅ Deck deleted from Firebase');
      console.log('\n📋 NEXT STEPS:');
      console.log('  1. Click "Sync All" in the UI');
      console.log('  2. Verify the deck is removed from your local UI');
      console.log('  3. This confirms Firebase → Local deletion sync works');

    } else {
      console.log('\n📋 Target: flashcards-sample deck');
      console.log(`   ID: ${sampleDeck.id}`);

      console.log('\n🔍 TEST PLAN:');
      console.log('  This test will delete the "flashcards-sample" deck from Firebase');
      console.log('  Then you will sync to verify it disappears from your local UI');

      console.log('\n⚠️  WARNING: This will permanently delete the deck from Firebase');
      console.log('     Make sure you do NOT need this deck before continuing!');

      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      await new Promise(resolve => {
        rl.question('\nType "DELETE" to confirm and continue: ', (answer) => {
          rl.close();
          if (answer === 'DELETE') {
            resolve(true);
          } else {
            console.log('\n❌ Cancelled - no deletion performed');
            resolve(false);
          }
        });
      }).then(async (confirmed) => {
        if (confirmed) {
          await db.collection('flashcardDecks').doc(sampleDeck.id).delete();
          console.log('\n✅ flashcards-sample deck deleted from Firebase');
          console.log('\n📋 NEXT STEPS:');
          console.log('  1. Click "Sync All" in the UI');
          console.log('  2. Verify the "flashcards-sample" deck disappears from your UI');
          console.log('  3. This confirms Firebase → Local deletion sync works');
        }
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

testDeletion();
