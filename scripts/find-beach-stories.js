/**
 * Find all beach-themed stories
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function findBeachStories() {
  console.log('🏖️  Finding All Beach Stories');
  console.log('═'.repeat(80));
  console.log();

  const storiesRef = db.collection('stories');
  const snapshot = await storiesRef.get();

  const beachStories = [];

  snapshot.forEach(doc => {
    const story = doc.data();
    const title = (story.title || '').toLowerCase();
    const titleJa = (story.titleJa || '').toLowerCase();
    const theme = (story.theme || '').toLowerCase();

    // Check if it's a beach story
    if (title.includes('beach') ||
        titleJa.includes('ビーチ') ||
        titleJa.includes('海') ||
        theme.includes('beach') ||
        theme.includes('海')) {
      beachStories.push({
        id: doc.id,
        title: story.title,
        titleJa: story.titleJa,
        theme: story.theme,
        jlptLevel: story.jlptLevel,
        character: story.characterSheet?.mainCharacter?.name,
        hasAudio: !!story.audioUrl,
        hasModelSheet: !!story.modelSheetUrl,
        hasCover: !!story.coverImageUrl,
        pageCount: story.pages?.length || 0,
        pageAudio: story.pages?.filter(p => p.audioUrl).length || 0,
        pageImages: story.pages?.filter(p => p.imageUrl).length || 0,
        createdAt: story.createdAt?.toDate?.() || new Date(0),
      });
    }
  });

  // Sort by creation date (newest first)
  beachStories.sort((a, b) => b.createdAt - a.createdAt);

  console.log(`Found ${beachStories.length} beach stories:`);
  console.log();

  beachStories.forEach((story, index) => {
    console.log(`${index + 1}. ${story.id}`);
    console.log(`   Title (JA): ${story.titleJa || 'N/A'}`);
    console.log(`   Title (EN): ${story.title || 'N/A'}`);
    console.log(`   Theme: ${story.theme || 'N/A'}`);
    console.log(`   JLPT: ${story.jlptLevel}`);
    console.log(`   Character: ${story.character || 'N/A'}`);
    console.log(`   Created: ${story.createdAt.toISOString().split('T')[0]}`);
    console.log(`   Assets:`);
    console.log(`     Story audio: ${story.hasAudio ? '✓' : '✗'}`);
    console.log(`     Model sheet: ${story.hasModelSheet ? '✓' : '✗'}`);
    console.log(`     Cover: ${story.hasCover ? '✓' : '✗'}`);
    console.log(`     Page audio: ${story.pageAudio}/${story.pageCount}`);
    console.log(`     Page images: ${story.pageImages}/${story.pageCount}`);
    console.log();
  });

  console.log('═'.repeat(80));
  console.log('RECOMMENDATION:');
  console.log('═'.repeat(80));

  if (beachStories.length > 0) {
    // Find the best story (complete with all assets)
    const completeStories = beachStories.filter(s =>
      s.hasAudio &&
      s.hasModelSheet &&
      s.hasCover &&
      s.pageAudio === s.pageCount &&
      s.pageImages === s.pageCount
    );

    if (completeStories.length > 0) {
      const best = completeStories[0]; // Newest complete story
      console.log('KEEP THIS ONE (most recent & complete):');
      console.log(`  ${best.id}`);
      console.log(`  ${best.titleJa}`);
      console.log(`  Created: ${best.createdAt.toISOString().split('T')[0]}`);
      console.log();
      console.log('DELETE THESE:');
      beachStories.filter(s => s.id !== best.id).forEach(s => {
        console.log(`  ${s.id} - ${s.titleJa} (${s.createdAt.toISOString().split('T')[0]})`);
      });
    } else {
      console.log('No complete stories found. Keep the newest one:');
      const newest = beachStories[0];
      console.log(`  ${newest.id} - ${newest.titleJa}`);
      console.log();
      console.log('DELETE THESE:');
      beachStories.slice(1).forEach(s => {
        console.log(`  ${s.id} - ${s.titleJa} (${s.createdAt.toISOString().split('T')[0]})`);
      });
    }
  }

  process.exit(0);
}

findBeachStories().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
