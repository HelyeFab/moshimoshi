/**
 * Check all books for incomplete translations
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function checkAllBooks() {
  console.log('📚 Checking all books for translation issues...\n');

  const booksSnapshot = await db.collection('books').get();

  const issues = [];

  booksSnapshot.forEach(doc => {
    const book = doc.data();
    const contentLength = book.content?.length || 0;
    const translationLength = book.translation?.length || 0;
    const ratio = contentLength > 0 ? translationLength / contentLength : 0;

    const status = {
      id: doc.id,
      title: book.title,
      contentLength,
      translationLength,
      ratio: ratio.toFixed(2),
      hasTranslation: !!book.translation,
      status: book.status,
    };

    // Flag issues
    if (!book.translation) {
      status.issue = 'MISSING_TRANSLATION';
      issues.push(status);
    } else if (ratio < 0.3) {
      status.issue = 'INCOMPLETE_TRANSLATION';
      issues.push(status);
    } else if (ratio < 0.4) {
      status.issue = 'SHORT_TRANSLATION';
      issues.push(status);
    }

    // Log all books
    const icon = !book.translation ? '❌' : ratio < 0.3 ? '⚠️ ' : ratio < 0.4 ? '⚡' : '✅';
    console.log(`${icon} ${book.title || 'Untitled'}`);
    console.log(`   ID: ${doc.id}`);
    console.log(`   Content: ${contentLength} chars | Translation: ${translationLength} chars | Ratio: ${ratio.toFixed(2)}`);
    if (status.issue) {
      console.log(`   Issue: ${status.issue}`);
    }
    console.log('');
  });

  console.log('═'.repeat(80));
  console.log('SUMMARY');
  console.log('═'.repeat(80));
  console.log(`Total books: ${booksSnapshot.size}`);
  console.log(`Books with issues: ${issues.length}`);
  console.log('');

  if (issues.length > 0) {
    console.log('Issues breakdown:');
    const missingCount = issues.filter(i => i.issue === 'MISSING_TRANSLATION').length;
    const incompleteCount = issues.filter(i => i.issue === 'INCOMPLETE_TRANSLATION').length;
    const shortCount = issues.filter(i => i.issue === 'SHORT_TRANSLATION').length;

    if (missingCount) console.log(`  Missing translation: ${missingCount}`);
    if (incompleteCount) console.log(`  Incomplete (ratio < 0.3): ${incompleteCount}`);
    if (shortCount) console.log(`  Short (ratio < 0.4): ${shortCount}`);
  }

  process.exit(0);
}

checkAllBooks().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
