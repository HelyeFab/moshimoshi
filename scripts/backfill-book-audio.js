/**
 * Backfill Book Audio
 * Generates TTS audio for all books that don't have audio
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Configuration for TTS
const TTS_BASE_URL = process.env.TTS_BASE_URL || 'http://localhost:3000';

async function generateAudioForBook(bookId, content, collection) {
  console.log(`\n🔊 Generating audio for book: ${bookId}`);
  console.log(`   Content length: ${content.length} characters`);

  try {
    // Call TTS synthesize directly using the TTS service
    // Since we're running as a script, we'll use the TTS service directly
    const { ttsService } = require('../src/lib/tts/service');

    const result = await ttsService.synthesize(content, {
      language: 'ja',
      speed: 1.0,
    });

    if (result.audioUrl) {
      console.log(`✅ Audio generated successfully`);
      console.log(`   Provider: ${result.provider}`);
      console.log(`   URL: ${result.audioUrl.substring(0, 80)}...`);

      // Update the book document
      await db.collection(collection).doc(bookId).update({
        audioUrl: result.audioUrl,
        'metadata.audioCached': true,
        'metadata.audioGeneratedAt': new Date(),
        'metadata.audioStatus': 'success',
        'metadata.audioProvider': result.provider,
      });

      return { success: true, audioUrl: result.audioUrl };
    } else {
      console.error(`❌ No audioUrl returned`);
      return { success: false, error: 'No audioUrl returned' };
    }
  } catch (error) {
    console.error(`❌ Error generating audio:`, error.message);

    await db.collection(collection).doc(bookId).update({
      'metadata.audioStatus': 'failed',
      'metadata.audioError': error.message,
    });

    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('📚 Book Audio Backfill Script');
  console.log('='.repeat(60));

  // Get all books without audio from both collections
  const booksToProcess = [];

  // Check books collection
  const booksSnapshot = await db.collection('books').get();
  booksSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (!data.audioUrl && data.content) {
      booksToProcess.push({
        id: doc.id,
        bookName: data.bookName || data.title,
        content: data.content,
        collection: 'books',
      });
    }
  });

  // Check book_drafts collection (published only)
  const draftsSnapshot = await db.collection('book_drafts').get();
  draftsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.status === 'published' && !data.audioUrl && data.content) {
      // Don't add if already in books collection
      if (!booksToProcess.some(b => b.id === doc.id)) {
        booksToProcess.push({
          id: doc.id,
          bookName: data.bookName || data.title,
          content: data.content,
          collection: 'book_drafts',
        });
      }
    }
  });

  console.log(`\nFound ${booksToProcess.length} books without audio:\n`);
  booksToProcess.forEach((book, i) => {
    console.log(`  ${i + 1}. ${book.bookName} (${book.id})`);
    console.log(`     Collection: ${book.collection}`);
    console.log(`     Content: ${book.content.length} chars`);
  });

  if (booksToProcess.length === 0) {
    console.log('\n✅ All books already have audio!');
    process.exit(0);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Starting audio generation...');
  console.log('='.repeat(60));

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < booksToProcess.length; i++) {
    const book = booksToProcess[i];
    console.log(`\n[${i + 1}/${booksToProcess.length}] Processing: ${book.bookName}`);

    const result = await generateAudioForBook(book.id, book.content, book.collection);

    if (result.success) {
      successCount++;
    } else {
      failCount++;
    }

    // Wait between requests to avoid rate limiting
    if (i < booksToProcess.length - 1) {
      console.log('   Waiting 2 seconds before next book...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 Backfill Complete!');
  console.log('='.repeat(60));
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
  console.log(`   Total: ${booksToProcess.length}`);

  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
