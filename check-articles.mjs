/**
 * Check Firestore for articles with TTS audio
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBnW_0IiEr3ju05xPdf6-lWcQOsXbbAUAY",
  authDomain: "moshimoshi-de237.firebaseapp.com",
  projectId: "moshimoshi-de237",
  storageBucket: "moshimoshi-de237.firebasestorage.app",
  messagingSenderId: "617419549071",
  appId: "1:617419549071:web:3b68066b3d6d2ed99b83fa"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log('🔍 Checking Firestore for articles with TTS audio...\n');

try {
  // Query for recent NHK Easy articles
  const articlesRef = collection(db, 'news_articles');
  const q = query(
    articlesRef,
    where('source', '==', 'NHK Easy'),
    orderBy('publishDate', 'desc'),
    limit(5)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    console.log('ℹ️  No NHK Easy articles found in Firestore');
    console.log('   This means the scraper hasn\'t run yet or articles were deleted\n');
  } else {
    console.log(`✅ Found ${snapshot.size} recent NHK Easy articles:\n`);

    snapshot.forEach((doc, index) => {
      const article = doc.data();
      console.log(`📰 Article ${index + 1}:`);
      console.log(`   Title: ${article.title?.substring(0, 50)}...`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Audio Status: ${article.audioStatus || 'N/A'}`);

      if (article.generatedTitleAudioUrl) {
        console.log(`   ✅ Has TTS Audio:`);
        console.log(`      - Title: ${article.generatedTitleAudioUrl ? '✓' : '✗'}`);
        console.log(`      - Summary: ${article.generatedSummaryAudioUrl ? '✓' : '✗'}`);
        console.log(`      - Content: ${article.generatedContentAudioUrl ? '✓' : '✗'}`);
        console.log(`      - Provider: ${article.audioProvider || 'N/A'}`);
      } else {
        console.log(`   ❌ No TTS audio`);
        if (article.audioError) {
          console.log(`      Error: ${article.audioError}`);
        }
      }
      console.log('');
    });
  }

  // Check for any articles with audio (any source)
  const audioQuery = query(
    articlesRef,
    where('audioStatus', '==', 'generated'),
    limit(3)
  );

  const audioSnapshot = await getDocs(audioQuery);
  if (!audioSnapshot.empty) {
    console.log(`\n🔊 Found ${audioSnapshot.size} articles with generated audio (any source):`);
    audioSnapshot.forEach((doc) => {
      const article = doc.data();
      console.log(`   - ${article.source}: ${article.title?.substring(0, 40)}...`);
    });
  }

  process.exit(0);
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
