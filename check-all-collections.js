const admin = require('./functions/node_modules/firebase-admin');
const serviceAccount = require('./moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkCollections() {
  console.log('\n📊 Checking comic-related collections...\n');
  
  const comics = await db.collection('comics')
    .orderBy('createdAt', 'desc')
    .limit(3)
    .get();
  
  console.log('=== COMICS collection ===');
  if (comics.empty) {
    console.log('Empty');
  } else {
    comics.forEach(doc => {
      const data = doc.data();
      console.log('\nEpisode', data.episodeNumber || 'unknown');
      console.log('  Title:', data.title);
      console.log('  Created:', data.createdAt ? data.createdAt.toDate() : 'unknown');
    });
  }
  
  const drafts = await db.collection('comic_drafts')
    .orderBy('createdAt', 'desc')
    .limit(3)
    .get();
  
  console.log('\n\n=== COMIC_DRAFTS collection ===');
  if (drafts.empty) {
    console.log('Empty');
  } else {
    drafts.forEach(doc => {
      const data = doc.data();
      console.log('\nDraft', data.episodeNumber || 'unknown');
      console.log('  ID:', doc.id);
      console.log('  Status:', data.status);
      console.log('  Created:', data.createdAt ? data.createdAt.toDate() : 'unknown');
      console.log('  Progress:', data.progress);
    });
  }
  
  process.exit(0);
}

checkCollections();
