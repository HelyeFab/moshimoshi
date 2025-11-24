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

async function checkForCaptions() {
  console.log('🔍 Checking articles for photo captions...\n');

  const snapshot = await db.collection('news_articles')
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();

  if (snapshot.empty) {
    console.log('📭 No articles found in database');
    return;
  }

  console.log(`📊 Found ${snapshot.size} articles. Checking for captions...\n`);

  const captionPattern = /＝[^＝。]*?撮影/;
  let articlesWithCaptions = 0;
  let totalArticles = 0;

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    totalArticles++;

    // Check if content contains photo caption pattern
    if (data.content && captionPattern.test(data.content)) {
      articlesWithCaptions++;
      console.log(`❌ Caption found in article:`, {
        id: doc.id,
        title: data.title?.substring(0, 50) + '...',
        source: data.source,
        captionMatch: data.content.match(captionPattern)?.[0]
      });
    } else {
      console.log(`✅ No caption in:`, {
        id: doc.id,
        title: data.title?.substring(0, 50) + '...',
        source: data.source,
        contentLength: data.content?.length || 0
      });
    }
  });

  console.log(`\n📈 Summary: ${articlesWithCaptions}/${totalArticles} articles have photo captions`);

  if (articlesWithCaptions === 0) {
    console.log('🎉 Success! No photo captions found in any articles!');
  } else {
    console.log('⚠️  Some articles still contain photo captions');
  }
}

checkForCaptions()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
