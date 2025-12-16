/**
 * Repair script to link existing storage images to story pages
 * Usage: node scripts/repair-story-pageimages.js [storyId]
 */
const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'moshimoshi-de237.firebasestorage.app',
  });
}

const db = admin.firestore();

async function repairStory(storyId) {
  console.log('=== Repairing Story:', storyId, '===\n');

  // Get the story
  const storyDoc = await db.collection('stories').doc(storyId).get();
  if (!storyDoc.exists) {
    console.log('Story not found!');
    process.exit(1);
  }

  const story = storyDoc.data();
  const pages = story.pages || [];

  console.log('Current pages:', pages.length);

  // Check for missing images
  let missingCount = 0;
  const updatedPages = pages.map(function(page, index) {
    if (page.imageUrl) {
      console.log('  Page', page.pageNumber, ': Has image');
      return page;
    }

    missingCount++;
    const pageNumber = page.pageNumber || (index + 1);

    // Try draft path first (where scheduler saves images)
    const draftId = storyId.replace('story_', 'draft_');
    const draftUrl = 'https://storage.googleapis.com/moshimoshi-de237.firebasestorage.app/ai-stories/' + draftId + '/page-' + pageNumber + '.png';

    console.log('  Page', pageNumber, ': Missing, will try:', draftUrl);

    return {
      ...page,
      imageUrl: draftUrl,
    };
  });

  if (missingCount === 0) {
    console.log('\nNo missing images found!');
    process.exit(0);
  }

  console.log('\nUpdating', missingCount, 'pages with image URLs...');

  // Update the story
  await db.collection('stories').doc(storyId).update({
    pages: updatedPages,
    updatedAt: new Date(),
  });

  console.log('Done! Story updated successfully.');

  // Verify
  const verifyDoc = await db.collection('stories').doc(storyId).get();
  const verifyData = verifyDoc.data();
  console.log('\nVerification:');
  verifyData.pages.forEach(function(p) {
    console.log('  Page', p.pageNumber, ':', p.imageUrl ? 'HAS IMAGE' : 'MISSING');
  });

  process.exit(0);
}

const storyId = process.argv[2] || 'story_1765843219288_scheduler-system';
repairStory(storyId).catch(function(e) {
  console.error('Error:', e);
  process.exit(1);
});
