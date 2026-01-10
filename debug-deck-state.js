const admin = require('firebase-admin');

const serviceAccount = require('/home/beano/DevProjects/NextJs/moshimoshi/moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function debugDeckState() {
  try {
    const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

    console.log('🔍 Checking all decks for user...\n');

    const snapshot = await db.collection('flashcardDecks')
      .where('userId', '==', userId)
      .orderBy('updatedAt', 'desc')
      .get();

    console.log(`Found ${snapshot.docs.length} decks:\n`);

    snapshot.docs.forEach((doc, idx) => {
      const data = doc.data();
      console.log(`${idx + 1}. ${data.name}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Description: ${data.description || '(empty)'}`);
      console.log(`   Updated: ${new Date(data.updatedAt).toLocaleString()}`);
      console.log(`   Age: ${Math.floor((Date.now() - data.updatedAt) / 1000)}s ago`);
      console.log(`   Cards: ${data.cards?.length || 0}`);
      console.log(`   Source: ${data.source || 'user'}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

debugDeckState();
