const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function findStory() {
  const title = 'あたらしい新しいともだち友達をつくる作る';

  console.log('Searching for story with title:', title);
  console.log('');

  const storiesSnapshot = await db.collection('stories')
    .where('title', '==', title)
    .get();

  if (storiesSnapshot.empty) {
    console.log('No story found with exact title match.');
    console.log('');
    console.log('Searching for stories with similar titles...');

    // Try partial match
    const allStoriesSnapshot = await db.collection('stories')
      .orderBy('publishedAt', 'desc')
      .limit(50)
      .get();

    const matches = [];
    allStoriesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.title && (data.title.includes('ともだち') || data.title.includes('友達') || data.title.toLowerCase().includes('friend'))) {
        matches.push({
          id: doc.id,
          title: data.title,
          publishedAt: data.publishedAt ? new Date(data.publishedAt._seconds * 1000).toISOString() : 'N/A'
        });
      }
    });

    if (matches.length > 0) {
      console.log('Found', matches.length, 'stories with similar titles:');
      matches.forEach(m => {
        console.log('  ID:', m.id);
        console.log('  Title:', m.title);
        console.log('  Published:', m.publishedAt);
        console.log('');
      });
    } else {
      console.log('No similar stories found.');
    }
  } else {
    console.log('Found', storiesSnapshot.size, 'story(ies):');
    console.log('');

    storiesSnapshot.forEach(doc => {
      const data = doc.data();
      console.log('ID:', doc.id);
      console.log('Title:', data.title);
      console.log('Published:', data.publishedAt ? new Date(data.publishedAt._seconds * 1000).toISOString() : 'N/A');
      console.log('Level:', data.level);
      console.log('');
    });
  }
}

findStory().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
