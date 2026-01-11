const admin = require('./functions/node_modules/firebase-admin');
const serviceAccount = require('./moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkLatest() {
  console.log('\n📊 Checking latest published episodes...\n');
  
  const query = await db.collection('moshi_goes_to_japan_episodes')
    .orderBy('createdAt', 'desc')
    .limit(3)
    .get();
  
  if (query.empty) {
    console.log('❌ No episodes found');
    process.exit(0);
  }
  
  query.forEach(doc => {
    const data = doc.data();
    console.log(`\nEpisode ${data.episodeNumber}:`);
    console.log('  ID:', doc.id);
    console.log('  Title:', data.title);
    console.log('  Theme:', data.theme);
    console.log('  Created:', data.createdAt?.toDate());
    console.log('  Panels:', data.panels?.length || 0);
  });
  
  process.exit(0);
}

checkLatest();
