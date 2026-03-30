const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkStory() {
  const storyId = 'story_1768694424281_scheduler-system';
  const doc = await db.collection('stories').doc(storyId).get();

  if (!doc.exists) {
    console.log('Story not found');
    return;
  }

  const data = doc.data();
  console.log('Story ID:', doc.id);
  console.log('Title (English):', data.title);
  console.log('Title (Japanese - titleJa):', data.titleJa);
  console.log('');
  console.log('Looking for: あたらしい新しいともだち友達をつくる作る');
  console.log('Match:', data.titleJa === 'あたらしい新しいともだち友達をつくる作る' ? 'YES' : 'NO');
}

checkStory().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
