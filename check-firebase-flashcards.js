const admin = require('firebase-admin');
const serviceAccount = require('/home/beano/DevProjects/NextJs/moshimoshi/moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

async function checkFirebaseData() {
  console.log('🔍 Checking Firebase data for user:', userId);
  console.log('='.repeat(80));

  // 1. Check user document
  console.log('\n📋 USER DOCUMENT:');
  const userDoc = await db.collection('users').doc(userId).get();
  if (userDoc.exists) {
    const userData = userDoc.data();
    console.log('✅ User exists');
    console.log('Email:', userData?.email);
    console.log('Subscription:', userData?.subscription);
    console.log('Created:', userData?.createdAt?.toDate ? userData.createdAt.toDate().toISOString() : 'N/A');
  } else {
    console.log('❌ User document not found');
  }

  // 2. Check flashcard sessions
  console.log('\n📊 FLASHCARD SESSIONS:');
  const sessionsSnapshot = await db.collection('flashcardSessions')
    .where('userId', '==', userId)
    .orderBy('timestamp', 'desc')
    .limit(10)
    .get();

  if (!sessionsSnapshot.empty) {
    console.log(`✅ Found ${sessionsSnapshot.size} sessions (showing latest 10)`);
    sessionsSnapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n  Session ${index + 1}:`);
      console.log(`    ID: ${doc.id}`);
      console.log(`    Deck ID: ${data.deckId}`);
      console.log(`    Cards Studied: ${data.cardsStudied}`);
      console.log(`    Accuracy: ${Math.round(data.accuracy * 100)}%`);
      console.log(`    Duration: ${Math.round(data.duration / 60000)} minutes`);
      console.log(`    Timestamp: ${data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : 'N/A'}`);
    });
  } else {
    console.log('❌ No sessions found');
  }

  // 3. Check session analytics
  console.log('\n📈 DAILY ANALYTICS:');
  const analyticsSnapshot = await db.collection('flashcardSessionAnalytics')
    .doc(userId)
    .collection('days')
    .orderBy('date', 'desc')
    .limit(10)
    .get();

  if (!analyticsSnapshot.empty) {
    console.log(`✅ Found ${analyticsSnapshot.size} daily analytics records (showing latest 10)`);
    analyticsSnapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n  Day ${index + 1}:`);
      console.log(`    Date: ${data.date}`);
      console.log(`    Total Sessions: ${data.totalSessions}`);
      console.log(`    Total Cards: ${data.totalCards}`);
      console.log(`    Total Time: ${Math.round(data.totalTime / 60000)} minutes`);
      console.log(`    Average Accuracy: ${Math.round(data.averageAccuracy * 100)}%`);
      console.log(`    Decks Studied: ${data.decksStudied?.join(', ') || 'None'}`);
    });
  } else {
    console.log('❌ No analytics found');
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Check complete');
  process.exit(0);
}

checkFirebaseData().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
