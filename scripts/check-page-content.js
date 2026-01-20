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
  console.log('Story Title:', data.title);
  console.log('Story Title (JA):', data.titleJa);
  console.log('\n=== PAGES ===\n');

  if (data.pages && data.pages.length > 0) {
    data.pages.forEach((page, index) => {
      console.log('--- Page', index + 1, '---');
      console.log('Text:', page.text);
      console.log('');
    });
  } else {
    console.log('No pages found');
  }
}

checkStory().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
