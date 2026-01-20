require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

const serviceAccount = require('../moshimoshi-service-account.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function checkQuizQuality() {
  // Check The Cherry Blossom Tea Ceremony
  const doc = await db.collection('stories').doc('story_1768153080975_8onZzlQg3tQxkw8pinSF9ow4Q6j2').get();
  const story = doc.data();

  console.log('Story:', story.title);
  console.log('Quiz questions:', story.quiz?.length || 0);
  console.log('\n' + '='.repeat(80));

  story.quiz?.forEach((q, i) => {
    console.log(`\nQuestion ${i+1}:`);
    console.log('  EN:', q.question);
    console.log('  JA:', q.questionJa || 'MISSING');
    console.log('  Options (EN):', q.options?.length || 0);
    if (q.options?.length > 0) {
      q.options.forEach((opt, idx) => console.log(`    ${idx + 1}. ${opt}`));
    }
    console.log('  Options (JA):', q.optionsJa?.length || 0);
    if (q.optionsJa?.length > 0) {
      q.optionsJa.forEach((opt, idx) => console.log(`    ${idx + 1}. ${opt}`));
    }
    console.log('  Has EN explanation:', !!q.explanation);
    console.log('  Has JA explanation:', !!q.explanationJa);
  });
}

checkQuizQuality()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
