const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function getStory() {
  const storyId = process.argv[2] || 'story_1768694424281_scheduler-system';
  const doc = await db.collection('stories').doc(storyId).get();

  if (!doc.exists) {
    console.log('Story not found');
    return;
  }

  const data = doc.data();
  console.log('Story ID:', doc.id);
  console.log('Title:', data.title);
  console.log('Title (JP):', data.titleJP || 'N/A');
  console.log('Published:', data.publishedAt ? new Date(data.publishedAt._seconds * 1000).toISOString() : 'N/A');
  console.log('Level:', data.level);
  console.log('Status:', data.status);
  console.log('');
  console.log('All fields:', Object.keys(data).join(', '));
}

getStory().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
