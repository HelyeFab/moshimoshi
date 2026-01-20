const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkGenerationErrors() {
  console.log('=== Checking Story Generation Logs for Errors ===\n');

  // Check the problematic story specifically
  const targetStoryId = 'story_1768694424281_scheduler-system';

  const logsSnapshot = await db.collection('story_generation_logs')
    .where('storyId', '==', targetStoryId)
    .limit(1)
    .get();

  if (!logsSnapshot.empty) {
    console.log('Found generation log for the problematic story:\n');
    const logDoc = logsSnapshot.docs[0];
    const logData = logDoc.data();

    console.log('Log ID:', logDoc.id);
    console.log('Success:', logData.success);
    console.log('Errors:', logData.errors || 'None logged');
    console.log('Error Messages:', logData.errorMessages || 'None');
    console.log('Warnings:', logData.warnings || 'None');
    console.log('\nFull log data:', JSON.stringify(logData, null, 2));
  } else {
    console.log('No generation log found for the target story');
  }

  // Check recent failed generations
  console.log('\n=== Checking Recent Failed Generations ===\n');

  const failedSnapshot = await db.collection('story_generation_logs')
    .where('success', '==', false)
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  console.log(`Found ${failedSnapshot.size} failed generations\n`);

  failedSnapshot.forEach(doc => {
    const data = doc.data();
    console.log('Story ID:', data.storyId);
    console.log('Created:', data.createdAt?.toDate?.().toISOString());
    console.log('Error:', data.error || data.errors || 'Unknown');
    console.log('---');
  });

  // Check ai_errors collection if it exists
  console.log('\n=== Checking AI Errors Collection ===\n');

  try {
    const errorsSnapshot = await db.collection('ai_errors')
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    console.log(`Found ${errorsSnapshot.size} AI errors\n`);

    errorsSnapshot.forEach(doc => {
      const data = doc.data();
      console.log('Error ID:', doc.id);
      console.log('Task:', data.task);
      console.log('Error:', data.error);
      console.log('Timestamp:', data.timestamp?.toDate?.().toISOString());
      console.log('Context:', JSON.stringify(data.context || {}, null, 2).substring(0, 200));
      console.log('---');
    });
  } catch (e) {
    console.log('No ai_errors collection found');
  }
}

checkGenerationErrors().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
