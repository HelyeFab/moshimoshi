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
  console.log('\n=== PAGE 3 DETAILED FIELDS ===\n');

  if (data.pages && data.pages.length >= 3) {
    const page3 = data.pages[2]; // 0-indexed
    console.log('Page Number:', page3.pageNumber);
    console.log('\ntext:', page3.text);
    console.log('\ntextWithFurigana:', page3.textWithFurigana || 'NOT PRESENT');
    console.log('\nFields present:', Object.keys(page3).join(', '));
  } else {
    console.log('Page 3 not found');
  }
}

checkStory().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
