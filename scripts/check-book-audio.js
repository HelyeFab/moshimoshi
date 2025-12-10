const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkBook() {
  // Search for recent books/drafts
  const draftsSnapshot = await db.collection('book_drafts')
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  console.log('=== Recent Book Drafts ===\n');
  draftsSnapshot.forEach(doc => {
    const data = doc.data();
    const isTarget = data.titleJa && data.titleJa.includes('青豆');
    if (isTarget) console.log('>>> FOUND TARGET BOOK <<<');

    console.log('ID:', doc.id);
    console.log('Book Name:', data.bookName);
    console.log('TitleJa:', data.titleJa);
    console.log('Status:', data.status);
    console.log('Has Audio:', !!data.audioUrl);
    console.log('Audio URL:', data.audioUrl || 'none');
    console.log('Audio Cached:', data.metadata?.audioCached || false);
    console.log('---');
  });

  // Also check published books
  const booksSnapshot = await db.collection('books')
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  console.log('\n=== Published Books ===\n');
  booksSnapshot.forEach(doc => {
    const data = doc.data();
    const isTarget = data.titleJa && data.titleJa.includes('青豆');
    if (isTarget) console.log('>>> FOUND TARGET BOOK <<<');

    console.log('ID:', doc.id);
    console.log('Book Name:', data.bookName);
    console.log('TitleJa:', data.titleJa);
    console.log('Status:', data.status);
    console.log('Has Audio:', !!data.audioUrl);
    console.log('Audio URL:', data.audioUrl || 'none');
    console.log('Audio Cached:', data.metadata?.audioCached || false);
    console.log('---');
  });

  process.exit(0);
}

checkBook().catch(e => { console.error(e); process.exit(1); });
