/**
 * Check published comic episode data
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function checkPublishedComic(episodeId) {
  console.log(`📋 Checking published comic: ${episodeId}\n`);

  const comicDoc = await db.collection('comics').doc(episodeId).get();

  if (!comicDoc.exists) {
    console.error('❌ Comic not found');
    process.exit(1);
  }

  const comic = comicDoc.data();

  console.log('=== PUBLISHED COMIC DATA ===');
  console.log('Episode ID:', episodeId);
  console.log('Title:', comic.title);
  console.log('JLPT Level:', comic.jlptLevel);
  console.log('');

  console.log('=== CULTURAL NOTES ===');
  console.log('Count:', comic.culturalNotes?.length || 0);
  if (comic.culturalNotes) {
    comic.culturalNotes.forEach((note, i) => {
      console.log(`  ${i + 1}. ${note.title || note.titleJa || 'Untitled'}`);
    });
  }
  console.log('');

  console.log('=== QUIZ ===');
  console.log('Type:', typeof comic.quiz);
  console.log('Quiz object:', comic.quiz ? 'exists' : 'null/undefined');

  if (comic.quiz) {
    console.log('Quiz keys:', Object.keys(comic.quiz));
    console.log('Has questions:', !!comic.quiz.questions);
    console.log('Questions is array:', Array.isArray(comic.quiz.questions));
    console.log('Questions count:', comic.quiz.questions?.length || 0);
    console.log('Passing score:', comic.quiz.passingScore);

    if (comic.quiz.questions && comic.quiz.questions.length > 0) {
      console.log('\nFirst question:');
      console.log(JSON.stringify(comic.quiz.questions[0], null, 2));
    }
  } else {
    console.log('❌ No quiz data found');
  }
  console.log('');

  console.log('=== VOCABULARY ===');
  console.log('Count:', comic.vocabulary?.length || 0);

  process.exit(0);
}

const episodeId = process.argv[2] || 'moshi-goes-to-japan-ep008';
checkPublishedComic(episodeId).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
