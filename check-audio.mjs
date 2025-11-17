import admin from 'firebase-admin';

// Initialize Firebase Admin using environment variables
const app = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  })
});

const db = admin.firestore();

async function checkForAudio() {
  console.log('🔍 Checking articles for TTS-generated audio...\n');

  const snapshot = await db.collection('news_articles')
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  if (snapshot.empty) {
    console.log('📭 No NHK Easy articles found in database');
    return;
  }

  console.log(`📊 Found ${snapshot.size} NHK Easy articles. Checking audio fields...\n`);

  let articlesWithAudio = 0;
  let totalArticles = 0;

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    totalArticles++;

    const hasGeneratedAudio = data.generatedTitleAudioUrl || data.generatedSummaryAudioUrl || data.generatedContentAudioUrl;

    if (hasGeneratedAudio) {
      articlesWithAudio++;
      console.log(`✅ Audio generated for article:`, {
        id: doc.id,
        title: data.title?.substring(0, 50) + '...',
        titleAudioUrl: data.generatedTitleAudioUrl || 'NOT GENERATED',
        summaryAudioUrl: data.generatedSummaryAudioUrl || 'NOT GENERATED',
        contentAudioUrl: data.generatedContentAudioUrl || 'NOT GENERATED',
        audioStatus: data.audioStatus || 'UNKNOWN',
        audioProvider: data.audioProvider || 'UNKNOWN',
        audioVoice: data.audioVoice || 'UNKNOWN',
        audioError: data.audioError || 'NONE'
      });
    } else {
      console.log(`❌ No audio for article:`, {
        id: doc.id,
        title: data.title?.substring(0, 50) + '...',
        audioStatus: data.audioStatus || 'NOT SET',
        audioError: data.audioError || 'NONE'
      });
    }
    console.log('---');
  });

  console.log(`\n📈 Summary: ${articlesWithAudio}/${totalArticles} articles have generated audio`);

  if (articlesWithAudio === 0) {
    console.log('⚠️  WARNING: No articles have generated audio. Audio generation may have failed.');
  } else if (articlesWithAudio < totalArticles) {
    console.log('⚠️  Some articles are missing audio. Check the audioStatus and audioError fields.');
  } else {
    console.log('🎉 Success! All articles have generated audio!');
  }
}

checkForAudio()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
