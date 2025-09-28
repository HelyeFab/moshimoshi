const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('../moshimoshi-service-account.json');

// Initialize Firebase Admin
const app = initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkLogs() {
  try {
    console.log('\n🔍 Checking recent API usage\n');

    // Just get the most recent API logs
    const apiLogsQuery = await db.collection('apiUsageLogs')
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    if (!apiLogsQuery.empty) {
      console.log('📊 Recent API calls:');
      console.log('====================');

      let failureCount = 0;
      apiLogsQuery.docs.forEach(doc => {
        const log = doc.data();
        const timestamp = log.timestamp?.toDate();
        const status = log.success ? '✅' : '❌';

        console.log(`\n${timestamp?.toISOString() || 'Unknown time'}`);
        console.log(`- API: ${log.api} ${status}`);

        if (!log.success) {
          failureCount++;
          console.log(`- Error: ${log.error || 'No error message'}`);
        }

        if (log.metadata?.videoId) {
          console.log(`- Video ID: ${log.metadata.videoId}`);
        }
      });

      console.log(`\n\nSummary: ${failureCount} failures out of ${apiLogsQuery.size} recent calls`);
    } else {
      console.log('No API logs found');
    }

  } catch (error) {
    console.error('Error checking logs:', error.message);
  }

  process.exit();
}

checkLogs();