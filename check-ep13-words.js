const admin = require('./functions/node_modules/firebase-admin');
const serviceAccount = require('./moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkWords() {
  console.log('\n📊 Episode 13 Word Explanations Check:\n');

  const episodeId = 'moshi-goes-to-japan-ep013';

  // Check word_explanations collection
  const wordDoc = await db.collection('word_explanations').doc(episodeId).get();

  if (wordDoc.exists) {
    const data = wordDoc.data();
    console.log('✅ Word explanations PRE-GENERATED!');
    console.log('\nDetails:');
    console.log('  Episode ID:', data.contentId);
    console.log('  Content Type:', data.contentType);
    console.log('  Words extracted:', data.words ? data.words.length : 0);
    console.log('  JLPT Level:', data.jlptLevel);
    console.log('  Generated at:', data.generatedAt ? data.generatedAt.toDate() : 'unknown');

    if (data.words && data.words.length > 0) {
      console.log('\nFirst 10 words with explanations:');
      data.words.slice(0, 10).forEach((word, idx) => {
        console.log(`  ${idx + 1}. ${word.word} (${word.reading}) - ${word.meaning}`);
        console.log(`     JLPT: ${word.jlptLevel || 'N/A'} | Part: ${word.partOfSpeech || 'N/A'}`);
      });
    }

    console.log('\nTotal words pre-generated:', data.words ? data.words.length : 0);
  } else {
    console.log('✗ Word explanations NOT PRE-GENERATED');
    console.log('  No document found in word_explanations collection');
  }

  // Also check the published episode for vocabulary field
  console.log('\n\n--- Episode Vocabulary Field ---');
  const episodeQuery = await db.collection('comics')
    .where('episodeNumber', '==', 13)
    .get();

  if (!episodeQuery.empty) {
    const episodeData = episodeQuery.docs[0].data();
    if (episodeData.vocabulary) {
      console.log('Episode has vocabulary field with', episodeData.vocabulary.length, 'words');
      console.log('First 3 vocabulary items:');
      episodeData.vocabulary.slice(0, 3).forEach((v, idx) => {
        console.log(`  ${idx + 1}. ${v.word} - ${v.meaning}`);
      });
    } else {
      console.log('Episode has NO vocabulary field');
    }
  }

  process.exit(0);
}

checkWords();
