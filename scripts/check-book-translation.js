/**
 * Check a book's translation
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function checkBook(bookId) {
  const bookDoc = await db.collection('books').doc(bookId).get();

  if (!bookDoc.exists) {
    console.log('Book not found');
    return;
  }

  const book = bookDoc.data();

  console.log('=== BOOK DATA ===');
  console.log('Book ID:', bookId);
  console.log('Title:', book.title);
  console.log('Title (Japanese):', book.titleJa);
  console.log('Book Name:', book.bookName);
  console.log('JLPT Level:', book.jlptLevel);
  console.log('Author:', book.author || 'N/A');
  console.log('Category:', book.category || 'N/A');
  console.log('Status:', book.status);
  console.log('');
  console.log('Translation type:', typeof book.translation);
  console.log('Translation length:', book.translation?.length || 0);
  console.log('Has translation:', !!book.translation);
  console.log('');
  console.log('First 200 chars of translation:');
  console.log('─'.repeat(80));
  console.log(book.translation?.substring(0, 200) || 'MISSING');
  console.log('─'.repeat(80));

  process.exit(0);
}

const bookId = process.argv[2] || 'eqX6J0aL2Ww6xuEBiRrL';
checkBook(bookId).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
