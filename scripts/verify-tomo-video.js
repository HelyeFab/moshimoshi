const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function verifyVideo() {
  try {
    console.log('🔍 Checking Firebase for Tomo\'s video...\n');

    const videoId = 'ofkWnxFRclY';
    
    // Check userYouTubeHistory collection
    const historySnapshot = await db.collection('userYouTubeHistory')
      .where('videoId', '==', videoId)
      .get();

    console.log(`📊 Found ${historySnapshot.size} entries in userYouTubeHistory\n`);

    if (historySnapshot.size > 0) {
      historySnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`✓ User: ${data.userId}`);
        console.log(`  Watch count: ${data.watchCount}`);
        console.log(`  Watch time: ${data.totalWatchTime}s`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

verifyVideo();
