const admin = require('./functions/node_modules/firebase-admin');
const serviceAccount = require('./moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function triggerComic() {
  console.log('\n🧪 TESTING COMIC GENERATION FUNCTION\n');
  console.log('📝 Creating queue item for test comic...\n');
  
  const queueItem = {
    theme: 'Shopping',
    location: 'Supermarket', 
    jlptLevel: 'N5',
    characterIds: ['moshi-master'],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'pending',
    priority: 'high'
  };
  
  const docRef = await db.collection('comic_generation_queue').add(queueItem);
  console.log(`✅ Queue item created: ${docRef.id}`);
  console.log('⏳ Waiting for scheduler to pick it up (checks every minute)...\n');
  console.log('📊 Monitor with: firebase functions:log --only scheduledComicGeneratorFunction\n');
  
  process.exit(0);
}

triggerComic().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
