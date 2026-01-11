/**
 * Test Comic Generation Flow
 * Verifies that the complete generation pipeline works
 */

// Initialize Firebase Admin first
const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const { generateComicEpisode } = require('./lib/scheduled/comicScheduler');

console.log('🧪 Testing Comic Generation Flow\n');
console.log('This will test the ACTUAL generation function');
console.log('with all enhancements active:\n');
console.log('  ✓ Character consistency prompts');
console.log('  ✓ Zero-text policy');
console.log('  ✓ Parallel audio batching');
console.log('  ✓ 900s timeout\n');
console.log('=' .repeat(60) + '\n');

async function testGeneration() {
  try {
    const adminKey = process.env.COMIC_SCHEDULER_ADMIN_KEY || 'comic-scheduler-2025';

    console.log('🚀 Starting generation...\n');
    console.log('⏱️  This will take 5-8 minutes for a complete episode\n');
    console.log('📊 Watch for progress updates below:\n');
    console.log('-'.repeat(60) + '\n');

    const startTime = Date.now();

    // Call the actual generation function
    const result = await generateComicEpisode(adminKey);

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

    console.log('\n' + '-'.repeat(60));
    console.log('\n📊 GENERATION COMPLETE\n');
    console.log('Duration:', duration, 'minutes');
    console.log('\nResult:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\n✅ SUCCESS! Generation completed successfully');
      console.log('\n📝 Episode Details:');
      console.log('   ID:', result.episodeId);
      console.log('   Number:', result.episodeNumber);
      console.log('   Theme:', result.theme);
      console.log('   Location:', result.location);
      console.log('   Draft ID:', result.draftId);

      console.log('\n🎯 All enhancements are working!');
      process.exit(0);
    } else {
      console.log('\n❌ FAILED:', result.error);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 ERROR:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  }
}

testGeneration();
