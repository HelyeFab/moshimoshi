/**
 * Check comic dialogues for repetition issues
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function checkDialogues(episodeId) {
  console.log(`📋 Checking dialogues for: ${episodeId}\n`);

  const comicDoc = await db.collection('comics').doc(episodeId).get();

  if (!comicDoc.exists) {
    console.error('❌ Comic not found');
    process.exit(1);
  }

  const comic = comicDoc.data();

  console.log('=== EPISODE INFO ===');
  console.log('Title:', comic.title);
  console.log('Title (JA):', comic.titleJa);
  console.log('Theme:', comic.theme);
  console.log('Location:', comic.location);
  console.log('JLPT Level:', comic.jlptLevel);
  console.log('Panel count:', comic.panels?.length || 0);
  console.log('');

  console.log('=== PANEL DIALOGUES ===\n');

  comic.panels?.forEach((panel, index) => {
    console.log(`--- PANEL ${index + 1} ---`);
    console.log('Scene:', panel.sceneDescription);
    console.log('Characters in panel:', panel.characters || 'not specified');
    console.log('Image URL:', panel.imageUrl ? 'exists' : 'missing');

    if (panel.dialogues && panel.dialogues.length > 0) {
      panel.dialogues.forEach((dialogue, dIndex) => {
        console.log(`  [${dialogue.characterName}]: ${dialogue.textJa}`);
        console.log(`    EN: ${dialogue.textEn}`);
        console.log(`    Emotion: ${dialogue.emotion || 'not specified'}`);
      });
    } else {
      console.log('  (no dialogues)');
    }

    if (panel.narration) {
      console.log(`  [Narration]: ${panel.narration.textJa}`);
      console.log(`    EN: ${panel.narration.textEn}`);
    }
    console.log('');
  });

  process.exit(0);
}

const episodeId = process.argv[2] || 'moshi-goes-to-japan-ep001';
checkDialogues(episodeId).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
