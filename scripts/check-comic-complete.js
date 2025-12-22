/**
 * Check if a comic episode is complete with all required data
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function checkComic(episodeId) {
  console.log(`📖 Checking comic episode: ${episodeId}\n`);

  const comicDoc = await db.collection('comics').doc(episodeId).get();

  if (!comicDoc.exists) {
    console.error('❌ Comic not found');
    process.exit(1);
  }

  const comic = comicDoc.data();

  console.log('=== COMIC DATA ===');
  console.log('Episode ID:', episodeId);
  console.log('Title:', comic.title);
  console.log('Title (Japanese):', comic.titleJa);
  console.log('Series ID:', comic.seriesId);
  console.log('Episode Number:', comic.episodeNumber);
  console.log('JLPT Level:', comic.jlptLevel);
  console.log('Status:', comic.status);
  console.log('');

  console.log('=== PANELS ===');
  console.log('Panel count:', comic.panels?.length || 0);
  if (comic.panels) {
    comic.panels.forEach((panel, i) => {
      console.log(`Panel ${i + 1}:`);
      console.log(`  - Has image: ${!!panel.imageUrl}`);
      console.log(`  - Has dialogue: ${!!panel.dialogue}`);
      console.log(`  - Has narration: ${!!panel.narration}`);
    });
  }
  console.log('');

  console.log('=== AUDIO ===');
  console.log('Has full audio:', !!comic.fullAudioUrl);
  console.log('Dialogue count:', comic.dialogueCount || 0);
  console.log('Narration count:', comic.narrationCount || 0);
  console.log('');

  console.log('=== VOCABULARY ===');
  console.log('Vocabulary count:', comic.vocabulary?.length || 0);
  console.log('');

  console.log('=== CULTURAL NOTES ===');
  console.log('Cultural notes count:', comic.culturalNotes?.length || 0);
  console.log('');

  console.log('=== QUIZ ===');
  console.log('Quiz questions:', comic.quiz?.length || 0);
  console.log('');

  console.log('=== SUMMARY ===');
  const checks = {
    hasTitle: !!comic.title && !!comic.titleJa,
    hasPanels: (comic.panels?.length || 0) > 0,
    allPanelsHaveImages: comic.panels?.every(p => !!p.imageUrl) || false,
    hasAudio: !!comic.fullAudioUrl,
    hasVocabulary: (comic.vocabulary?.length || 0) > 0,
    hasCulturalNotes: (comic.culturalNotes?.length || 0) > 0,
    hasQuiz: (comic.quiz?.length || 0) > 0,
    isPublished: comic.status === 'published',
  };

  Object.entries(checks).forEach(([key, value]) => {
    const icon = value ? '✅' : '❌';
    console.log(`${icon} ${key}`);
  });

  const allChecks = Object.values(checks).every(v => v);
  console.log('');
  console.log(allChecks ? '🎉 COMIC IS COMPLETE!' : '⚠️  COMIC HAS MISSING DATA');

  process.exit(allChecks ? 0 : 1);
}

const episodeId = process.argv[2] || 'moshi-goes-to-japan-ep006';
checkComic(episodeId).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
