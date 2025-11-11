const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'moshimoshi-de237'
});

const db = admin.firestore();

async function checkArticles() {
  const snapshot = await db.collection('news_articles')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  
  if (snapshot.empty) {
    console.log('No articles found - need to trigger scraper first');
    return;
  }
  
  const article = snapshot.docs[0].data();
  console.log('='.repeat(60));
  console.log('LATEST ARTICLE STRUCTURE');
  console.log('='.repeat(60));
  console.log('\nAvailable fields:', Object.keys(article).sort().join(', '));
  console.log('\n' + '='.repeat(60));
  console.log('RICH CONTENT CHECK');
  console.log('='.repeat(60));
  console.log('✓ Title:', article.title);
  console.log('✓ Has titleWithFurigana:', !!article.titleWithFurigana ? 'YES' : 'NO');
  console.log('✓ Has audioUrl:', !!article.audioUrl ? 'YES' : 'NO');
  console.log('✓ Has contentWithFurigana:', !!article.contentWithFurigana ? 'YES' : 'NO');
  console.log('✓ Has summaryWithFurigana:', !!article.summaryWithFurigana ? 'YES' : 'NO');
  console.log('✓ Source:', article.source);
  console.log('✓ SourceId:', article.sourceId || 'N/A');
  
  if (article.titleWithFurigana) {
    console.log('\n' + '='.repeat(60));
    console.log('FURIGANA SAMPLE');
    console.log('='.repeat(60));
    console.log(article.titleWithFurigana.substring(0, 150));
  }
  
  if (article.audioUrl) {
    console.log('\n' + '='.repeat(60));
    console.log('AUDIO URL');
    console.log('='.repeat(60));
    console.log(article.audioUrl);
  }
  
  console.log('\n' + '='.repeat(60));
}

checkArticles()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
