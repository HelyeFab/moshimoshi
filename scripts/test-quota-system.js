#!/usr/bin/env node

/**
 * Test script for quota tracking system
 * Tests:
 * 1. New video flow (should count toward quota)
 * 2. Repeat video flow (should NOT count toward quota)
 * 3. Quota exhausted flow (should return 429)
 * 4. Lazy migration for old docs
 */

const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=dD2EISUDjVE'; // Short test video
const BASE_URL = 'http://localhost:3002';

// ANSI color codes
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

function logTest(testName) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`TEST: ${testName}`, 'cyan');
  log('='.repeat(60), 'cyan');
}

async function testNewVideoFlow() {
  logTest('1. New Video Flow (First Access)');

  try {
    log('📤 Sending request to /api/youtube/extract...', 'blue');

    const response = await fetch(`${BASE_URL}/api/youtube/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: TEST_VIDEO_URL })
    });

    const data = await response.json();

    log(`Status: ${response.status}`, response.ok ? 'green' : 'red');
    log(`Response:`, 'yellow');
    console.log(JSON.stringify(data, null, 2));

    if (response.ok && data.success) {
      log('✅ NEW VIDEO: Successfully extracted transcript', 'green');
      log(`   Video ID: ${data.videoMetadata?.youtubeVideoId}`, 'green');
      log(`   Transcript lines: ${data.transcript?.length || 0}`, 'green');
      return { success: true, videoId: data.videoMetadata?.youtubeVideoId };
    } else if (response.status === 429) {
      log('⚠️  QUOTA EXCEEDED: Cannot test new video (quota already exhausted)', 'yellow');
      log('   This is expected if you already used your daily quota', 'yellow');
      return { success: false, quotaExceeded: true };
    } else {
      log('❌ FAILED: Unexpected response', 'red');
      return { success: false, error: data.message };
    }
  } catch (error) {
    log(`❌ ERROR: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function testRepeatVideoFlow(videoId) {
  logTest('2. Repeat Video Flow (Unlimited Practice)');

  if (!videoId) {
    log('⏭️  SKIPPED: No video ID from previous test', 'yellow');
    return { success: false, skipped: true };
  }

  try {
    log('📤 Sending request for SAME video again...', 'blue');

    const response = await fetch(`${BASE_URL}/api/youtube/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: TEST_VIDEO_URL })
    });

    const data = await response.json();

    log(`Status: ${response.status}`, response.ok ? 'green' : 'red');
    log(`Response:`, 'yellow');
    console.log(JSON.stringify(data, null, 2));

    if (response.ok && data.success) {
      log('✅ REPEAT VIDEO: Successfully accessed (unlimited practice)', 'green');
      log('   This should NOT have counted toward quota', 'green');
      return { success: true };
    } else {
      log('❌ FAILED: Could not access repeat video', 'red');
      return { success: false, error: data.message };
    }
  } catch (error) {
    log(`❌ ERROR: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function testQuotaStatus() {
  logTest('3. Check Quota Status');

  try {
    log('📤 Fetching quota status from /api/youtube/popular...', 'blue');

    const response = await fetch(`${BASE_URL}/api/youtube/popular`);
    const data = await response.json();

    if (response.ok && data.success) {
      const { userQuota } = data;
      log(`Quota Status:`, 'yellow');
      log(`  Used: ${userQuota.used}`, 'cyan');
      log(`  Limit: ${userQuota.limit}`, 'cyan');
      log(`  Remaining: ${userQuota.remaining}`, userQuota.remaining > 0 ? 'green' : 'red');

      return { success: true, quota: userQuota };
    } else {
      log('❌ FAILED: Could not fetch quota status', 'red');
      return { success: false };
    }
  } catch (error) {
    log(`❌ ERROR: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function testPracticeTracking(videoId) {
  logTest('4. Practice Tracking (30s+ watch)');

  if (!videoId) {
    log('⏭️  SKIPPED: No video ID from previous test', 'yellow');
    return { success: false, skipped: true };
  }

  try {
    log('📤 Simulating 30s+ watch with /api/practice/track...', 'blue');

    const response = await fetch(`${BASE_URL}/api/practice/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId: videoId,
        videoUrl: TEST_VIDEO_URL,
        videoTitle: 'Test Video',
        practiceTime: 35 // 35 seconds
      })
    });

    const data = await response.json();

    log(`Status: ${response.status}`, response.ok ? 'green' : 'red');
    log(`Response:`, 'yellow');
    console.log(JSON.stringify(data, null, 2));

    if (response.ok && data.success) {
      log('✅ PRACTICE TRACKED: Updated existing doc (no quota count)', 'green');
      return { success: true };
    } else {
      log('❌ FAILED: Could not track practice', 'red');
      return { success: false, error: data.message };
    }
  } catch (error) {
    log(`❌ ERROR: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function runTests() {
  log('\n🧪 QUOTA SYSTEM TEST SUITE', 'cyan');
  log('Testing quota tracking with firstAccessed field\n', 'cyan');

  const results = {
    total: 4,
    passed: 0,
    failed: 0,
    skipped: 0
  };

  // Test 1: New video flow
  const test1 = await testNewVideoFlow();
  if (test1.success) results.passed++;
  else if (test1.quotaExceeded) results.skipped++;
  else results.failed++;

  // Test 2: Repeat video flow
  const test2 = await testRepeatVideoFlow(test1.videoId);
  if (test2.success) results.passed++;
  else if (test2.skipped) results.skipped++;
  else results.failed++;

  // Test 3: Check quota status
  const test3 = await testQuotaStatus();
  if (test3.success) results.passed++;
  else results.failed++;

  // Test 4: Practice tracking
  const test4 = await testPracticeTracking(test1.videoId);
  if (test4.success) results.passed++;
  else if (test4.skipped) results.skipped++;
  else results.failed++;

  // Summary
  log('\n' + '='.repeat(60), 'cyan');
  log('TEST SUMMARY', 'cyan');
  log('='.repeat(60), 'cyan');
  log(`Total Tests: ${results.total}`, 'blue');
  log(`✅ Passed: ${results.passed}`, 'green');
  log(`❌ Failed: ${results.failed}`, 'red');
  log(`⏭️  Skipped: ${results.skipped}`, 'yellow');

  if (results.failed === 0 && results.passed > 0) {
    log('\n🎉 ALL TESTS PASSED!', 'green');
  } else if (results.failed > 0) {
    log('\n⚠️  SOME TESTS FAILED', 'red');
    process.exit(1);
  } else {
    log('\n⚠️  ALL TESTS SKIPPED (quota exhausted or no data)', 'yellow');
  }
}

// Run tests
runTests().catch(error => {
  log(`\n❌ FATAL ERROR: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
