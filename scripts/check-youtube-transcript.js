const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const videoId = process.argv[2] || 'baQw2j-Wy9Y';
const readStorage = process.argv.includes('--read-storage');

async function check() {
  console.log(`\nChecking video ID: ${videoId}\n`);

  // Check transcriptCache
  const transcriptDoc = await db.collection('transcriptCache').doc(`youtube_${videoId}`).get();
  console.log('=== transcriptCache ===');
  if (transcriptDoc.exists) {
    const data = transcriptDoc.data();
    console.log('Found:', transcriptDoc.id);
    console.log('Title:', data.title || 'Unknown');
    console.log('Channel:', data.channelName || 'Unknown');
    console.log('Segments:', data.transcript?.length || 0);
    console.log('Has translations:', data.transcript?.some(s => s.translation) ? 'Yes' : 'No');
    console.log('Storage path:', data.transcriptStoragePath || 'n/a');
    console.log('Created:', data.createdAt?.toDate?.() || data.fetchedAt || 'Unknown');
    if (readStorage && data.transcriptStoragePath) {
      try {
        const bucket = admin.storage().bucket();
        const file = bucket.file(data.transcriptStoragePath);
        const [exists] = await file.exists();
        if (!exists) {
          console.log('Storage file: NOT FOUND');
        } else {
          const [buffer] = await file.download();
          console.log('Storage bytes:', buffer.length);
          const parsed = JSON.parse(buffer.toString('utf8'));
          const storedTranscript = Array.isArray(parsed.transcript) ? parsed.transcript : [];
          const storedFormatted = Array.isArray(parsed.formattedTranscript) ? parsed.formattedTranscript : [];
          console.log('Storage transcript segments:', storedTranscript.length);
          console.log('Storage formatted segments:', storedFormatted.length);
        }
      } catch (error) {
        console.error('Storage read error:', error.message || error);
      }
    }
  } else {
    console.log('NOT FOUND');
  }

  // Check youtube_word_explanations
  const wordExplDoc = await db.collection('youtube_word_explanations').doc(videoId).get();
  console.log('\n=== youtube_word_explanations ===');
  if (wordExplDoc.exists) {
    const data = wordExplDoc.data();
    console.log('Found:', wordExplDoc.id);
    const words = Array.isArray(data.words) ? data.words : [];
    console.log('Words:', words.length);
    console.log('Word count field:', data.wordCount ?? 'n/a');
    console.log('Precompute status:', data.precomputeStatus ?? 'n/a');
    console.log('Precompute version:', data.precomputeVersion ?? 'n/a');
    console.log('Precompute options:', data.precomputeOptions ?? 'n/a');
    console.log('Chunk total:', data.precomputeChunkTotal ?? 'n/a');
    console.log('Chunk completed:', data.precomputeChunkCompleted ?? 'n/a');
    console.log('Current chunk index:', data.precomputeChunkIndex ?? 'n/a');
    console.log('Last completed chunk:', data.precomputeChunkLastCompletedIndex ?? 'n/a');
    console.log('Started at:', data.precomputeStartedAt?.toDate?.() ?? 'n/a');
    console.log('Completed at:', data.precomputeCompletedAt?.toDate?.() ?? 'n/a');
  } else {
    console.log('NOT FOUND');
  }

  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
