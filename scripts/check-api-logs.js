const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkApiLogs() {
  console.log('🔍 Checking recent API usage logs...\n');

  const logs = await db.collection('apiUsageLogs')
    .orderBy('timestamp', 'desc')
    .limit(30)
    .get();

  console.log('Found ' + logs.size + ' recent API logs\n');

  let youtubeCount = 0;

  logs.forEach(doc => {
    const data = doc.data();
    if (data.api && data.api.includes('youtube')) {
      youtubeCount++;
      console.log('='.repeat(50));
      console.log('API:', data.api);
      console.log('Success:', data.success ? '✅' : '❌');
      if (data.error) {
        console.log('Error:', data.error);
      }
      console.log('Time:', data.timestamp.toDate().toLocaleString());
      if (data.metadata) {
        console.log('Metadata:');
        Object.keys(data.metadata).forEach(key => {
          console.log('  ' + key + ':', data.metadata[key]);
        });
      }
    }
  });

  if (youtubeCount === 0) {
    console.log('No YouTube API calls found in recent logs');
  } else {
    console.log('\nTotal YouTube API calls found:', youtubeCount);
  }

  process.exit(0);
}

checkApiLogs().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});