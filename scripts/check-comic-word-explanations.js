/**
 * Check if comic word explanations are being pre-generated
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function checkComicWordExplanations() {
  console.log('📋 Checking comic_word_explanations collection:\n');

  const snapshot = await db.collection('comic_word_explanations').limit(10).get();

  console.log('Total documents found:', snapshot.size);

  if (snapshot.size === 0) {
    console.log('\n❌ COLLECTION IS EMPTY!');
    console.log('Word explanations are NOT being pre-generated for comics.');
    console.log('\nThis means:');
    console.log('- Users must wait for real-time API calls when clicking words');
    console.log('- Slower user experience compared to news articles');
    console.log('- Higher API costs (on-demand vs. pre-generated)');
  } else {
    console.log('\n✅ Word explanations ARE being pre-generated!\n');

    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`${index + 1}. Episode ID: ${doc.id}`);
      console.log(`   Words count: ${data.words?.length || 0}`);
      console.log(`   Created at: ${data.createdAt?.toDate?.() || 'unknown'}`);

      if (data.words && data.words.length > 0) {
        console.log(`   Sample words: ${data.words.slice(0, 3).map(w => w.word).join(', ')}`);
      }
      console.log('');
    });
  }

  // Also check a specific recent episode
  console.log('\n📋 Checking latest episode (ep010):\n');
  const ep010Doc = await db.collection('comic_word_explanations').doc('moshi-goes-to-japan-ep010').get();

  if (ep010Doc.exists) {
    const data = ep010Doc.data();
    console.log('✅ Episode 10 HAS word explanations');
    console.log('   Word count:', data.words?.length || 0);
  } else {
    console.log('❌ Episode 10 has NO word explanations document');
  }

  process.exit(0);
}

checkComicWordExplanations().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
