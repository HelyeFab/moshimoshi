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

async function testQuery() {
  console.log('Testing exact same query as server.ts...\n');

  try {
    const sessionsSnapshot = await db
      .collection('flashcardSessions')
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(25)
      .get();

    console.log('SUCCESS! Found', sessionsSnapshot.size, 'sessions');

    sessionsSnapshot.docs.forEach((doc, i) => {
      const data = doc.data();
      console.log(`\n${i+1}. ${doc.id}`);
      console.log('   Full data:', JSON.stringify(data, null, 2));
    });

  } catch (error) {
    console.error('QUERY FAILED:', error.message);
    if (error.message.includes('index')) {
      console.log('\n⚠️ Missing Firestore index! Create it at the URL in the error message.');
    }
  }

  process.exit(0);
}

testQuery();
