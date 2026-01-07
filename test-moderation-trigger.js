const admin = require('firebase-admin');
const serviceAccount = require('/home/beano/DevProjects/NextJs/moshimoshi/moshimoshi-service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

console.log('Setting moderationStatus to pending to trigger Cloud Function...');

db.collection('qa_questions').doc('mYzMNnOrKzhgg0cdvLZ8').update({
  moderationStatus: 'pending',
  updatedAt: admin.firestore.FieldValue.serverTimestamp()
}).then(() => {
  console.log('✅ Update sent at', new Date().toISOString());
  console.log('Checking status every 2 seconds for 20 seconds...\n');

  let checks = 0;
  const interval = setInterval(() => {
    checks++;
    db.collection('qa_questions').doc('mYzMNnOrKzhgg0cdvLZ8').get().then(doc => {
      const data = doc.data();
      const moderatedAt = data.moderatedAt ? data.moderatedAt.toDate().toISOString() : 'never';
      console.log(`[Check ${checks}] Status: ${data.moderationStatus} | ModeratedAt: ${moderatedAt}`);

      if (data.moderationStatus !== 'pending' || checks >= 10) {
        clearInterval(interval);
        console.log('\n=== Final Result ===');
        console.log('Status:', data.moderationStatus);
        console.log('Reason:', data.moderationReason);
        console.log('ModeratedAt:', moderatedAt);
        process.exit(0);
      }
    });
  }, 2000);
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
