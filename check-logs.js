const admin = require('./functions/node_modules/firebase-admin');
const serviceAccount = require('./moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkLogs() {
  const logs = await db.collection('comic_generation_logs')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();
  
  console.log('\n📋 Recent Comic Generation Logs:\n');
  
  if (logs.empty) {
    console.log('No logs found');
  } else {
    logs.forEach(doc => {
      const data = doc.data();
      console.log('---');
      console.log('Type:', data.type);
      console.log('Status:', data.status);
      console.log('Episode:', data.episodeNumber);
      console.log('Theme:', data.theme);
      console.log('Created:', data.createdAt ? data.createdAt.toDate() : 'unknown');
      console.log('Duration:', data.duration ? (data.duration / 1000).toFixed(1) + 's' : 'unknown');
      if (data.error) console.log('Error:', data.error);
    });
  }
  
  process.exit(0);
}

checkLogs();
