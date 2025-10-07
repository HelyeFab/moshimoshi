#!/usr/bin/env node

/**
 * Test script for quota tracking with authentication
 * Run this after signing in to test authenticated user flows
 */

// Video with Japanese captions - Comprehensible Japanese
const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=uk7gKixqVNU';
const BASE_URL = 'http://localhost:3002';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkQuotaBeforeTest() {
  log('\n📊 Checking Current Quota Status...', 'blue');

  const response = await fetch(`${BASE_URL}/api/youtube/popular`);
  const data = await response.json();

  if (data.success && data.userQuota) {
    const { used, limit, remaining } = data.userQuota;
    log(`Current Quota: ${used}/${limit} (${remaining} remaining)`, remaining > 0 ? 'green' : 'red');

    if (remaining === 0) {
      log('\n⚠️  WARNING: Quota exhausted. Cannot test new video flow.', 'yellow');
      log('   Expected: This will test the 429 quota exceeded response', 'yellow');
    }

    return { used, limit, remaining };
  }

  return { used: 0, limit: 0, remaining: 0 };
}

async function testNewVideoExtraction() {
  log('\n🧪 TEST 1: New Video Extraction', 'cyan');
  log('Expected: Creates userPracticeHistory, counts toward quota', 'blue');

  const response = await fetch(`${BASE_URL}/api/youtube/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: TEST_VIDEO_URL })
  });

  const data = await response.json();

  log(`Status: ${response.status}`, 'yellow');

  if (response.status === 429) {
    log('✅ QUOTA EXCEEDED (Expected if quota full)', 'green');
    log(`   Message: ${data.message}`, 'cyan');
    log(`   Quota Info: ${JSON.stringify(data.quotaInfo)}`, 'cyan');
    return { quotaExceeded: true, videoId: null };
  } else if (response.ok && data.success) {
    log('✅ SUCCESS: Transcript extracted', 'green');
    log(`   Video ID: ${data.videoMetadata?.youtubeVideoId}`, 'cyan');
    log(`   Lines: ${data.transcript?.length}`, 'cyan');
    return { success: true, videoId: data.videoMetadata?.youtubeVideoId };
  } else {
    log('❌ FAILED', 'red');
    log(`   Error: ${data.message || data.error}`, 'red');
    return { failed: true, videoId: null };
  }
}

async function testRepeatVideoExtraction() {
  log('\n🧪 TEST 2: Repeat Video Extraction', 'cyan');
  log('Expected: Succeeds without counting toward quota', 'blue');

  const response = await fetch(`${BASE_URL}/api/youtube/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: TEST_VIDEO_URL })
  });

  const data = await response.json();

  log(`Status: ${response.status}`, 'yellow');

  if (response.ok && data.success) {
    log('✅ SUCCESS: Repeat video accessed (unlimited practice)', 'green');
    log('   This should NOT have counted toward quota', 'cyan');
    return { success: true };
  } else {
    log('❌ FAILED', 'red');
    log(`   Error: ${data.message || data.error}`, 'red');
    return { failed: true };
  }
}

async function checkQuotaAfterTest() {
  log('\n📊 Checking Quota After Tests...', 'blue');

  const response = await fetch(`${BASE_URL}/api/youtube/popular`);
  const data = await response.json();

  if (data.success && data.userQuota) {
    const { used, limit, remaining } = data.userQuota;
    log(`Current Quota: ${used}/${limit} (${remaining} remaining)`, 'yellow');
    return { used, limit, remaining };
  }

  return { used: 0, limit: 0, remaining: 0 };
}

async function main() {
  log('\n🔬 QUOTA SYSTEM INTEGRATION TEST', 'cyan');
  log('=' .repeat(60), 'cyan');
  log('\nℹ️  This test requires authentication', 'yellow');
  log('   Make sure you are signed in before running this test\n', 'yellow');

  try {
    // Check initial quota
    const quotaBefore = await checkQuotaBeforeTest();

    // Test 1: New video (or quota exceeded)
    const test1 = await testNewVideoExtraction();

    // Test 2: Repeat video (only if test 1 succeeded)
    if (test1.success && !test1.quotaExceeded) {
      await testRepeatVideoExtraction();
    }

    // Check final quota
    const quotaAfter = await checkQuotaAfterTest();

    // Summary
    log('\n' + '='.repeat(60), 'cyan');
    log('📈 QUOTA COMPARISON', 'cyan');
    log('='.repeat(60), 'cyan');
    log(`Before: ${quotaBefore.used}/${quotaBefore.limit}`, 'blue');
    log(`After:  ${quotaAfter.used}/${quotaAfter.limit}`, 'blue');

    if (test1.success && !test1.quotaExceeded) {
      const quotaIncreased = quotaAfter.used > quotaBefore.used;
      log(`\nQuota increased on first access: ${quotaIncreased ? '✅ YES' : '❌ NO'}`, quotaIncreased ? 'green' : 'red');
    }

    log('\n✅ TESTS COMPLETED', 'green');
    log('\nℹ️  To fully test quota exhaustion:', 'yellow');
    log('   1. Paste videos until quota is exhausted', 'yellow');
    log('   2. Try pasting another video', 'yellow');
    log('   3. Verify you get 429 error with quota info', 'yellow');

  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

main();
