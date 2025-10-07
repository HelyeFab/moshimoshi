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

    console.log(`Found ${snapshot.size} YouTube videos to update`);

    const batch = db.batch();
    let updates = 0;

    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      // Add mock practice time: 300 seconds (5 min) for first video, 600 seconds (10 min) for second
      const mockTime = (index + 1) * 300;

      batch.update(doc.ref, {
        totalPracticeTime: mockTime,
        practiceCount: 3, // Mock 3 practice sessions
        lastPracticed: admin.firestore.Timestamp.now()
      });

      console.log(`Updating ${data.videoId}:`);
      console.log(`  - Practice time: ${mockTime} seconds (${Math.round(mockTime / 60)} minutes)`);
      console.log(`  - Practice count: 3 sessions`);
      updates++;
    });

    if (updates > 0) {
      await batch.commit();
      console.log(`\n✅ Successfully updated ${updates} videos`);

      // Verify the updates
      const verifySnapshot = await db
        .collection('userPracticeHistory')
        .where('userId', '==', userId)
        .where('contentType', '==', 'youtube')
        .get();

      let totalTime = 0;
      console.log('\n=== Verification ===');
      verifySnapshot.docs.forEach(doc => {
        const data = doc.data();
        totalTime += data.totalPracticeTime || 0;
        console.log(`${data.videoId}: ${data.totalPracticeTime || 0}s`);
      });
      console.log(`Total: ${totalTime}s (${Math.round(totalTime / 60)} minutes)`);
    } else {
      console.log('No videos to update');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
