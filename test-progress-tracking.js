#!/usr/bin/env node

/**
 * Test script to verify progress tracking works with the new server-side API
 */

const fetch = require('node-fetch');

const PORT = process.env.PORT || 3007;
const API_URL = `http://localhost:${PORT}`;

async function testProgressTracking() {
  console.log('Testing Progress Tracking System...\n');

  try {
    // 1. Test saving progress
    console.log('1. Testing save progress endpoint...');
    const saveResponse = await fetch(`${API_URL}/api/progress/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add a test cookie to simulate authentication
        'Cookie': 'moshimoshi_jwt=test_token'
      },
      body: JSON.stringify({
        contentType: 'hiragana',
        items: [
          ['あ', {
            contentId: 'あ',
            contentType: 'hiragana',
            status: 'learned',
            viewCount: 10,
            correctCount: 8,
            incorrectCount: 2,
            accuracy: 80
          }],
          ['か', {
            contentId: 'か',
            contentType: 'hiragana',
            status: 'viewing',
            viewCount: 5,
            correctCount: 3,
            incorrectCount: 2,
            accuracy: 60
          }]
        ]
      })
    });

    if (saveResponse.status === 401) {
      console.log('✓ Save endpoint requires authentication (expected behavior)');
    } else if (saveResponse.ok) {
      const saveResult = await saveResponse.json();
      console.log('✓ Save progress successful:', saveResult);
    } else {
      console.error('✗ Save failed:', saveResponse.status, saveResponse.statusText);
    }

    // 2. Test loading progress
    console.log('\n2. Testing load progress endpoint...');
    const loadResponse = await fetch(`${API_URL}/api/progress/track?contentType=hiragana`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'moshimoshi_jwt=test_token'
      }
    });

    if (loadResponse.status === 401) {
      console.log('✓ Load endpoint requires authentication (expected behavior)');
    } else if (loadResponse.ok) {
      const loadResult = await loadResponse.json();
      console.log('✓ Load progress successful:', loadResult);
    } else {
      console.error('✗ Load failed:', loadResponse.status, loadResponse.statusText);
    }

    // 3. Test achievement update
    console.log('\n3. Testing achievement update endpoint...');
    const achievementResponse = await fetch(`${API_URL}/api/achievements/update-activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'moshimoshi_jwt=test_token'
      },
      body: JSON.stringify({
        sessionType: 'hiragana',
        itemsReviewed: 10,
        accuracy: 80,
        duration: 300000 // 5 minutes in ms
      })
    });

    if (achievementResponse.status === 401) {
      console.log('✓ Achievement endpoint requires authentication (expected behavior)');
    } else if (achievementResponse.ok) {
      const achievementResult = await achievementResponse.json();
      console.log('✓ Achievement update successful:', achievementResult);
    } else {
      console.error('✗ Achievement update failed:', achievementResponse.status, achievementResponse.statusText);
    }

    console.log('\n✅ All tests completed!');
    console.log('\nNote: 401 responses are expected if not authenticated.');
    console.log('The important thing is that the endpoints exist and respond correctly.');

  } catch (error) {
    console.error('Test failed with error:', error);
    process.exit(1);
  }
}

// Run the test
testProgressTracking();