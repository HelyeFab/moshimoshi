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

async function checkSessions() {
  console.log('=== FLASHCARD SESSIONS CHECK ===\n');
  console.log('User ID:', userId);
  console.log('');

  // Check flashcardSessions collection
  console.log('1. Checking flashcardSessions collection...');
  const sessionsSnapshot = await db.collection('flashcardSessions')
    .where('userId', '==', userId)
    .orderBy('timestamp', 'desc')
    .limit(10)
    .get();

  console.log(`   Found ${sessionsSnapshot.size} sessions`);

  if (sessionsSnapshot.size > 0) {
    console.log('\n   Recent sessions:');
    sessionsSnapshot.docs.forEach((doc, i) => {
      const data = doc.data();
      console.log(`   ${i+1}. ID: ${doc.id}`);
      console.log(`      Timestamp: ${data.timestamp ? new Date(data.timestamp).toISOString() : 'N/A'}`);
      console.log(`      Cards studied: ${data.cardsStudied || 'N/A'}`);
      console.log(`      Accuracy: ${data.accuracy ? Math.round(data.accuracy * 100) + '%' : 'N/A'}`);
      console.log('');
    });
  }

  // Check flashcardSessionAnalytics collection (daily aggregates)
  console.log('\n2. Checking flashcardSessionAnalytics collection...');
  const analyticsSnapshot = await db.collection('flashcardSessionAnalytics')
    .doc(userId)
    .collection('days')
    .orderBy('__name__', 'desc')
    .limit(7)
    .get();

  console.log(`   Found ${analyticsSnapshot.size} daily analytics records`);

  if (analyticsSnapshot.size > 0) {
    console.log('\n   Recent analytics:');
    analyticsSnapshot.docs.forEach((doc, i) => {
      const data = doc.data();
      console.log(`   ${i+1}. Date: ${doc.id}`);
      console.log(`      Data: ${JSON.stringify(data)}`);
    });
  }

  // Check user's decks for session data
  console.log('\n3. Checking deck stats...');
  const decksSnapshot = await db.collection('flashcardDecks')
    .where('userId', '==', userId)
    .get();

  console.log(`   Found ${decksSnapshot.size} decks`);

  decksSnapshot.docs.forEach((doc, i) => {
    const data = doc.data();
    console.log(`\n   Deck ${i+1}: ${data.name}`);
    console.log(`   Stats: ${JSON.stringify(data.stats || {}, null, 2)}`);
  });

  process.exit(0);
}

checkSessions().catch(e => { console.error(e); process.exit(1); });
