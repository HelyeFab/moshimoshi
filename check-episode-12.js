const admin = require('./functions/node_modules/firebase-admin');
const serviceAccount = require('./moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkEpisode() {
  console.log('\n📊 Checking Episode 12 status...\n');
  
  // Check published comics
  const publishedQuery = await db.collection('moshi_goes_to_japan_episodes')
    .where('episodeNumber', '==', 12)
    .get();
  
  if (!publishedQuery.empty) {
    console.log('✅ Episode 12 PUBLISHED!');
    const doc = publishedQuery.docs[0];
    console.log('Data:', JSON.stringify(doc.data(), null, 2).substring(0, 500));
  } else {
    console.log('⏳ Episode 12 not published yet');
  }
  
  // Check draft
  const draftQuery = await db.collection('comic_drafts')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
    
  if (!draftQuery.empty) {
    const draft = draftQuery.docs[0].data();
    console.log('\n📝 Latest draft:');
    console.log('  Episode:', draft.episodeNumber);
    console.log('  Status:', draft.status);
    console.log('  Created:', draft.createdAt?.toDate());
  }
  
  process.exit(0);
}

checkEpisode();
