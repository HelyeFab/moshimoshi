/**
 * Trigger manual story generation via Firebase Callable Function
 * Usage: node scripts/trigger-story-generation.js
 */
const https = require('https');

const FIREBASE_PROJECT = 'moshimoshi-de237';
const FUNCTION_NAME = 'manualStoryGeneratorFunction';
const REGION = 'us-central1';
const ADMIN_KEY = process.env.STORY_SCHEDULER_ADMIN_KEY || 'story-scheduler-2025';

// Firebase Callable Function URL format
const url = `https://${REGION}-${FIREBASE_PROJECT}.cloudfunctions.net/${FUNCTION_NAME}`;

console.log('=== Triggering Manual Story Generation ===');
console.log('URL:', url);
console.log('');

const data = JSON.stringify({
  data: {
    adminKey: ADMIN_KEY,
  }
});

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
  },
  timeout: 600000, // 10 minutes
};

console.log('Starting request... (this may take 3-5 minutes)');
console.log('');

const req = https.request(url, options, (res) => {
  let body = '';

  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      const result = JSON.parse(body);
      console.log('Response:', JSON.stringify(result, null, 2));

      if (result.result && result.result.storyId) {
        console.log('\n=== SUCCESS ===');
        console.log('Story ID:', result.result.storyId);
        console.log('Draft ID:', result.result.draftId);
        console.log('Images Generated:', result.result.imagesGenerated);
        console.log('Images Failed:', result.result.imagesFailed);
        console.log('\nRun this to verify:');
        console.log('  node scripts/check-story-images.js', result.result.storyId);
      } else if (result.error) {
        console.log('\n=== ERROR ===');
        console.log('Error:', result.error.message || result.error);
      }
    } catch (e) {
      console.log('Raw response:', body);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.on('timeout', () => {
  console.error('Request timed out');
  req.destroy();
});

req.write(data);
req.end();
