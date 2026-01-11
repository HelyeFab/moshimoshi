const admin = require('./functions/node_modules/firebase-admin');
const serviceAccount = require('./moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkAudio() {
  console.log('\n📊 Episode 13 Audio Check:\n');

  // Check published episode
  const query = await db.collection('comics')
    .where('episodeNumber', '==', 13)
    .get();

  if (!query.empty) {
    const data = query.docs[0].data();

    console.log('Title:', data.title);
    console.log('\n--- Audio Status ---');
    console.log('Full Audio URL:', data.fullAudioUrl || 'NOT FOUND');
    console.log('Audio Status:', data.audioStatus || 'NOT SET');
    console.log('Audio Provider:', data.audioProvider || 'NOT SET');

    console.log('\n--- Panel Audio URLs ---');
    let dialoguesWithAudio = 0;
    let dialoguesTotal = 0;
    let narrationsWithAudio = 0;
    let narrationsTotal = 0;

    if (data.panels) {
      data.panels.forEach((panel, idx) => {
        console.log(`\nPanel ${idx + 1}:`);

        if (panel.dialogues) {
          panel.dialogues.forEach((d, dIdx) => {
            dialoguesTotal++;
            if (d.audioUrl) {
              dialoguesWithAudio++;
              console.log(`  Dialogue ${dIdx + 1} (${d.characterName}): ✓ Has audio`);
            } else {
              console.log(`  Dialogue ${dIdx + 1} (${d.characterName}): ✗ NO AUDIO`);
            }
          });
        }

        if (panel.narration) {
          narrationsTotal++;
          if (panel.narration.audioUrl) {
            narrationsWithAudio++;
            console.log(`  Narration: ✓ Has audio`);
          } else {
            console.log(`  Narration: ✗ NO AUDIO`);
          }
        }
      });
    }

    console.log('\n--- Summary ---');
    console.log(`Dialogues with audio: ${dialoguesWithAudio}/${dialoguesTotal}`);
    console.log(`Narrations with audio: ${narrationsWithAudio}/${narrationsTotal}`);
    console.log(`Full episode audio: ${data.fullAudioUrl ? 'YES' : 'NO'}`);
  } else {
    console.log('Episode 13 not found');
    process.exit(1);
  }

  // Check comic_sentence_data collection for pre-generated audio
  console.log('\n\n--- Comic Sentence Data (Pre-generation) ---');
  const episodeId = 'moshi-goes-to-japan-ep013';
  const sentenceDoc = await db.collection('comic_sentence_data').doc(episodeId).get();

  if (sentenceDoc.exists) {
    const sentenceData = sentenceDoc.data();
    console.log('✓ Sentence data EXISTS');
    console.log('  Episode ID:', sentenceData.episodeId);
    console.log('  Title:', sentenceData.title);
    console.log('  Dialogues pre-generated:', sentenceData.dialogues ? sentenceData.dialogues.length : 0);
    console.log('  Narrations pre-generated:', sentenceData.narrations ? sentenceData.narrations.length : 0);
    console.log('  Full audio URL:', sentenceData.fullAudioUrl ? 'YES' : 'NO');
    console.log('  Generated at:', sentenceData.generatedAt ? sentenceData.generatedAt.toDate() : 'unknown');
  } else {
    console.log('✗ Sentence data NOT FOUND');
    console.log('  This means audio was NOT pre-generated using sentence pre-generator');
  }

  process.exit(0);
}

checkAudio();
