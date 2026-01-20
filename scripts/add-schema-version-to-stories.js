require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

// Initialize Firebase with service account
const serviceAccount = require('../moshimoshi-service-account.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'moshimoshi-de237'
  });
}
const db = admin.firestore();

const CURRENT_SCHEMA_VERSION = '1.1.0';

async function addSchemaVersionToStories() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('=== Add Schema Version to Stories ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}\n`);
  console.log(`Current Schema Version: ${CURRENT_SCHEMA_VERSION}\n`);

  // Get all published stories
  const storiesSnapshot = await db.collection('stories')
    .where('status', '==', 'published')
    .get();

  console.log(`Found ${storiesSnapshot.size} published stories\n`);

  const results = {
    total: storiesSnapshot.size,
    updated: 0,
    alreadyHasVersion: 0,
    errors: []
  };

  // Process each story
  for (const doc of storiesSnapshot.docs) {
    const story = doc.data();
    const storyId = doc.id;

    console.log(`\n📖 Story: ${story.title}`);
    console.log(`   ID: ${storyId}`);
    console.log(`   Current Schema Version: ${story.schemaVersion || 'none'}`);

    // Check if already has schema version
    if (story.schemaVersion) {
      console.log(`   ✅ Already has schema version: ${story.schemaVersion}`);
      results.alreadyHasVersion++;
      continue;
    }

    try {
      // Add schema version
      if (!dryRun) {
        await db.collection('stories').doc(storyId).update({
          schemaVersion: CURRENT_SCHEMA_VERSION,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`   ✅ Updated with schema version: ${CURRENT_SCHEMA_VERSION}`);
      } else {
        console.log(`   🔍 DRY RUN: Would update with schema version: ${CURRENT_SCHEMA_VERSION}`);
      }

      results.updated++;
    } catch (error) {
      console.log(`   ❌ FAILED: ${error.message}`);
      results.errors.push({
        storyId,
        title: story.title,
        error: error.message
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total stories: ${results.total}`);
  console.log(`Already have version: ${results.alreadyHasVersion}`);
  console.log(`Updated: ${results.updated}`);
  console.log(`Failed: ${results.errors.length}`);

  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach(err => {
      console.log(`  - ${err.title} (${err.storyId}): ${err.error}`);
    });
  }

  if (dryRun) {
    console.log('\n⚠️  This was a DRY RUN. No changes were made.');
    console.log('To actually update stories, run:');
    console.log('  node scripts/add-schema-version-to-stories.js');
  } else {
    console.log('\n✅ Schema version migration completed!');
  }
}

// Run the script
addSchemaVersionToStories()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
