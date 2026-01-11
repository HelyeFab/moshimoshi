/**
 * Test Structured Outputs Migration via API
 * Tests the story generation with real OpenAI API calls
 */

const https = require('https');

const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.app';
const ADMIN_KEY = process.env.STORY_SCHEDULER_ADMIN_KEY || 'story-scheduler-2025';

console.log('🧪 Testing Structured Outputs Migration via API\n');
console.log(`API URL: ${API_URL}`);
console.log('Testing: Character Sheet Generation (Step 1)\n');

// Test payload for character sheet generation
const testPayload = {
  step: 'character_sheet',
  theme: 'A Day at the Beach',
  jlptLevel: 'N5',
  pageCount: 3,
  adminKey: ADMIN_KEY
};

const postData = JSON.stringify(testPayload);

const options = {
  hostname: new URL(API_URL).hostname,
  port: 443,
  path: '/api/admin/generate-story',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('Making API request...\n');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`Status Code: ${res.statusCode}\n`);

    try {
      const result = JSON.parse(data);

      if (res.statusCode === 200 && result.success) {
        console.log('✅ SUCCESS - Character sheet generated with structured outputs!\n');
        console.log('Character Sheet:');
        console.log(JSON.stringify(result.characterSheet, null, 2));
        console.log('\n📊 Validation:');
        console.log(`- Main Character: ${result.characterSheet?.mainCharacter?.name}`);
        console.log(`- Setting: ${result.characterSheet?.setting?.location}`);
        console.log(`- Visual Style: ${result.characterSheet?.visualStyle}`);
        console.log('\n✅ Structured outputs working correctly!');
        process.exit(0);
      } else {
        console.log('❌ FAILED - API returned error:\n');
        console.log(JSON.stringify(result, null, 2));
        process.exit(1);
      }
    } catch (error) {
      console.log('❌ FAILED - Invalid JSON response:\n');
      console.log(data.substring(0, 500));
      console.log('\nError:', error.message);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.log('❌ Request failed:',error.message);
  process.exit(1);
});

req.write(postData);
req.end();
