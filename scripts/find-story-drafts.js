const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function findDrafts() {
  // Look for recent drafts (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const draftsSnapshot = await db.collection('ai_story_drafts')
    .where('createdAt', '>=', sevenDaysAgo)
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();
  
  console.log(`Found ${draftsSnapshot.size} recent drafts\n`);
  
  draftsSnapshot.forEach(doc => {
    const data = doc.data();
    console.log('Draft ID:', doc.id);
    console.log('Status:', data.status);
    console.log('Created:', data.createdAt?.toDate?.().toISOString());
    console.log('Pages:', data.pages?.length || 0);
    console.log('---');
  });
}

findDrafts().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
