const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('../moshimoshi-service-account.json');

// Initialize Firebase Admin
const app = initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkAILogs() {
  try {
    console.log('\n🔍 Checking AI Service Logs for recent transcript processing\n');

    // Check AI service logs
    const aiLogsQuery = await db.collection('aiServiceLogs')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    if (!aiLogsQuery.empty) {
      console.log('📊 Recent AI Service Logs:');
      console.log('=========================');
      aiLogsQuery.docs.forEach(doc => {
        const log = doc.data();
        const timestamp = log.timestamp?.toDate();
        console.log(`\n${timestamp}`);
        console.log(`- Task: ${log.task}`);
        console.log(`- Success: ${log.success ? '✅' : '❌'}`);
        console.log(`- Model: ${log.model || 'N/A'}`);
        console.log(`- Cached: ${log.cached ? 'Yes' : 'No'}`);

        if (log.metadata?.source === 'youtube-extract') {
          console.log(`- Source: YouTube Extract`);
          console.log(`- Content ID: ${log.metadata.contentId}`);
        }

        if (!log.success && log.error) {
          console.log(`- Error: ${log.error}`);
        }

        if (log.usage) {
          console.log(`- Tokens Used: ${log.usage.totalTokens || 0}`);
        }
      });
    } else {
      console.log('No AI service logs found');
    }

    // Check API usage logs for AI-related calls
    console.log('\n\n📊 Recent API Usage Logs (AI-related):');
    console.log('=====================================');
    const apiLogsQuery = await db.collection('apiUsageLogs')
      .where('api', 'in', ['openai', 'anthropic', 'google-ai'])
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    if (!apiLogsQuery.empty) {
      apiLogsQuery.docs.forEach(doc => {
        const log = doc.data();
        const timestamp = log.timestamp?.toDate();
        console.log(`\n${timestamp}`);
        console.log(`- API: ${log.api}`);
        console.log(`- Success: ${log.success ? '✅' : '❌'}`);
        if (!log.success && log.error) {
          console.log(`- Error: ${log.error}`);
        }
      });
    }

  } catch (error) {
    console.error('Error checking AI logs:', error.message);
  }

  process.exit();
}

checkAILogs();