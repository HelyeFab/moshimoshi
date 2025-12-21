/**
 * Test the new story generation with checkpoint support
 * Triggers a manual story generation via the Cloud Function
 */
const https = require('https');

const FUNCTIONS_URL = 'https://us-central1-moshimoshi-de237.cloudfunctions.net';
const ADMIN_KEY = process.env.STORY_SCHEDULER_ADMIN_KEY || 'story-scheduler-2025';

async function triggerStoryGeneration() {
  console.log('=== Testing Story Generation with Checkpoints ===\n');
  console.log('Triggering manual story generation...');
  console.log('This will take 3-5 minutes. Watch for checkpoint updates.\n');

  const startTime = Date.now();

  try {
    const response = await fetch(`${FUNCTIONS_URL}/manualStoryGeneratorFunction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          adminKey: ADMIN_KEY,
        },
      }),
    });

    const result = await response.json();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n=== Result ===');
    console.log(`Duration: ${duration}s`);
    console.log(`Response:`, JSON.stringify(result, null, 2));

    if (result.result?.success) {
      console.log('\n✅ Story generated successfully!');
      console.log(`   Story ID: ${result.result.storyId}`);
      console.log(`   Draft ID: ${result.result.draftId}`);
    } else if (result.result?.error?.includes('pending')) {
      console.log('\n⏳ Story saved as pending (images failed)');
      console.log('   Run this script again to resume from checkpoint');
      console.log(`   Draft ID: ${result.result.draftId}`);
    } else {
      console.log('\n❌ Generation failed');
      console.log(`   Error: ${result.result?.error || result.error}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

triggerStoryGeneration();
