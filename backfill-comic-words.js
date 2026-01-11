/**
 * Backfill Word Explanations for Existing Comic Episodes
 *
 * Simple standalone script that runs from project root.
 *
 * Usage:
 *   node backfill-comic-words.js --dry-run      # Preview what will be done
 *   node backfill-comic-words.js                # Actually generate word explanations
 *   node backfill-comic-words.js --episode 13   # Backfill specific episode only
 */

const admin = require('./functions/node_modules/firebase-admin');
const serviceAccount = require('./moshimoshi-service-account.json');
const fetch = require('node-fetch');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const specificEpisode = args.find((arg, idx, arr) => arg === '--episode' && arr[idx + 1])
  ? parseInt(args[args.indexOf('--episode') + 1])
  : null;

// App URL for API calls
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

function extractComicText(comicData) {
  if (!comicData.panels || !Array.isArray(comicData.panels)) {
    return '';
  }

  const text = comicData.panels
    .map(panel => {
      const dialogueText = panel.dialogues?.map(d => d.textJa || '').join(' ') || '';
      const narrationText = panel.narration?.textJa || '';
      return `${dialogueText} ${narrationText}`.trim();
    })
    .filter(text => text.length > 0)
    .join('\n');

  return text;
}

async function checkWordExplanationsExist(episodeId) {
  const wordDoc = await db.collection('word_explanations').doc(episodeId).get();
  return wordDoc.exists;
}

async function callWordPrecomputeAPI(episodeId, comicText, jlptLevel) {
  // Call the word precompute API endpoint
  const response = await fetch(`${APP_URL}/api/admin/precompute/words`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contentId: episodeId,
      contentType: 'comic',
      text: comicText,
      jlptLevel: jlptLevel || 'N5',
      limit: 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error (${response.status}): ${error}`);
  }

  return response.json();
}

async function generateWordExplanationsForEpisode(comic, episodeNumber) {
  const episodeId = `moshi-goes-to-japan-ep${String(episodeNumber).padStart(3, '0')}`;

  console.log(`\n📝 Episode ${episodeNumber}: ${comic.title}`);

  // Check if already exists
  const alreadyExists = await checkWordExplanationsExist(episodeId);
  if (alreadyExists) {
    console.log('  ✓ Word explanations already exist - SKIPPING');
    return { skipped: true, episodeNumber };
  }

  // Extract text from comic
  const comicText = extractComicText(comic);
  if (!comicText || comicText.trim().length === 0) {
    console.log('  ⚠️  No text found in comic panels - SKIPPING');
    return { skipped: true, episodeNumber, reason: 'no text' };
  }

  const textPreview = comicText.substring(0, 100) + (comicText.length > 100 ? '...' : '');
  console.log(`  Text extracted: ${textPreview}`);
  console.log(`  Total text length: ${comicText.length} characters`);
  console.log(`  JLPT Level: ${comic.jlptLevel || 'N5'}`);

  if (isDryRun) {
    console.log('  [DRY RUN] Would generate word explanations');
    return { dryRun: true, episodeNumber, textLength: comicText.length };
  }

  // Generate word explanations via API
  try {
    console.log('  🔄 Generating word explanations...');

    const result = await callWordPrecomputeAPI(episodeId, comicText, comic.jlptLevel);

    console.log(`  ✅ SUCCESS! Generated ${result.total} word explanations`);
    console.log(`     - New: ${result.generated}`);
    console.log(`     - Cached: ${result.cached}`);

    return {
      success: true,
      episodeNumber,
      total: result.total,
      generated: result.generated,
      cached: result.cached
    };
  } catch (error) {
    console.error(`  ❌ FAILED: ${error.message}`);
    return {
      failed: true,
      episodeNumber,
      error: error.message
    };
  }
}

async function backfillComicWordExplanations() {
  console.log('\n🚀 Comic Word Explanations Backfill Script\n');
  console.log('Mode:', isDryRun ? '🔍 DRY RUN (preview only)' : '✍️  LIVE (will generate explanations)');

  if (specificEpisode) {
    console.log(`Target: Episode ${specificEpisode} only\n`);
  } else {
    console.log('Target: All published episodes\n');
  }

  console.log('─'.repeat(60));

  // Fetch all published comic episodes
  let query = db.collection('comics').orderBy('episodeNumber', 'asc');

  if (specificEpisode) {
    query = query.where('episodeNumber', '==', specificEpisode);
  }

  const comicsSnapshot = await query.get();

  if (comicsSnapshot.empty) {
    console.log('\n❌ No comic episodes found');
    process.exit(0);
  }

  console.log(`\nFound ${comicsSnapshot.size} comic episode(s)\n`);

  const results = {
    total: 0,
    skipped: 0,
    dryRun: 0,
    success: 0,
    failed: 0,
    details: []
  };

  // Process each episode
  for (const doc of comicsSnapshot.docs) {
    results.total++;
    const comic = doc.data();
    const episodeNumber = comic.episodeNumber;

    const result = await generateWordExplanationsForEpisode(comic, episodeNumber);
    results.details.push(result);

    if (result.skipped) results.skipped++;
    else if (result.dryRun) results.dryRun++;
    else if (result.success) results.success++;
    else if (result.failed) results.failed++;

    // Small delay between episodes to avoid rate limits
    if (!isDryRun && !result.skipped) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Print summary
  console.log('\n' + '─'.repeat(60));
  console.log('\n📊 BACKFILL SUMMARY\n');
  console.log(`Total episodes processed: ${results.total}`);
  console.log(`  ✓ Skipped (already exists): ${results.skipped}`);

  if (isDryRun) {
    console.log(`  🔍 Would generate: ${results.dryRun}`);
  } else {
    console.log(`  ✅ Successfully generated: ${results.success}`);
    console.log(`  ❌ Failed: ${results.failed}`);
  }

  if (results.failed > 0) {
    console.log('\n❌ Failed episodes:');
    results.details
      .filter(r => r.failed)
      .forEach(r => {
        console.log(`  - Episode ${r.episodeNumber}: ${r.error}`);
      });
  }

  if (isDryRun && results.dryRun > 0) {
    console.log('\n💡 To actually generate word explanations, run without --dry-run flag:');
    console.log('   node backfill-comic-words.js');
  } else if (results.success > 0) {
    console.log('\n✨ Word explanations successfully backfilled!');
    console.log('\nYou can verify by checking the word_explanations collection in Firestore.');
  }

  console.log('\n');
  process.exit(0);
}

// Run the backfill
backfillComicWordExplanations().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
