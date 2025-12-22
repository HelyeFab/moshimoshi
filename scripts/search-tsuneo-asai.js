/**
 * Search for "Tsuneo Asai" text in books
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function searchBooks() {
  const booksSnapshot = await db.collection('books').get();

  console.log('Searching for "Tsuneo Asai" in books...\n');

  let found = false;

  booksSnapshot.forEach(doc => {
    const book = doc.data();
    const translationText = book.translation || '';
    const contentText = book.content || '';

    if (translationText.includes('Tsuneo Asai') || contentText.includes('Tsuneo Asai')) {
      found = true;
      console.log('FOUND in book:', doc.id);
      console.log('Title:', book.title);
      console.log('Title (Japanese):', book.titleJa);
      console.log('JLPT:', book.jlptLevel);
      console.log('Status:', book.status);
      console.log('Translation excerpt:', translationText.substring(0, 200));
      console.log('─'.repeat(80));
      console.log('');
    }
  });

  if (!found) {
    console.log('No books found with "Tsuneo Asai" text');
  }

  process.exit(0);
}

searchBooks().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
