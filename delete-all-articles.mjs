import admin from 'firebase-admin';

// Initialize Firebase Admin using environment variables
const app = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  })
});

const db = admin.firestore();

async function deleteAllArticles() {
  console.log('🗑️  Deleting all articles from news_articles collection...');

  const batchSize = 500;
  let deletedCount = 0;

  while (true) {
    const snapshot = await db.collection('news_articles').limit(batchSize).get();

    if (snapshot.empty) {
      break;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    deletedCount += snapshot.size;
    console.log(`🗑️  Deleted ${deletedCount} articles so far...`);
  }

  console.log(`✅ Successfully deleted ${deletedCount} articles total!`);
}

deleteAllArticles()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
