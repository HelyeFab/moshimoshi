/**
 * Final audio verification after all fixes
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function checkStory() {
  const storyId = 'story_1766402709491_scheduler-system';

  console.log('🎉 FINAL VERIFICATION - ALL FIXES DEPLOYED');
  console.log('═'.repeat(80));
  console.log();

  const storyDoc = await db.collection('stories').doc(storyId).get();
  if (storyDoc.exists) {
    const story = storyDoc.data();
    console.log('STORY INFO:');
    console.log('  Title:', story.titleJa || story.title);
    console.log('  JLPT:', story.jlptLevel);
    console.log('  Character:', story.characterSheet?.mainCharacter?.name);
    console.log();
    console.log('═'.repeat(80));
    console.log('AUDIO STATUS');
    console.log('═'.repeat(80));
    console.log('  Story audio (audioUrl):', story.audioUrl ? '✅ PRESENT' : '❌ MISSING');
    if (story.audioUrl) {
      console.log('    URL:', story.audioUrl.substring(0, 100) + '...');
    }
    console.log();
    console.log('  Pages:', story.pages?.length || 0);
    if (story.pages && story.pages.length > 0) {
      const audioCount = story.pages.filter(p => p.audioUrl).length;
      console.log('  Page audio:', `${audioCount}/${story.pages.length}`, audioCount === story.pages.length ? '✅' : '❌');
      story.pages.forEach((p, i) => {
        console.log(`    Page ${i+1}:`, p.audioUrl ? '✅' : '❌');
      });
    }
    console.log();
    console.log('═'.repeat(80));
    console.log('OTHER ASSETS');
    console.log('═'.repeat(80));
    console.log('  Model sheet:', story.modelSheetUrl ? '✅' : '❌');
    console.log('  Cover image:', story.coverImageUrl ? '✅' : '❌');
    const imageCount = story.pages?.filter(p => p.imageUrl).length || 0;
    console.log('  Page images:', `${imageCount}/${story.pages?.length || 0}`, imageCount === (story.pages?.length || 0) ? '✅' : '❌');
    console.log();
    console.log('═'.repeat(80));
    console.log('FINAL RESULT');
    console.log('═'.repeat(80));

    const hasAudio = story.audioUrl && story.pages?.every(p => p.audioUrl);
    if (hasAudio) {
      console.log('🎉 SUCCESS! ALL AUDIO PRESENT!');
      console.log('✅ Audio generation is working correctly!');
      console.log('✅ All fixes verified and deployed!');
    } else {
      console.log('❌ Audio still missing - need further investigation');
    }
    console.log();
    console.log('View story at: https://moshimoshi.app/en/story/interactive/' + storyId);
  } else {
    console.log('❌ Story not found');
  }

  process.exit(0);
}

checkStory().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
