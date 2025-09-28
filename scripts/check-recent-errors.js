const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('../moshimoshi-service-account.json');

// Initialize Firebase Admin
const app = initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkRecentErrors() {
  try {
    console.log('\n🔍 Checking recent API errors\n');

    // Check recent API usage logs for failures
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const apiLogsQuery = await db.collection('apiUsageLogs')
      .where('success', '==', false)
      .where('timestamp', '>', oneHourAgo)
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    if (!apiLogsQuery.empty) {
      console.log('❌ Recent API Failures (last hour):');
      console.log('=====================================');
      apiLogsQuery.docs.forEach(doc => {
        const log = doc.data();
        const timestamp = log.timestamp?.toDate();
        console.log(`\n${timestamp}`);
        console.log(`- API: ${log.api}`);
        console.log(`- Error: ${log.error || 'Unknown error'}`);
        if (log.metadata) {
          console.log('- Metadata:', JSON.stringify(log.metadata, null, 2));
        }
      });
    } else {
      console.log('No API failures in the last hour');
    }

    // Check for SupaData API specifically
    const supadataQuery = await db.collection('apiUsageLogs')
      .where('api', '==', 'supadata')
      .orderBy('timestamp', 'desc')
      .limit(5)
      .get();

    if (!supadataQuery.empty) {
      console.log('\n\n📊 Recent SupaData API calls:');
      console.log('================================');
      supadataQuery.docs.forEach(doc => {
        const log = doc.data();
        const timestamp = log.timestamp?.toDate();
        console.log(`\n${timestamp}`);
        console.log(`- Success: ${log.success ? '✅' : '❌'}`);
        if (!log.success) {
          console.log(`- Error: ${log.error}`);
        }
        if (log.metadata?.videoId) {
          console.log(`- Video ID: ${log.metadata.videoId}`);
        }
      });
    }

  } catch (error) {
    console.error('Error checking recent errors:', error.message);
  }

  process.exit();
}

checkRecentErrors();