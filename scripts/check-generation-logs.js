/**
 * Check comic generation logs
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function checkGenerationLogs() {
  console.log('📋 Recent comic generation logs:\n');

  const logsSnapshot = await db.collection('comic_generation_logs')
    .orderBy('startedAt', 'desc')
    .limit(5)
    .get();

  console.log(`Found ${logsSnapshot.size} logs\n`);

  logsSnapshot.docs.forEach((doc, index) => {
    const log = doc.data();
    console.log(`${index + 1}. ${doc.id}`);
    console.log(`   Type: ${log.type || 'unknown'}`);
    console.log(`   Status: ${log.status}`);
    console.log(`   Success: ${log.success}`);
    console.log(`   Episode #: ${log.episodeNumber}`);
    console.log(`   Theme: ${log.theme} @ ${log.location}`);
    console.log(`   JLPT: ${log.jlptLevel}`);
    console.log(`   Duration: ${log.duration ? Math.round(log.duration / 1000) + 's' : 'N/A'}`);
    if (log.error) {
      console.log(`   ❌ Error: ${log.error}`);
    }
    if (log.imagesGenerated !== undefined) {
      console.log(`   Images: ${log.imagesGenerated}/${log.panelCount || 'unknown'}`);
    }
    console.log(`   Started: ${log.startedAt?.toDate?.() || 'unknown'}`);
    console.log('');
  });

  process.exit(0);
}

checkGenerationLogs().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
