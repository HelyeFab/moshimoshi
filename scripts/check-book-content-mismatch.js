/**
 * Check for content vs translation mismatch
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
    process.exit(1);
  }

  const book = bookDoc.data();

  console.log('=== BOOK CONTENT ANALYSIS ===');
  console.log('Book ID:', bookId);
  console.log('Title:', book.title);
  console.log('');

  console.log('CONTENT (Japanese):');
  console.log('  Length:', book.content?.length || 0, 'characters');
  console.log('  First 200 chars:', book.content?.substring(0, 200));
  console.log('  Last 200 chars:', book.content?.substring(book.content.length - 200));
  console.log('');

  console.log('TRANSLATION (English):');
  console.log('  Length:', book.translation?.length || 0, 'characters');
  console.log('  Full translation:');
  console.log('  ' + book.translation);
  console.log('');

  console.log('ANALYSIS:');
  const contentLength = book.content?.length || 0;
  const translationLength = book.translation?.length || 0;
  const ratio = contentLength > 0 ? translationLength / contentLength : 0;

  console.log(`  Content/Translation ratio: ${ratio.toFixed(2)} (should be ~0.4-0.6 for JP->EN)`);

  if (ratio < 0.3) {
    console.log('  ⚠️  WARNING: Translation appears incomplete!');
    console.log(`  Expected translation length: ~${Math.round(contentLength * 0.5)} chars`);
    console.log(`  Actual translation length: ${translationLength} chars`);
    console.log(`  Missing: ~${Math.round(contentLength * 0.5 - translationLength)} chars`);
  }

  process.exit(0);
}

const bookId = process.argv[2] || 'b5xp7Ae99ToVQ5lq2NrN';
checkBook(bookId).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
