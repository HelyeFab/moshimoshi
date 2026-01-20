require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

const serviceAccount = require('../moshimoshi-service-account.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function checkWordPrecompute() {
  const storyId = 'story_1768936126759_e2e_test';

  console.log('='.repeat(80));
  console.log('CHECKING WORD PRECOMPUTE FOR TEST STORY');
  console.log('='.repeat(80));

  // Get the story
  const storyDoc = await db.collection('stories').doc(storyId).get();
  if (!storyDoc.exists) {
    console.log('❌ Story not found!');
    return;
  }

  const story = storyDoc.data();

  console.log('\nStory:', story.title);
  console.log('Status:', story.status);
  console.log('Published At:', story.publishedAt?.toDate?.());

  // Check word explanation status fields
  console.log('\n' + '='.repeat(80));
  console.log('WORD EXPLANATION STATUS');
  console.log('='.repeat(80));
  console.log('Status:', story.wordExplanationsStatus || 'NOT SET');
  console.log('Count:', story.wordExplanationsCount || 0);
  console.log('Started At:', story.wordExplanationsStartedAt?.toDate?.() || 'N/A');
  console.log('Completed At:', story.wordExplanationsCompletedAt?.toDate?.() || 'N/A');
  console.log('Failed At:', story.wordExplanationsFailedAt?.toDate?.() || 'N/A');
  console.log('Last Updated:', story.wordExplanationsLastUpdatedAt?.toDate?.() || 'N/A');
  console.log('Error:', story.wordExplanationsError || 'N/A');

  if (story.wordExplanationsProgress) {
    console.log('\nProgress:');
    console.log('  Total Batches:', story.wordExplanationsProgress.totalBatches);
    console.log('  Completed Batches:', story.wordExplanationsProgress.completedBatches);
    console.log('  Total Words:', story.wordExplanationsProgress.totalWords);
    console.log('  Completed Words:', story.wordExplanationsProgress.completedWords);
    console.log('  Current Batch:', story.wordExplanationsProgress.currentBatch);
    console.log('  Percent Complete:', story.wordExplanationsProgress.percentComplete + '%');
  }

  // Check for batch queue document
  console.log('\n' + '='.repeat(80));
  console.log('BATCH QUEUE');
  console.log('='.repeat(80));

  const queueDoc = await db.collection('story_word_batch_queue').doc(storyId).get();
  if (queueDoc.exists) {
    const queue = queueDoc.data();
    console.log('Queue exists:', '✅');
    console.log('Status:', queue.status);
    console.log('Total Batches:', queue.batches?.length || 0);
    console.log('Processed Count:', queue.processedCount || 0);
    console.log('Created At:', queue.createdAt?.toDate?.());
    console.log('Updated At:', queue.updatedAt?.toDate?.());

    if (queue.batches && queue.batches.length > 0) {
      console.log('\nFirst batch preview:');
      const firstBatch = queue.batches[0];
      console.log('  Batch ID:', firstBatch.id);
      console.log('  Status:', firstBatch.status);
      console.log('  Words:', firstBatch.words?.length || 0);
      if (firstBatch.words?.length > 0) {
        console.log('  Sample words:', firstBatch.words.slice(0, 5).join(', '));
      }
    }
  } else {
    console.log('Queue exists:', '❌');
    console.log('\nNote: Batch queue might not have been created yet.');
    console.log('This is normal if the story was just published.');
    console.log('Check Firebase Functions logs for onStoryPublished trigger.');
  }

  // Check for word explanation documents
  console.log('\n' + '='.repeat(80));
  console.log('WORD EXPLANATIONS COLLECTION');
  console.log('='.repeat(80));

  const explanationsSnapshot = await db
    .collection('story_word_explanations')
    .where('storyId', '==', storyId)
    .limit(10)
    .get();

  console.log('Explanations found:', explanationsSnapshot.size);

  if (explanationsSnapshot.size > 0) {
    console.log('\nSample explanations:');
    explanationsSnapshot.docs.slice(0, 5).forEach((doc, idx) => {
      const data = doc.data();
      console.log(`\n  ${idx + 1}. Word: ${data.word}`);
      console.log(`     Reading: ${data.reading || 'N/A'}`);
      console.log(`     Meaning: ${data.meaning?.substring(0, 60) || 'N/A'}...`);
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('CHECK COMPLETE');
  console.log('='.repeat(80));

  // Summary
  console.log('\n📊 SUMMARY:');
  if (story.wordExplanationsStatus === 'complete') {
    console.log('✅ Word precompute COMPLETED');
    console.log('   Total words processed:', story.wordExplanationsCount);
  } else if (story.wordExplanationsStatus === 'generating') {
    console.log('⏳ Word precompute IN PROGRESS');
    console.log('   Progress:', story.wordExplanationsProgress?.percentComplete || 0, '%');
  } else if (story.wordExplanationsStatus === 'pending') {
    console.log('⏸️  Word precompute PENDING (queued but not started)');
  } else if (story.wordExplanationsStatus === 'failed') {
    console.log('❌ Word precompute FAILED');
    console.log('   Error:', story.wordExplanationsError);
  } else {
    console.log('❓ Word precompute NOT STARTED');
    console.log('   Expected: Should trigger automatically on story publish');
    console.log('   Check: Firebase Functions logs for onStoryPublished');
  }

  console.log('\n💡 Notes:');
  console.log('- Word precompute runs asynchronously via Pub/Sub');
  console.log('- Trigger: onStoryPublished function when status changes to "published"');
  console.log('- Processing time: ~9 minutes per batch of 20 words');
  console.log('- Check Firebase Functions logs: firebase functions:log');
}

checkWordPrecompute()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
