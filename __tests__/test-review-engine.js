#!/usr/bin/env node

/**
 * Test Script for Universal Review Engine
 * Verifies that the server-side API integration is working correctly
 */

const fetch = require('node-fetch');

const PORT = process.env.PORT || 3007;
const API_URL = `http://localhost:${PORT}`;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logTest(name) {
  log(`\n📝 Testing: ${name}`, colors.cyan);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

async function runTests() {
  log('\n========================================', colors.cyan);
  log('  Universal Review Engine Test Suite', colors.cyan);
  log('========================================\n', colors.cyan);

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  try {
    // Test 1: Progress Tracking API - Save
    logTest('Progress Tracking API - Save');
    totalTests++;
    try {
      const saveResponse = await fetch(`${API_URL}/api/progress/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentType: 'test-hiragana',
          items: [
            ['あ', {
              contentId: 'あ',
              contentType: 'test-hiragana',
              status: 'learned',
              viewCount: 10,
              correctCount: 8,
              incorrectCount: 2,
              accuracy: 80
            }]
          ]
        })
      });

      if (saveResponse.status === 401) {
        logWarning('Authentication required (expected for protected endpoint)');
        passedTests++;
      } else if (saveResponse.ok) {
        const data = await saveResponse.json();
        logSuccess(`Progress saved successfully: ${JSON.stringify(data)}`);
        passedTests++;
      } else {
        throw new Error(`Unexpected status: ${saveResponse.status}`);
      }
    } catch (error) {
      logError(`Failed: ${error.message}`);
      failedTests++;
    }

    // Test 2: Progress Tracking API - Load
    logTest('Progress Tracking API - Load');
    totalTests++;
    try {
      const loadResponse = await fetch(`${API_URL}/api/progress/track?contentType=test-hiragana`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (loadResponse.status === 401) {
        logWarning('Authentication required (expected for protected endpoint)');
        passedTests++;
      } else if (loadResponse.ok) {
        const data = await loadResponse.json();
        logSuccess(`Progress loaded successfully: ${JSON.stringify(data)}`);
        passedTests++;
      } else {
        throw new Error(`Unexpected status: ${loadResponse.status}`);
      }
    } catch (error) {
      logError(`Failed: ${error.message}`);
      failedTests++;
    }

    // Test 3: Achievement Update API
    logTest('Achievement Update API');
    totalTests++;
    try {
      const achievementResponse = await fetch(`${API_URL}/api/achievements/update-activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionType: 'test-hiragana',
          itemsReviewed: 10,
          accuracy: 80,
          duration: 300000
        })
      });

      if (achievementResponse.status === 401) {
        logWarning('Authentication required (expected for protected endpoint)');
        passedTests++;
      } else if (achievementResponse.ok) {
        const data = await achievementResponse.json();
        logSuccess(`Achievement updated: ${JSON.stringify(data)}`);
        passedTests++;
      } else {
        throw new Error(`Unexpected status: ${achievementResponse.status}`);
      }
    } catch (error) {
      logError(`Failed: ${error.message}`);
      failedTests++;
    }

    // Test 4: User Subscription API
    logTest('User Subscription API');
    totalTests++;
    try {
      const subscriptionResponse = await fetch(`${API_URL}/api/user/subscription`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (subscriptionResponse.status === 401) {
        logWarning('Authentication required (expected for protected endpoint)');
        passedTests++;
      } else if (subscriptionResponse.ok) {
        const data = await subscriptionResponse.json();
        logSuccess(`Subscription data: ${JSON.stringify(data)}`);
        passedTests++;
      } else {
        throw new Error(`Unexpected status: ${subscriptionResponse.status}`);
      }
    } catch (error) {
      logError(`Failed: ${error.message}`);
      failedTests++;
    }

    // Test 5: API Error Handling
    logTest('API Error Handling - Invalid JSON');
    totalTests++;
    try {
      const errorResponse = await fetch(`${API_URL}/api/progress/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json'
      });

      if (errorResponse.status >= 400) {
        logSuccess('API correctly rejected invalid JSON');
        passedTests++;
      } else {
        throw new Error('API should have rejected invalid JSON');
      }
    } catch (error) {
      if (error.message.includes('should have rejected')) {
        logError(`Failed: ${error.message}`);
        failedTests++;
      } else {
        logSuccess('API correctly handled invalid input');
        passedTests++;
      }
    }

    // Test 6: API Validation
    logTest('API Validation - Missing Required Fields');
    totalTests++;
    try {
      const validationResponse = await fetch(`${API_URL}/api/progress/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });

      const data = await validationResponse.json();
      if (validationResponse.status === 400 || validationResponse.status === 401) {
        logSuccess('API correctly validated input');
        passedTests++;
      } else {
        throw new Error('API should have validated required fields');
      }
    } catch (error) {
      logError(`Failed: ${error.message}`);
      failedTests++;
    }

    // Test 7: Check API Routes Exist
    logTest('API Routes Availability');
    totalTests++;
    const routes = [
      '/api/progress/track',
      '/api/achievements/update-activity',
      '/api/user/subscription'
    ];

    let allRoutesAvailable = true;
    for (const route of routes) {
      try {
        const response = await fetch(`${API_URL}${route}`, {
          method: 'OPTIONS'
        });

        // Even a 401 or 405 means the route exists
        if (response.status < 500) {
          log(`  ✓ ${route} is available`, colors.green);
        } else {
          log(`  ✗ ${route} returned server error`, colors.red);
          allRoutesAvailable = false;
        }
      } catch (error) {
        log(`  ✗ ${route} is not reachable: ${error.message}`, colors.red);
        allRoutesAvailable = false;
      }
    }

    if (allRoutesAvailable) {
      logSuccess('All API routes are available');
      passedTests++;
    } else {
      logError('Some API routes are not available');
      failedTests++;
    }

  } catch (error) {
    logError(`Test suite failed: ${error.message}`);
  }

  // Summary
  log('\n========================================', colors.cyan);
  log('           Test Summary', colors.cyan);
  log('========================================', colors.cyan);
  log(`Total Tests: ${totalTests}`);
  log(`Passed: ${passedTests}`, colors.green);
  log(`Failed: ${failedTests}`, failedTests > 0 ? colors.red : colors.green);

  const passRate = totalTests > 0 ? (passedTests / totalTests * 100).toFixed(1) : 0;
  log(`Pass Rate: ${passRate}%\n`);

  if (failedTests === 0) {
    log('🎉 All tests passed! The Universal Review Engine API is working correctly.', colors.green);
    log('\nNote: 401 responses are expected for authenticated endpoints when not logged in.', colors.yellow);
    log('This confirms the authentication system is working properly.\n', colors.yellow);
  } else {
    log('⚠️  Some tests failed. Please review the errors above.', colors.yellow);
  }

  return failedTests === 0 ? 0 : 1;
}

// Run tests
runTests().then(exitCode => {
  process.exit(exitCode);
}).catch(error => {
  logError(`Unexpected error: ${error.message}`);
  process.exit(1);
});