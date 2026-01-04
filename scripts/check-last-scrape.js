const admin = require('firebase-admin');
const path = require('path');

// Load service account
const serviceAccountPath = path.join(__dirname, '..', 'moshimoshi-service-account.json');
const serviceAccount = require(serviceAccountPath);

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'moshimoshi-de237.firebasestorage.app',
  });
}

const db = admin.firestore();

async function checkLastScrape() {
  try {
    // Check scraping_logs for last scheduled run
    console.log('=== SCRAPING LOGS (Last 10 Runs - All Types) ===');
    const logsSnapshot = await db.collection('scraping_logs')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    if (logsSnapshot.empty) {
      console.log('❌ No scraping logs found');
    } else {
      logsSnapshot.forEach(doc => {
        const data = doc.data();
        const timestamp = data.createdAt?.toDate?.() || 'Unknown';
        const type = data.type || 'unknown';
        console.log(`\n📅 ${type.toUpperCase()} - Run at: ${timestamp}`);
        console.log(`   Success: ${data.success || false}`);
        console.log(`   Total Articles: ${data.totalArticles || 0}`);
        console.log(`   Successful Sources: ${data.successfulSources || 0}/${Object.keys(data.sources || {}).length}`);
        console.log(`   Duration: ${data.duration}ms`);
        if (data.sources) {
          Object.entries(data.sources).forEach(([sourceName, sourceData]) => {
            console.log(`   - ${sourceName}:`, sourceData.success ? `✅ ${sourceData.articles || 0} articles` : `❌ ${sourceData.error || 'Failed'}`);
          });
        }
      });
    }

    // Check news_articles for last created article
    console.log('\n\n=== LAST 10 ARTICLES CREATED ===');
    const articlesSnapshot = await db.collection('news_articles')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    if (articlesSnapshot.empty) {
      console.log('❌ No articles found in collection');
    } else {
      articlesSnapshot.forEach((doc, index) => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate?.() || 'Unknown';
        const publishDate = data.publishDate?.toDate?.() || 'Unknown';
        const now = new Date();
        const ageHours = data.createdAt?.toDate ? ((now - data.createdAt.toDate()) / (1000 * 60 * 60)).toFixed(1) : '?';

        console.log(`\n${index + 1}. Article ID: ${doc.id}`);
        console.log(`   Title: ${data.title?.substring(0, 60)}...`);
        console.log(`   Source: ${data.source}`);
        console.log(`   Created: ${createdAt} (${ageHours}h ago)`);
        console.log(`   Published: ${publishDate}`);
        console.log(`   Audio: ${data.generatedContentAudioUrl ? '✅' : '❌'}`);
        console.log(`   Translations: ${data.hasTranslations ? '✅' : '❓'}`);
      });
    }

    // Check scheduler status
    console.log('\n\n=== SCHEDULER CONFIGURATION ===');
    console.log('Schedule: Daily at 12:00 JST (03:00 UTC)');
    console.log('Region: Asia/Tokyo');
    console.log('Limit: 1 article per run');
    console.log('Sources: NHK Easy only');

    const now = new Date();
    const jstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    console.log(`\nCurrent JST Time: ${jstNow.toISOString()}`);
    console.log(`Current UTC Time: ${now.toISOString()}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
  process.exit(0);
}

checkLastScrape();
