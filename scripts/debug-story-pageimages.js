/**
 * Debug script to check pageImages in a story
 */
const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function checkStory() {
  const storyId = process.argv[2] || 'story_1765843219288_scheduler-system';

  // Check broken story details
  const doc = await db.collection('stories').doc(storyId).get();
  const data = doc.data();

  console.log('=== Story:', storyId, '===\n');
  console.log('publishedAt:', data.publishedAt ? data.publishedAt.toDate().toISOString() : 'N/A');
  console.log('status:', data.status);
  console.log('pageImages field:', data.pageImages ? JSON.stringify(data.pageImages, null, 2) : 'DOES NOT EXIST');
  console.log('coverImageUrl:', data.coverImageUrl ? 'EXISTS' : 'MISSING');

  var missingCount = 0;
  var totalCount = 0;
  if (data.pages) {
    totalCount = data.pages.length;
    data.pages.forEach(function(p) {
      if (p.imageUrl === undefined || p.imageUrl === null || p.imageUrl === '') {
        missingCount++;
      }
    });
  }
  console.log('Pages missing images:', missingCount, '/', totalCount);

  // Check 10 most recent stories
  console.log('\n=== 10 Most Recent Published Stories ===');
  const recent = await db.collection('stories')
    .where('status', '==', 'published')
    .orderBy('publishedAt', 'desc')
    .limit(10)
    .get();

  recent.forEach(function(doc) {
    var d = doc.data();
    var missing = 0;
    var total = d.pages ? d.pages.length : 0;
    if (d.pages) {
      d.pages.forEach(function(p) {
        if (p.imageUrl === undefined || p.imageUrl === null || p.imageUrl === '') {
          missing++;
        }
      });
    }
    var pubDate = d.publishedAt ? d.publishedAt.toDate().toISOString().substring(0, 10) : 'N/A';
    console.log(pubDate, doc.id.substring(0, 35), 'missing:', missing, '/', total);
  });

  process.exit(0);
}

checkStory().catch(function(e) { console.error(e); process.exit(1); });
