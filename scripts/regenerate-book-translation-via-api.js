/**
 * Regenerate translation for a book via API endpoint
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function regenerateTranslation(bookId) {
  console.log(`🔧 Regenerating translation for book: ${bookId}\n`);

  const bookDoc = await db.collection('books').doc(bookId).get();

  if (!bookDoc.exists) {
    console.error('❌ Book not found');
    process.exit(1);
  }

  const book = bookDoc.data();

  console.log('Book:', book.title);
  console.log('Current state:');
  console.log('  Content length:', book.content?.length || 0, 'chars');
  console.log('  Translation length:', book.translation?.length || 0, 'chars');
  console.log('  Ratio:', ((book.translation?.length || 0) / (book.content?.length || 1)).toFixed(2));
  console.log('');

  // Call the translation API directly
  console.log('📞 Calling translation API via localhost...');
  console.log('Please make sure your dev server is running (npm run dev)');
  console.log('');

  try {
    const response = await fetch('http://localhost:3000/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: book.content,
        mode: 'natural',
      }),
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const result = await response.json();
    const newTranslation = result.translatedText;

    console.log('✅ Translation received!');
    console.log('  New translation length:', newTranslation.length, 'chars');
    console.log('  Ratio:', (newTranslation.length / book.content.length).toFixed(2));
    console.log('');

    console.log('First 300 chars:');
    console.log('─'.repeat(80));
    console.log(newTranslation.substring(0, 300) + '...');
    console.log('─'.repeat(80));
    console.log('');

    // Update book in database
    console.log('💾 Updating book in database...');
    await bookDoc.ref.update({
      translation: newTranslation,
      updatedAt: new Date(),
    });

    console.log('✅ Book translation updated successfully!');
    console.log('');
    console.log('Summary:');
    console.log('  Old translation:', book.translation?.length || 0, 'chars');
    console.log('  New translation:', newTranslation.length, 'chars');
    console.log('  Improvement:', '+' + (newTranslation.length - (book.translation?.length || 0)), 'chars');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('');
    console.log('Make sure:');
    console.log('  1. Dev server is running (npm run dev)');
    console.log('  2. Translation API is accessible at http://localhost:3000/api/translate');
    process.exit(1);
  }

  process.exit(0);
}

const bookId = process.argv[2];
if (!bookId) {
  console.error('Usage: node scripts/regenerate-book-translation-via-api.js <bookId>');
  console.log('\nExample: node scripts/regenerate-book-translation-via-api.js b5xp7Ae99ToVQ5lq2NrN');
  process.exit(1);
}

regenerateTranslation(bookId).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
