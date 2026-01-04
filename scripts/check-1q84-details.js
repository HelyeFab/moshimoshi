const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkBook() {
  const doc = await db.collection('book_drafts').doc('T4OrghQ2PL6HPBTUzIHx').get();
  
  if (!doc.exists) {
    console.log('Book not found!');
    process.exit(1);
  }
  
  const data = doc.data();
  console.log('=== Book: 1Q84 ===\n');
  console.log('ID:', doc.id);
  console.log('Book Name:', data.bookName);
  console.log('TitleJa:', data.titleJa);
  console.log('Status:', data.status);
  console.log('Created At:', data.createdAt?.toDate?.());
  console.log('\n=== Audio Information ===');
  console.log('Has Audio URL:', !!data.audioUrl);
  console.log('Audio URL:', data.audioUrl || 'none');
  console.log('\n=== Metadata ===');
  console.log('Audio Status:', data.metadata?.audioStatus || 'not set');
  console.log('Audio Error:', data.metadata?.audioError || 'none');
  console.log('Audio Cached:', data.metadata?.audioCached || false);
  console.log('Audio Provider:', data.metadata?.audioProvider || 'none');
  console.log('Audio Generated At:', data.metadata?.audioGeneratedAt?.toDate?.() || 'never');
  console.log('Generation Step:', data.metadata?.generationStep || 'unknown');
  console.log('Progress:', data.metadata?.progress || 0);
  console.log('\n=== Content Info ===');
  console.log('Has Content:', !!data.content);
  console.log('Content Length:', data.content?.length || 0, 'characters');
  
  process.exit(0);
}

checkBook().catch(e => { console.error(e); process.exit(1); });
