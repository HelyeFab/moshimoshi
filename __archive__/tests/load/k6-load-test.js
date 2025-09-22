/**
 * K6 Load Test Script
 * Week 2 - Day 5: Performance Validation
 * Target: 1000 concurrent users
 * 
 * Install k6: https://k6.io/docs/getting-started/installation/
 * Run: k6 run tests/load/k6-load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');
const queueGenerationTime = new Trend('queue_generation_time');
const sessionCreationTime = new Trend('session_creation_time');
const syncSuccessRate = new Rate('sync_success');

// Test configuration
export const options = {
  stages: [
    // Ramp up
    { duration: '2m', target: 100 },   // Warm up to 100 users
    { duration: '3m', target: 500 },   // Ramp to 500 users
    { duration: '5m', target: 1000 },  // Ramp to 1000 users
    { duration: '10m', target: 1000 }, // Stay at 1000 users
    { duration: '3m', target: 500 },   // Ramp down to 500
    { duration: '2m', target: 0 },     // Ramp down to 0
  ],
  
  thresholds: {
    // Performance requirements from budget
    http_req_duration: ['p(95)<100'], // 95% of requests under 100ms
    errors: ['rate<0.001'],            // Error rate under 0.1%
    api_latency: ['p(95)<100'],        // API latency under 100ms
    queue_generation_time: ['p(95)<50'], // Queue generation under 50ms
    session_creation_time: ['p(95)<200'], // Session creation under 200ms
    sync_success: ['rate>0.999'],      // Sync success rate over 99.9%
  },
  
  // Extended options
  ext: {
    loadimpact: {
      projectID: 'moshimoshi-performance',
      name: 'Week 2 - 1000 User Load Test',
    },
  },
};

// Test data
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TEST_USERS = generateTestUsers(100);

// Generate test users
function generateTestUsers(count) {
  const users = [];
  for (let i = 0; i < count; i++) {
    users.push({
      email: `loadtest${i}@example.com`,
      password: 'TestPassword123!',
      token: null,
    });
  }
  return users;
}

// Helper to get random user
function getRandomUser() {
  return TEST_USERS[Math.floor(Math.random() * TEST_USERS.length)];
}

// Setup function (runs once)
export function setup() {
  console.log('Setting up load test...');
  
  // Warm up the cache
  http.get(`${BASE_URL}/api/health`);
  
  return { startTime: Date.now() };
}

// Main test scenario
export default function () {
  const user = getRandomUser();
  
  // Scenario distribution (based on real usage patterns)
  const scenario = Math.random();
  
  if (scenario < 0.3) {
    // 30% - Browse content
    browseContentScenario();
  } else if (scenario < 0.7) {
    // 40% - Review session
    reviewSessionScenario(user);
  } else if (scenario < 0.9) {
    // 20% - Sync data
    syncDataScenario(user);
  } else {
    // 10% - Admin operations
    adminScenario();
  }
  
  sleep(Math.random() * 3 + 1); // Random think time 1-4 seconds
}

// Scenario: Browse content
function browseContentScenario() {
  const endpoints = [
    '/api/lessons',
    '/api/lessons/hiragana',
    '/api/lessons/katakana',
    '/api/user/progress',
    '/api/user/stats',
  ];
  
  endpoints.forEach(endpoint => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    
    const duration = Date.now() - start;
    apiLatency.add(duration);
    
    const success = check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 100ms': (r) => r.timings.duration < 100,
    });
    
    errorRate.add(!success);
  });
}

// Scenario: Review session
function reviewSessionScenario(user) {
  // 1. Generate queue
  let start = Date.now();
  const queueRes = http.get(`${BASE_URL}/api/review/queue`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${user.token || 'mock-token'}`,
    },
  });
  
  queueGenerationTime.add(Date.now() - start);
  
  check(queueRes, {
    'queue generated': (r) => r.status === 200,
    'queue generation < 50ms': (r) => r.timings.duration < 50,
  });
  
  // 2. Start session
  start = Date.now();
  const sessionRes = http.post(
    `${BASE_URL}/api/review/session/start`,
    JSON.stringify({
      queueId: 'test-queue-' + Date.now(),
      mode: 'recognition',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token || 'mock-token'}`,
      },
    }
  );
  
  sessionCreationTime.add(Date.now() - start);
  
  const sessionSuccess = check(sessionRes, {
    'session created': (r) => r.status === 200 || r.status === 201,
    'session creation < 200ms': (r) => r.timings.duration < 200,
  });
  
  if (sessionSuccess && sessionRes.json('data')) {
    const sessionId = sessionRes.json('data.sessionId');
    
    // 3. Submit reviews
    for (let i = 0; i < 10; i++) {
      const reviewRes = http.post(
        `${BASE_URL}/api/review/submit`,
        JSON.stringify({
          sessionId: sessionId,
          itemId: `item-${i}`,
          response: Math.random() > 0.3 ? 'correct' : 'incorrect',
          responseTime: Math.floor(Math.random() * 5000) + 1000,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.token || 'mock-token'}`,
          },
        }
      );
      
      check(reviewRes, {
        'review submitted': (r) => r.status === 200,
        'review response < 100ms': (r) => r.timings.duration < 100,
      });
      
      sleep(0.5); // Simulate thinking time
    }
    
    // 4. Complete session
    http.post(
      `${BASE_URL}/api/review/session/complete`,
      JSON.stringify({ sessionId: sessionId }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token || 'mock-token'}`,
        },
      }
    );
  }
}

// Scenario: Sync data (offline sync)
function syncDataScenario(user) {
  const syncData = {
    items: Array.from({ length: 20 }, (_, i) => ({
      id: `sync-item-${Date.now()}-${i}`,
      type: 'review',
      data: {
        itemId: `item-${i}`,
        response: 'correct',
        timestamp: Date.now(),
      },
    })),
    clientId: `client-${__VU}`, // Virtual user ID
    lastSyncAt: Date.now() - 3600000, // 1 hour ago
  };
  
  const res = http.post(
    `${BASE_URL}/api/sync`,
    JSON.stringify(syncData),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token || 'mock-token'}`,
      },
      timeout: '10s',
    }
  );
  
  const success = check(res, {
    'sync successful': (r) => r.status === 200,
    'sync response < 500ms': (r) => r.timings.duration < 500,
  });
  
  syncSuccessRate.add(success);
}

// Scenario: Admin operations
function adminScenario() {
  const adminEndpoints = [
    '/api/admin/stats',
    '/api/admin/users',
    '/api/admin/content',
  ];
  
  adminEndpoints.forEach(endpoint => {
    const res = http.get(`${BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer admin-token',
      },
    });
    
    check(res, {
      'admin endpoint accessible': (r) => r.status === 200 || r.status === 403,
      'admin response < 500ms': (r) => r.timings.duration < 500,
    });
  });
}

// Teardown function (runs once)
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Load test completed in ${duration} seconds`);
}