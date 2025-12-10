const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkDrafts() {
  const drafts = await db.collection('book_drafts').orderBy('createdAt', 'desc').limit(5).get();

  console.log('=== Recent Book Drafts ===\n');
  drafts.forEach(doc => {
    const data = doc.data();
    console.log('ID:', doc.id);
    console.log('Book:', data.bookName);
    console.log('Status:', data.status);
    console.log('Progress:', data.metadata?.progress);
    console.log('Step:', data.metadata?.generationStep);
    console.log('Created:', data.createdAt);
    console.log('Has Content:', !!data.content);
    console.log('Content Length:', data.content?.length || 0);
    console.log('Has Title:', !!data.title);
    console.log('Has TitleJa:', !!data.titleJa);
    console.log('Has Cover:', !!data.coverImageUrl);
    console.log('Has Audio:', !!data.audioUrl);
    console.log('Error:', data.error || 'none');
    console.log('---');
  });

  process.exit(0);
}

checkDrafts().catch(e => { console.error(e); process.exit(1); });
