/**
 * Direct Comic Generation Trigger
 *
 * This script directly calls the generation logic that the Cloud Function uses
 */

// Set up environment first
process.env.COMIC_SCHEDULER_ADMIN_KEY = process.env.COMIC_SCHEDULER_ADMIN_KEY || 'comic-scheduler-2025';

const path = require('path');
const functionsPath = path.join(__dirname, 'functions');

// Change to functions directory to load the function
process.chdir(functionsPath);

console.log('🚀 Direct Comic Generation Trigger\n');
console.log('Working directory:', process.cwd());
console.log('Loading function from:', functionsPath);
console.log('\n' + '='.repeat(60) + '\n');

async function runGeneration() {
  try {
    // Import the compiled function
    const { generateComicEpisode } = require('./lib/scheduled/comicScheduler');

    console.log('✅ Function loaded successfully\n');
    console.log('Starting generation with admin key...\n');

    const adminKey = process.env.COMIC_SCHEDULER_ADMIN_KEY;

    // Call the generation function directly
    const result = await generateComicEpisode(adminKey);

    console.log('\n' + '='.repeat(60));
    console.log('\n📊 Generation Result:\n');
    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\n🎉 SUCCESS! Comic generation started!\n');
      console.log('Episode ID:', result.episodeId);
      console.log('Episode Number:', result.episodeNumber);
      console.log('Theme:', result.theme);
      console.log('Location:', result.location);
      console.log('\n📝 Check Firestore for generation progress');
      console.log('   Collection: comic_drafts');
      console.log('   Document ID:', result.draftId || result.episodeId);
    } else {
      console.log('\n⚠️  Generation failed:', result.error);
    }

    console.log('\n' + '='.repeat(60));

    process.exit(result.success ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nStack:', error.stack);

    console.log('\n💡 This might mean the functions need to be built first:');
    console.log('   cd functions');
    console.log('   npm run build');
    console.log('   cd ..');
    console.log('   node direct-trigger.js');

    process.exit(1);
  }
}

runGeneration();
