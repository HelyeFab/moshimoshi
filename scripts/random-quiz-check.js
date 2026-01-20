require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

const serviceAccount = require('../moshimoshi-service-account.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function randomQuizCheck() {
  // Get all published stories
  const storiesSnapshot = await db.collection('stories')
    .where('status', '==', 'published')
    .get();

  const allStories = storiesSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  // Randomly select 5 stories
  const shuffled = allStories.sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, 5);

  console.log('='.repeat(80));
  console.log('RANDOM QUIZ QUALITY CHECK (5 stories)');
  console.log('='.repeat(80));

  selected.forEach((story, idx) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Story ${idx + 1}: ${story.title}`);
    console.log(`JLPT: ${story.jlptLevel} | ID: ${story.id}`);
    console.log('='.repeat(80));

    const quiz = story.quiz || [];
    console.log(`Total questions: ${quiz.length}`);

    // Check first 2 questions from each story
    quiz.slice(0, 2).forEach((q, i) => {
      console.log(`\n--- Question ${i + 1} ---`);
      console.log(`EN: ${q.question}`);
      console.log(`JA: ${q.questionJa || 'MISSING'}`);

      // Check for ruby tags (should be NONE)
      const hasRubyTags = q.questionJa?.includes('<ruby>') ||
                          q.optionsJa?.some(opt => opt?.includes('<ruby>'));
      if (hasRubyTags) {
        console.log('⚠️  WARNING: Found ruby tags!');
      } else {
        console.log('✅ Clean Japanese (no ruby tags)');
      }

      console.log('\nOptions:');
      q.options?.forEach((opt, idx) => {
        console.log(`  ${idx + 1}. EN: ${opt}`);
        console.log(`     JA: ${q.optionsJa?.[idx] || 'MISSING'}`);
      });

      // Validation
      const issues = [];
      if (!q.questionJa) issues.push('questionJa missing');
      if (!q.explanationJa) issues.push('explanationJa missing');
      if (!q.optionsJa || q.optionsJa.length !== q.options?.length) {
        issues.push('optionsJa missing/incomplete');
      }

      if (issues.length > 0) {
        console.log(`\n❌ Issues: ${issues.join(', ')}`);
      } else {
        console.log('\n✅ All bilingual fields present');
      }
    });
  });

  console.log('\n' + '='.repeat(80));
  console.log('CHECK COMPLETE');
  console.log('='.repeat(80));
}

randomQuizCheck()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
