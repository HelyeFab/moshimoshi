const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'moshimoshi-app' });
}
const db = admin.firestore();

async function getEP7() {
  const doc = await db.collection('comics').doc('moshi-goes-to-japan-ep007').get();
  if (doc.exists) {
    const data = doc.data();
    console.log('EP7 Data:');
    console.log('- Title:', data.title);
    console.log('- Dialogues count:', data.dialogues?.length || 0);
    console.log('- Vocabulary count:', data.vocabulary?.length || 0);
    console.log('- Current quiz count:', data.quiz?.length || 0);
    console.log('');
    console.log('Sample dialogue:', JSON.stringify(data.dialogues?.[0], null, 2));
    console.log('');
    console.log('Sample vocabulary:', JSON.stringify(data.vocabulary?.[0], null, 2));
  } else {
    console.log('EP7 not found');
  }
}

getEP7().catch(console.error);
