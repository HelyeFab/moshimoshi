const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkUserVideos() {
  console.log('🔍 Checking for videos you have been watching\n');
  console.log('='.repeat(60));

  // Check transcriptCache
  console.log('\n📝 transcriptCache collection:');
  const transcriptCache = await db.collection('transcriptCache').get();
  console.log('  Total cached transcripts:', transcriptCache.size);

  if (!transcriptCache.empty) {
    console.log('\n  Cached videos:');
    transcriptCache.forEach(doc => {
      const data = doc.data();
      console.log(`\n  • ${doc.id}`);
      console.log(`    Title: ${data.videoTitle || 'Untitled'}`);
      console.log(`    URL: ${data.videoUrl || 'N/A'}`);
      console.log(`    Language: ${data.language}`);
      console.log(`    Has transcript: ${!!data.transcript}`);
      console.log(`    Transcript lines: ${data.transcript ? data.transcript.length : 0}`);
      console.log(`    Has AI formatted: ${!!data.formattedTranscript}`);
      console.log(`    AI formatted lines: ${data.formattedTranscript ? data.formattedTranscript.length : 0}`);
      console.log(`    Created: ${data.createdAt ? new Date(data.createdAt._seconds * 1000).toLocaleString() : 'N/A'}`);
      console.log(`    Last accessed: ${data.lastAccessed ? new Date(data.lastAccessed._seconds * 1000).toLocaleString() : 'N/A'}`);
      console.log(`    Access count: ${data.accessCount || 0}`);
    });
  } else {
    console.log('  ❌ No transcripts cached yet');
  }

  // Check userYouTubeHistory
  console.log('\n\n🎥 userYouTubeHistory collection:');
  const history = await db.collection('userYouTubeHistory')
    .orderBy('lastWatched', 'desc')
    .limit(10)
    .get();

  console.log('  Recent videos watched:', history.size);

  if (!history.empty) {
    console.log('\n  Recent viewing history:');
    history.forEach(doc => {
      const data = doc.data();
      console.log(`\n  • ${data.videoTitle || data.videoId || doc.id}`);
      console.log(`    Video ID: ${data.videoId}`);
      console.log(`    User: ${data.userId}`);
      console.log(`    Last watched: ${data.lastWatched ? new Date(data.lastWatched._seconds * 1000).toLocaleString() : 'N/A'}`);
      console.log(`    Has transcript: ${!!data.transcript}`);
      console.log(`    Watch count: ${data.watchCount || 1}`);
    });
  } else {
    console.log('  ❌ No video history found');
  }

  // Check userEditedTranscripts
  console.log('\n\n✏️ userEditedTranscripts collection:');
  const edited = await db.collection('userEditedTranscripts').limit(5).get();
  console.log('  User-edited transcripts:', edited.size);

  if (!edited.empty) {
    console.log('\n  Edited transcripts:');
    edited.forEach(doc => {
      const data = doc.data();
      console.log(`\n  • Video ID: ${data.videoId}`);
      console.log(`    User: ${data.userId}`);
      console.log(`    Has transcript: ${!!data.transcript}`);
      console.log(`    Updated: ${data.updatedAt ? new Date(data.updatedAt._seconds * 1000).toLocaleString() : 'N/A'}`);
    });
  } else {
    console.log('  ❌ No edited transcripts found');
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Summary:');
  console.log(`  - Cached transcripts: ${transcriptCache.size}`);
  console.log(`  - Videos in history: ${history.size}`);
  console.log(`  - Edited transcripts: ${edited.size}`);

  if (transcriptCache.empty && history.empty) {
    console.log('\n⚠️  No video data found in Firebase');
    console.log('  This could mean:');
    console.log('  1. You haven\'t watched any videos yet');
    console.log('  2. The videos didn\'t have captions to process');
    console.log('  3. AI processing failed (check if OPEN_AI_API_KEY is set)');
    console.log('  4. There was an error saving to Firebase');
  }

  console.log('\n✅ Check complete!');
  process.exit(0);
}

checkUserVideos().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});