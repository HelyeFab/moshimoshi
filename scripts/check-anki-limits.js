const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkAnkiLimits() {
  const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

  // Check current Anki deck count
  const ankiDecksSnapshot = await db.collection('flashcardDecks')
    .where('userId', '==', userId)
    .where('source', '==', 'anki')
    .get();

  console.log('=== Current Anki Decks ===');
  console.log('Count:', ankiDecksSnapshot.size);

  ankiDecksSnapshot.docs.forEach(doc => {
    const deck = doc.data();
    console.log('  -', deck.name, '| Cards:', deck.cards?.length || deck.cardCount);
  });

  // Check usage tracking document
  const usageDoc = await db.collection('usage').doc(userId).get();
  if (usageDoc.exists) {
    const usage = usageDoc.data();
    console.log('\n=== Usage Tracking ===');
    console.log('anki_imports:', usage?.anki_imports);
  } else {
    console.log('\n=== Usage Tracking ===');
    console.log('No usage document found');
  }

  // Check user's subscription
  const userDoc = await db.collection('users').doc(userId).get();
  if (userDoc.exists) {
    const user = userDoc.data();
    console.log('\n=== User Plan ===');
    console.log('Plan:', user?.subscription?.plan || 'free');
  }

  // Check the anki count document
  const ankiCountDoc = await db.collection('users').doc(userId).collection('metadata').doc('ankiDecks').get();
  if (ankiCountDoc.exists) {
    console.log('\n=== Anki Count Metadata ===');
    console.log(ankiCountDoc.data());
  } else {
    console.log('\n=== Anki Count Metadata ===');
    console.log('No ankiDecks metadata document found');
  }
}

checkAnkiLimits().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
