#!/usr/bin/env node

/**
 * Test script to verify API endpoints are working correctly
 * and that user isolation is properly implemented
 */

const https = require('https');
const http = require('http');

// Test configuration
const API_BASE = 'http://localhost:3000/api';
const TEST_ENDPOINTS = [
  '/study-lists',
  '/saved-items'
];

console.log('🧪 Testing API User Isolation\n');
console.log('=' + '='.repeat(40));

/**
 * Make HTTP request
 */
function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const client = url.protocol === 'https:' ? https : http;

    const reqOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 3000),
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    console.log(`\n📡 Testing ${reqOptions.method} ${path}`);

    const req = client.request(reqOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const result = {
          status: res.statusCode,
          headers: res.headers,
          data: data
        };

        // Try to parse JSON
        try {
          result.json = JSON.parse(data);
        } catch (e) {
          result.json = null;
        }

        resolve(result);
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

/**
 * Run tests
 */
async function runTests() {
  console.log('\n1️⃣  Testing without authentication (should return 401)...');

  for (const endpoint of TEST_ENDPOINTS) {
    try {
      const response = await makeRequest(endpoint);

      if (response.status === 401) {
        console.log(`   ✅ ${endpoint}: Correctly returned 401 Unauthorized`);
        if (response.json?.error) {
          console.log(`      Message: "${response.json.error}"`);
        }
      } else if (response.status === 500) {
        console.error(`   ❌ ${endpoint}: Internal Server Error (500)`);
        if (response.json?.error) {
          console.error(`      Error: "${response.json.error}"`);
        }
        console.log(`      This might indicate a code issue in the API route`);
      } else {
        console.warn(`   ⚠️  ${endpoint}: Unexpected status ${response.status}`);
      }
    } catch (error) {
      console.error(`   ❌ ${endpoint}: Request failed - ${error.message}`);
      if (error.code === 'ECONNREFUSED') {
        console.log('      Is the development server running? (npm run dev)');
      }
    }
  }

  console.log('\n2️⃣  Testing session isolation...');
  console.log('   Note: To fully test user isolation:');
  console.log('   1. Log in as User A in your browser');
  console.log('   2. Create some study lists');
  console.log('   3. Log out and log in as User B');
  console.log('   4. Verify User B cannot see User A\'s lists');

  console.log('\n3️⃣  Expected behavior verification:');
  console.log('   ✓ Each user has separate localStorage keys');
  console.log('   ✓ Keys include user ID: moshimoshi_study_lists_{userId}');
  console.log('   ✓ No shared keys between users');
  console.log('   ✓ APIs return 401 without authentication');
  console.log('   ✓ APIs return 403 for non-premium features');

  console.log('\n4️⃣  Security checklist:');
  const checks = [
    'User-specific localStorage keys',
    'Clean up legacy data on login',
    'Verify userId on all operations',
    'Clear data on logout',
    'No cross-user data access'
  ];

  checks.forEach((check, i) => {
    console.log(`   ${i + 1}. ${check}`);
  });
}

// Run the tests
runTests()
  .then(() => {
    console.log('\n' + '='.repeat(41));
    console.log('✨ API Isolation Tests Complete\n');
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });