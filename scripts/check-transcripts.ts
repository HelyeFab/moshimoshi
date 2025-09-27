import admin from 'firebase-admin';
import serviceAccount from '../moshimoshi-service-account.json';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount)
  });
}

const db = admin.firestore();

async function checkTranscripts() {
  try {
    console.log('Checking for video transcripts in Firebase...\n');
    console.log('='.repeat(60));

    // Check userEditedTranscripts collection
    const editedTranscripts = await db.collection('userEditedTranscripts').limit(5).get();
    console.log('\n📝 userEditedTranscripts collection:', editedTranscripts.size, 'documents found');
    if (!editedTranscripts.empty) {
      editedTranscripts.forEach(doc => {
        const data = doc.data();
        console.log('  - Doc ID:', doc.id);
        console.log('    videoId:', data.videoId || 'N/A');
        console.log('    userId:', data.userId || 'N/A');
        console.log('    hasTranscript:', !!data.transcript);
        console.log('    transcriptLength:', data.transcript ? data.transcript.length : 0);
        if (data.transcript) {
          console.log('    First 100 chars:', data.transcript.substring(0, 100));
        }
      });
    }

    console.log('\n' + '-'.repeat(60));

    // Check userYouTubeHistory collection for transcript fields
    const youtubeHistory = await db.collection('userYouTubeHistory').limit(5).get();
    console.log('\n🎥 userYouTubeHistory collection:', youtubeHistory.size, 'documents found');
    if (!youtubeHistory.empty) {
      youtubeHistory.forEach(doc => {
        const data = doc.data();
        console.log('  - Doc ID:', doc.id);
        console.log('    videoId:', data.videoId);
        console.log('    videoTitle:', data.videoTitle);
        console.log('    hasTranscript:', !!data.transcript);
        console.log('    hasEditedTranscript:', !!data.editedTranscript);
        console.log('    transcriptSource:', data.transcriptSource || 'N/A');
      });
    }

    console.log('\n' + '-'.repeat(60));

    // Check videoTranscripts collection
    const videoTranscripts = await db.collection('videoTranscripts').limit(5).get();
    console.log('\n📄 videoTranscripts collection:', videoTranscripts.size, 'documents found');
    if (!videoTranscripts.empty) {
      videoTranscripts.forEach(doc => {
        const data = doc.data();
        console.log('  - Doc ID:', doc.id);
        console.log('    hasTranscript:', !!data.transcript);
        console.log('    transcriptLength:', data.transcript ? data.transcript.length : 0);
        console.log('    language:', data.language || 'N/A');
        console.log('    source:', data.source || 'N/A');
        if (data.transcript) {
          console.log('    First 100 chars:', data.transcript.substring(0, 100));
        }
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n🔍 Checking for test_video_123 transcript data...\n');

    // Check in userEditedTranscripts
    const testVideoEdited = await db.collection('userEditedTranscripts')
      .where('videoId', '==', 'test_video_123')
      .get();
    console.log('Found in userEditedTranscripts:', testVideoEdited.size, 'documents');
    if (!testVideoEdited.empty) {
      testVideoEdited.forEach(doc => {
        const data = doc.data();
        console.log('  - userId:', data.userId);
        console.log('  - hasTranscript:', !!data.transcript);
        if (data.transcript) {
          console.log('  - Transcript preview:', data.transcript.substring(0, 200));
        }
      });
    }

    // Check in videoTranscripts
    const testVideoTranscript = await db.collection('videoTranscripts')
      .doc('test_video_123')
      .get();
    console.log('\nFound in videoTranscripts collection:', testVideoTranscript.exists ? 'Yes' : 'No');
    if (testVideoTranscript.exists) {
      const data = testVideoTranscript.data()!;
      console.log('  - Transcript length:', data.transcript ? data.transcript.length : 0);
      console.log('  - Source:', data.source || 'N/A');
      console.log('  - Language:', data.language || 'N/A');
      if (data.transcript) {
        console.log('  - First 200 chars:', data.transcript.substring(0, 200));
      }
    }

    // Check in userYouTubeHistory for test video
    const testVideoHistory = await db.collection('userYouTubeHistory')
      .where('videoId', '==', 'test_video_123')
      .get();
    console.log('\nFound in userYouTubeHistory:', testVideoHistory.size, 'documents');
    if (!testVideoHistory.empty) {
      testVideoHistory.forEach(doc => {
        const data = doc.data();
        console.log('  - userId:', data.userId);
        console.log('  - hasTranscript field:', !!data.transcript);
        console.log('  - hasEditedTranscript field:', !!data.editedTranscript);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Transcript check complete!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking transcripts:', error);
    process.exit(1);
  }
}

checkTranscripts();