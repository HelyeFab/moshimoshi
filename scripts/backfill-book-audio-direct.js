/**
 * Backfill Book Audio - Direct Firestore + TTS
 * Generates TTS audio for all books that don't have audio
 * Uses Kokoro TTS via Modal API directly
 */

const admin = require('firebase-admin');
const { getStorage } = require('firebase-admin/storage');
const serviceAccount = require('../moshimoshi-service-account.json');
const fetch = require('node-fetch');
const crypto = require('crypto');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'moshimoshi-de237.firebasestorage.app'
  });
}

const db = admin.firestore();
const storage = getStorage();

// Load environment variables from .env.local
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

// TTS Configuration - VOICEVOX via Modal
const VOICEVOX_ENDPOINT = 'https://emmanuelfabiani23--voicevox-tts-serve.modal.run/v1/audio';
const MODAL_API_KEY = process.env.MODAL_API_KEY;
const DEFAULT_VOICE = '11'; // Nemo - natural female voice

if (!MODAL_API_KEY) {
  console.error('❌ MODAL_API_KEY environment variable is required!');
  console.error('   Make sure it is set in .env.local');
  process.exit(1);
}

console.log(`✅ MODAL_API_KEY found (${MODAL_API_KEY.substring(0, 8)}...)`);

async function synthesizeWithVoicevox(text, voice = DEFAULT_VOICE) {
  console.log(`   📡 Calling VOICEVOX TTS API...`);
  console.log(`   📡 Text length: ${text.length} chars`);

  // Call the Modal VOICEVOX endpoint with auth
  const response = await fetch(`${VOICEVOX_ENDPOINT}/speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': MODAL_API_KEY,
      'User-Agent': 'Moshimoshi/TTS-Backfill',
    },
    body: JSON.stringify({
      model: 'voicevox',
      input: text,
      voice: voice,
      speed: 1.0,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`VOICEVOX TTS failed: ${response.status} - ${errorText}`);
  }

  // Get audio buffer
  const audioBuffer = await response.arrayBuffer();
  console.log(`   📡 Received audio: ${Buffer.from(audioBuffer).length} bytes`);

  return Buffer.from(audioBuffer);
}

async function uploadToFirebaseStorage(audioBuffer, bookId) {
  const bucket = storage.bucket();
  const fileName = `tts/voicevox/books/${bookId}.mp3`;

  console.log(`   📤 Uploading to Firebase Storage: ${fileName}`);

  const file = bucket.file(fileName);

  await file.save(audioBuffer, {
    metadata: {
      contentType: 'audio/mpeg',
      metadata: {
        generatedBy: 'voicevox-backfill',
        generatedAt: new Date().toISOString(),
        bookId,
      },
    },
  });

  // Make public
  await file.makePublic();

  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
  console.log(`   📤 Uploaded: ${publicUrl}`);

  return publicUrl;
}

async function generateAudioForBook(bookId, bookName, content, collection) {
  console.log(`\n🔊 [${bookName}]`);
  console.log(`   ID: ${bookId}`);
  console.log(`   Collection: ${collection}`);
  console.log(`   Content: ${content.length} characters`);

  try {
    // Generate audio with VOICEVOX
    const audioBuffer = await synthesizeWithVoicevox(content);

    // Upload to Firebase Storage
    const audioUrl = await uploadToFirebaseStorage(audioBuffer, bookId);

    // Update Firestore
    await db.collection(collection).doc(bookId).update({
      audioUrl: audioUrl,
      'metadata.audioCached': true,
      'metadata.audioGeneratedAt': admin.firestore.FieldValue.serverTimestamp(),
      'metadata.audioStatus': 'success',
      'metadata.audioProvider': 'voicevox',
    });

    console.log(`   ✅ SUCCESS - Audio saved to book document`);
    return { success: true, audioUrl };

  } catch (error) {
    console.error(`   ❌ FAILED: ${error.message}`);

    // Update Firestore with error
    await db.collection(collection).doc(bookId).update({
      'metadata.audioStatus': 'failed',
      'metadata.audioError': error.message,
    });

    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('📚 Book Audio Backfill Script (Direct)');
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
        bookName: data.bookName || data.title || 'Unknown',
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
      // Don't add if already processed from books collection
      if (!booksToProcess.some(b => b.id === doc.id)) {
        booksToProcess.push({
          id: doc.id,
          bookName: data.bookName || data.title || 'Unknown',
          content: data.content,
          collection: 'book_drafts',
        });
      }
    }
  });

  console.log(`\nFound ${booksToProcess.length} books without audio:\n`);
  booksToProcess.forEach((book, i) => {
    console.log(`  ${i + 1}. ${book.bookName}`);
    console.log(`     ID: ${book.id}`);
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
    console.log(`\n[${i + 1}/${booksToProcess.length}] Processing...`);

    const result = await generateAudioForBook(
      book.id,
      book.bookName,
      book.content,
      book.collection
    );

    if (result.success) {
      successCount++;
    } else {
      failCount++;
    }

    // Wait between requests
    if (i < booksToProcess.length - 1) {
      console.log('\n   ⏳ Waiting 3 seconds before next book...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 Backfill Complete!');
  console.log('='.repeat(60));
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📚 Total: ${booksToProcess.length}`);

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
