const admin = require('./functions/node_modules/firebase-admin');
const serviceAccount = require('./moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkEpisode() {
  console.log('\n📊 Checking Episode 13 status...\n');
  
  // Check published
  const publishedQuery = await db.collection('moshi_goes_to_japan_episodes')
    .where('episodeNumber', '==', 13)
    .get();
  
  if (!publishedQuery.empty) {
    console.log('✅ Episode 13 PUBLISHED!');
    const doc = publishedQuery.docs[0];
    const data = doc.data();
    console.log('  ID:', doc.id);
    console.log('  Title:', data.title);
    console.log('  Theme:', data.theme);
    console.log('  Created:', data.createdAt?.toDate());
    process.exit(0);
  }
  
  console.log('⏳ Episode 13 not published');
  
  // Check draft
  const draftsQuery = await db.collection('comic_drafts')
    .where('episodeNumber', '==', 13)
    .get();
    
  if (!draftsQuery.empty) {
    const draft = draftsQuery.docs[0].data();
    console.log('\n📝 Draft found:');
    console.log('  Status:', draft.status);
    console.log('  Panels:', draft.panels?.length || 0);
    console.log('  Images generated:', draft.panels?.filter(p => p.imageUrl).length || 0);
  } else {
    console.log('❌ No draft found');
  }
  
  process.exit(0);
}

checkEpisode();
