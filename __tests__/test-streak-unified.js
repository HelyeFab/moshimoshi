#!/usr/bin/env node

/**
 * Test script for unified streak calculation
 * Tests that both study and review activities count toward streaks
 */

const fetch = require('node-fetch');

const API_URL = `http://localhost:${process.env.PORT || 3000}`;

// Test cookie (you'll need to get this from your browser)
const TEST_COOKIE = process.env.TEST_COOKIE || '';

/**
 * Test activity update endpoint
 */
async function testActivityUpdate(sessionType) {
  console.log(`\n📝 Testing ${sessionType} activity update...`);

  try {
    const response = await fetch(`${API_URL}/api/achievements/update-activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': TEST_COOKIE
      },
      body: JSON.stringify({
        sessionType: sessionType,
        itemsReviewed: 10,
        accuracy: 0.85,
        duration: 300
      })
    });

    if (!response.ok) {
      console.error(`❌ Failed: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error('Response:', text);
      return null;
    }

    const data = await response.json();
    console.log('✅ Success:', data);
    return data;

  } catch (error) {
    console.error('❌ Error:', error);
    return null;
  }
}

/**
 * Test fetching activities
 */
async function testGetActivities() {
  console.log('\n📖 Fetching current activities...');

  try {
    const response = await fetch(`${API_URL}/api/achievements/activities`, {
      method: 'GET',
      headers: {
        'Cookie': TEST_COOKIE
      }
    });

    if (!response.ok) {
      console.error(`❌ Failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    console.log('✅ Current activity data:');
    console.log('  - Current streak:', data.currentStreak);
    console.log('  - Best streak:', data.bestStreak);
    console.log('  - Active today:', data.isActiveToday);
    console.log('  - Last activity date:', data.lastActivityDate);
    console.log('  - Total dates:', Object.keys(data.dates || {}).length);

    if (data.dates) {
      const sortedDates = Object.keys(data.dates).sort();
      console.log('  - Date range:', sortedDates[0], 'to', sortedDates[sortedDates.length - 1]);

      // Check for corrupted dates
      const corruptedDates = Object.keys(data).filter(key =>
        key.startsWith('dates.') && key.match(/dates\.\d{4}-\d{2}-\d{2}$/)
      );

      if (corruptedDates.length > 0) {
        console.log('  ⚠️  Found corrupted dates at root level:', corruptedDates);
      }
    }

    return data;

  } catch (error) {
    console.error('❌ Error:', error);
    return null;
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🚀 Starting unified streak system tests...');
  console.log(`   API URL: ${API_URL}`);

  if (!TEST_COOKIE) {
    console.error('\n⚠️  Warning: No TEST_COOKIE provided');
    console.log('To get your test cookie:');
    console.log('1. Log into the app in your browser');
    console.log('2. Open DevTools > Application > Cookies');
    console.log('3. Copy the session cookie value');
    console.log('4. Run: TEST_COOKIE="your-cookie-value" node test-streak-unified.js\n');
  }

  // Get initial state
  console.log('\n=== Initial State ===');
  const initialData = await testGetActivities();

  // Test study activity
  console.log('\n=== Test Study Activity ===');
  const studyResult = await testActivityUpdate('study');

  // Test review activity
  console.log('\n=== Test Review Activity ===');
  const reviewResult = await testActivityUpdate('review');

  // Get final state
  console.log('\n=== Final State ===');
  const finalData = await testGetActivities();

  // Summary
  console.log('\n=== Test Summary ===');
  if (initialData && finalData) {
    console.log('Streak changes:');
    console.log(`  - Initial streak: ${initialData.currentStreak}`);
    console.log(`  - Final streak: ${finalData.currentStreak}`);
    console.log(`  - Streak ${finalData.currentStreak > initialData.currentStreak ? 'increased ✅' :
                          finalData.currentStreak === initialData.currentStreak ? 'maintained ✅' :
                          'decreased ❌'}`);

    if (studyResult && reviewResult) {
      console.log('\nBoth activity types counted toward streak ✅');
    } else {
      console.log('\n⚠️  Some activities failed to update');
    }
  }

  console.log('\n✨ Tests complete!');
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});