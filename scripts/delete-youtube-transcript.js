#!/usr/bin/env node

/**
 * Delete YouTube Transcript Script
 *
 * Deletes YouTube transcripts from the transcriptCache collection in Firebase.
 * Also deletes related word explanations from youtube_word_explanations collection.
 *
 * Usage:
 *   node scripts/delete-youtube-transcript.js [options] [videoId1] [videoId2] ...
 *
 * Options:
 *   --dry-run         Preview deletions without actually deleting
 *   --content-id=ID   Delete by content ID (e.g., youtube_nSOQdg28Btg)
 *   --video-id=ID     Delete by YouTube video ID (e.g., nSOQdg28Btg)
 *   --all             Delete ALL transcripts (requires confirmation)
 *   --force           Skip the 5-second safety delay
 *
 * Examples:
 *   # Delete specific video transcript
 *   node scripts/delete-youtube-transcript.js nSOQdg28Btg
 *
 *   # Delete multiple transcripts
 *   node scripts/delete-youtube-transcript.js nSOQdg28Btg abc123 xyz789
 *
 *   # Delete by content ID
 *   node scripts/delete-youtube-transcript.js --content-id=youtube_nSOQdg28Btg
 *
 *   # Preview what would be deleted
 *   node scripts/delete-youtube-transcript.js --dry-run nSOQdg28Btg
 *
 *   # Delete all transcripts (dangerous!)
 *   node scripts/delete-youtube-transcript.js --all
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../moshimoshi-service-account.json');
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const deleteAll = args.includes('--all');
const force = args.includes('--force');

const contentIdArg = args.find(a => a.startsWith('--content-id='));
const specificContentId = contentIdArg ? contentIdArg.split('=')[1] : null;

const videoIdArg = args.find(a => a.startsWith('--video-id='));
const specificVideoId = videoIdArg ? videoIdArg.split('=')[1] : null;

// Get positional arguments (video IDs without flags)
const positionalArgs = args.filter(a => !a.startsWith('--'));

/**
 * Convert video ID to content ID format
 */
function toContentId(videoId) {
  if (videoId.startsWith('youtube_')) {
    return videoId;
  }
  return `youtube_${videoId}`;
}

/**
 * Extract video ID from content ID
 */
function toVideoId(contentId) {
  if (contentId.startsWith('youtube_')) {
    return contentId.replace('youtube_', '');
  }
  return contentId;
}

/**
 * Check if word explanations exist for a video
 */
async function hasWordExplanations(videoId) {
  const doc = await db.collection('youtube_word_explanations').doc(videoId).get();
  return doc.exists;
}

/**
 * Fetch transcript details for display
 */
async function getTranscriptDetails(contentId) {
  const doc = await db.collection('transcriptCache').doc(contentId).get();

  if (!doc.exists) {
    return null;
  }

  const data = doc.data();
  const videoId = toVideoId(contentId);
  const hasWordExpl = await hasWordExplanations(videoId);

  return {
    contentId,
    videoId,
    title: data.title || 'Unknown',
    channelName: data.channelName || 'Unknown',
    segmentCount: data.transcript?.length || 0,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.fetchedAt || 'Unknown',
    hasTranslations: data.transcript?.some(s => s.translation) || false,
    hasWordExplanations: hasWordExpl,
  };
}

/**
 * Delete transcripts
 */
async function deleteTranscripts() {
  console.log('\n🗑️  YouTube Transcript Deletion Script');
  console.log('═'.repeat(60));

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  let contentIds = [];

  // Determine which transcripts to delete
  if (deleteAll) {
    console.log('⚠️  WARNING: --all flag detected');
    console.log('   This will delete ALL transcripts in the database!\n');

    const snapshot = await db.collection('transcriptCache').get();
    contentIds = snapshot.docs.map(doc => doc.id);

    if (contentIds.length === 0) {
      console.log('ℹ️  No transcripts found in database');
      process.exit(0);
    }

    console.log(`📊 Found ${contentIds.length} transcripts to delete\n`);
  } else if (specificContentId) {
    contentIds = [specificContentId];
  } else if (specificVideoId) {
    contentIds = [toContentId(specificVideoId)];
  } else if (positionalArgs.length > 0) {
    contentIds = positionalArgs.map(toContentId);
  } else {
    console.log('❌ Error: No transcripts specified\n');
    console.log('Usage:');
    console.log('  node scripts/delete-youtube-transcript.js <videoId1> [videoId2] ...');
    console.log('  node scripts/delete-youtube-transcript.js --content-id=youtube_abc123');
    console.log('  node scripts/delete-youtube-transcript.js --video-id=abc123');
    console.log('  node scripts/delete-youtube-transcript.js --all\n');
    console.log('Options:');
    console.log('  --dry-run    Preview deletions without making changes');
    console.log('  --force      Skip the 5-second safety delay');
    process.exit(1);
  }

  // Fetch details for all transcripts
  console.log('📋 Transcripts to be deleted:\n');
  const transcriptsToDelete = [];

  for (const contentId of contentIds) {
    const details = await getTranscriptDetails(contentId);

    if (!details) {
      console.log(`  ❌ NOT FOUND: ${contentId}`);
      continue;
    }

    transcriptsToDelete.push(details);

    console.log(`  • ${details.title}`);
    console.log(`    Video ID: ${details.videoId}`);
    console.log(`    Content ID: ${details.contentId}`);
    console.log(`    Channel: ${details.channelName}`);
    console.log(`    Segments: ${details.segmentCount}`);
    console.log(`    Has Translations: ${details.hasTranslations ? 'Yes' : 'No'}`);
    console.log(`    Has Word Explanations: ${details.hasWordExplanations ? 'Yes' : 'No'}`);
    console.log(`    Created: ${details.createdAt}`);
    console.log();
  }

  if (transcriptsToDelete.length === 0) {
    console.log('\n❌ No valid transcripts found to delete');
    process.exit(1);
  }

  const wordExplCount = transcriptsToDelete.filter(t => t.hasWordExplanations).length;
  console.log('═'.repeat(60));
  console.log(`📊 Summary: ${transcriptsToDelete.length} transcript(s) will be ${dryRun ? 'previewed' : 'PERMANENTLY DELETED'}`);
  if (wordExplCount > 0) {
    console.log(`   Also: ${wordExplCount} word explanation doc(s) will be deleted`);
  }
  console.log('═'.repeat(60));
  console.log();

  if (dryRun) {
    console.log('✅ Dry run complete. No changes were made.');
    console.log('   Remove --dry-run flag to actually delete.\n');
    process.exit(0);
  }

  // Safety delay
  if (!force) {
    console.log('⏳ Starting deletion in 5 seconds...');
    console.log('   Press Ctrl+C to cancel\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  console.log('🔥 Deleting transcripts and word explanations...\n');

  // Use batch for efficiency (max 500 per batch, but we may have 2 docs per transcript)
  const batchSize = 250;
  let transcriptDeleteCount = 0;
  let wordExplDeleteCount = 0;
  let errorCount = 0;

  for (let i = 0; i < transcriptsToDelete.length; i += batchSize) {
    const batchItems = transcriptsToDelete.slice(i, i + batchSize);
    const batch = db.batch();

    for (const transcript of batchItems) {
      // Delete transcript from transcriptCache
      const transcriptRef = db.collection('transcriptCache').doc(transcript.contentId);
      batch.delete(transcriptRef);

      // Also delete word explanations if they exist
      if (transcript.hasWordExplanations) {
        const wordExplRef = db.collection('youtube_word_explanations').doc(transcript.videoId);
        batch.delete(wordExplRef);
      }
    }

    try {
      await batch.commit();

      for (const transcript of batchItems) {
        console.log(`  ✓ Deleted transcript: ${transcript.title} (${transcript.videoId})`);
        transcriptDeleteCount++;
        if (transcript.hasWordExplanations) {
          console.log(`  ✓ Deleted word explanations: ${transcript.videoId}`);
          wordExplDeleteCount++;
        }
      }
    } catch (error) {
      console.error(`  ❌ Batch error:`, error.message);
      errorCount += batchItems.length;
    }
  }

  console.log();
  console.log('═'.repeat(60));
  console.log(`✅ Deletion complete!`);
  console.log(`   Transcripts deleted: ${transcriptDeleteCount}`);
  console.log(`   Word explanations deleted: ${wordExplDeleteCount}`);
  if (errorCount > 0) {
    console.log(`   Errors: ${errorCount}`);
  }
  console.log('═'.repeat(60));
  console.log();

  process.exit(errorCount > 0 ? 1 : 0);
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n❌ Deletion cancelled by user');
  process.exit(0);
});

// Run
deleteTranscripts().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
