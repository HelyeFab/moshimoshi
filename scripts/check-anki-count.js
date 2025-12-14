const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '../moshimoshi-service-account.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
}

const db = admin.firestore();
const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

async function main() {
  // Get count using the same query as the API
  const snapshot = await db.collection('flashcardDecks')
    .where('userId', '==', userId)
    .where('source', '==', 'anki')
    .count()
    .get();

  console.log('Anki deck count (via count query):', snapshot.data().count);

  // Also list the decks
  const decksSnapshot = await db.collection('flashcardDecks')
    .where('userId', '==', userId)
    .where('source', '==', 'anki')
    .get();

  console.log('\nDecks list:');
  decksSnapshot.docs.forEach((doc, i) => {
    const d = doc.data();
    console.log(`  ${i+1}. ${d.name} (id: ${doc.id.substring(0,20)}...)`);
  });

  // Check user subscription
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();
  console.log('\nUser subscription:', userData?.subscription?.plan || 'free');

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
