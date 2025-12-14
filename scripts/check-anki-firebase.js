const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

const YOUR_USER_ID = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

async function checkAnkiData() {
  console.log('=== Checking Firebase for Your Data ===\n');
  console.log(`Looking for user: ${YOUR_USER_ID}\n`);

  // Check the specific flashcard deck
  console.log('--- flashcardDecks collection ---');
  const flashcardDoc = await db.collection('flashcardDecks').doc('a8e4555b-8f6f-4023-b36d-fddff0cc08f4').get();
  if (flashcardDoc.exists) {
    const data = flashcardDoc.data();
    console.log(`Found deck: ${data.name}`);
    console.log(`  userId: ${data.userId}`);
    console.log(`  cards: ${data.cards ? data.cards.length : 0}`);
    console.log(`  Full structure keys: ${Object.keys(data).join(', ')}`);
  }

  // Check all flashcardDecks for your user
  console.log('\n--- All flashcardDecks for your user ---');
  const userFlashcardDecks = await db.collection('flashcardDecks').where('userId', '==', YOUR_USER_ID).get();
  console.log(`Found ${userFlashcardDecks.size} flashcard decks for your user`);
  userFlashcardDecks.forEach(doc => {
    const data = doc.data();
    console.log(`  - ${doc.id}: "${data.name}" (${data.cards ? data.cards.length : 0} cards)`);
    console.log(`    source: ${data.source || 'not set'}, ankiImport: ${data.metadata?.ankiImport || false}`);
  });

  // Check ankiDecks for your user
  console.log('\n--- All ankiDecks for your user ---');
  const userAnkiDecks = await db.collection('ankiDecks').where('userId', '==', YOUR_USER_ID).get();
  console.log(`Found ${userAnkiDecks.size} Anki decks for your user`);
  userAnkiDecks.forEach(doc => {
    const data = doc.data();
    console.log(`  - ${doc.id}: "${data.name}" (${data.cards ? data.cards.length : 0} cards)`);
  });

  // Check ALL ankiDecks (any user)
  console.log('\n--- ALL ankiDecks in Firebase ---');
  const allAnkiDecks = await db.collection('ankiDecks').get();
  console.log(`Total ankiDecks: ${allAnkiDecks.size}`);
  allAnkiDecks.forEach(doc => {
    const data = doc.data();
    console.log(`  - ${doc.id}: user=${data.userId}, name="${data.name}"`);
  });

  // Check your user document
  console.log('\n--- Your user document ---');
  const userDoc = await db.collection('users').doc(YOUR_USER_ID).get();
  if (userDoc.exists) {
    const data = userDoc.data();
    console.log(`User found!`);
    console.log(`  subscription.plan: ${data.subscription?.plan}`);
    console.log(`  subscription.status: ${data.subscription?.status}`);
  } else {
    console.log('User document NOT FOUND!');
  }

  console.log('\n=== Done ===');
  process.exit(0);
}

checkAnkiData().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
