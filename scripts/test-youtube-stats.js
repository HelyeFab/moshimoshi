const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

(async () => {
  try {
    const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

    const snapshot = await db
      .collection('userPracticeHistory')
      .where('userId', '==', userId)
      .where('contentType', '==', 'youtube')
      .get();

    console.log('Total YouTube videos:', snapshot.size);

    let totalTime = 0;
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      totalTime += data.totalPracticeTime || 0;
      console.log('Video:', data.videoId, 'Practice time:', data.totalPracticeTime || 0, 'seconds');
    });

    console.log('\n=== Summary ===');
    console.log('Total videos practiced:', snapshot.size);
    console.log('Total practice time:', totalTime, 'seconds');
    console.log('Total practice time:', Math.round(totalTime / 60), 'minutes');

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
