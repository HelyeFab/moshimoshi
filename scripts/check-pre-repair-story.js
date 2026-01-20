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
  // Check a story that was generated after the schema fix
  // to see if textWithFurigana exists NOW (after our repair)
  const storyId = 'story_1768694424281_scheduler-system';

  const doc = await db.collection('stories').doc(storyId).get();

  if (!doc.exists) {
    console.log('Story not found');
    return;
  }

  const data = doc.data();
  console.log('Story:', data.title);
  console.log('Updated at:', data.updatedAt?.toDate().toISOString());
  console.log('\n=== Checking Page 3 ===\n');

  const page3 = data.pages[2]; // 0-indexed

  console.log('Fields present:', Object.keys(page3));
  console.log('\ntextWithFurigana field:');
  console.log('  Exists:', 'textWithFurigana' in page3);
  console.log('  Value:', page3.textWithFurigana?.substring(0, 100) + '...');
  console.log('\ntext field:');
  console.log('  Value:', page3.text?.substring(0, 100) + '...');

  // Check if there are any stories that we DIDN'T repair
  // (the 2 stories that were OK)
  console.log('\n=== Finding Unrepaired Stories ===\n');

  const allStories = await db.collection('stories')
    .orderBy('publishedAt', 'desc')
    .limit(27)
    .get();

  let unrepairedCount = 0;

  for (const doc of allStories.docs) {
    const storyData = doc.data();
    const pages = storyData.pages || [];

    // Check if any page is missing textWithFurigana
    const hasMissingField = pages.some(page => !('textWithFurigana' in page));

    if (hasMissingField) {
      unrepairedCount++;
      console.log(`Still missing: ${doc.id} - ${storyData.title}`);
    }
  }

  console.log(`\nTotal stories still missing textWithFurigana: ${unrepairedCount}`);
}

checkStory().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
