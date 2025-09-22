import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const reviewQueueLoadTime = new Rate('review_queue_load_time');
const sessionCreationTime = new Rate('session_creation_time');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 10 users
    { duration: '5m', target: 50 },   // Ramp up to 50 users
    { duration: '10m', target: 100 }, // Stay at 100 users
    { duration: '5m', target: 200 },  // Peak load - 200 users
    { duration: '10m', target: 200 }, // Stay at peak
    { duration: '5m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% of requests under 500ms
    errors: ['rate<0.1'],                            // Error rate under 10%
    review_queue_load_time: ['p(95)<300'],          // Queue loads under 300ms
    session_creation_time: ['p(95)<1000'],          // Sessions created under 1s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Helper function to get auth token
function getAuthToken() {
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: `testuser${__VU}@test.com`,
    password: 'TestPassword123!'
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  const token = loginRes.json('token');
  return token;
}

export function setup() {
  // Setup test data
  console.log('Setting up test data...');
  
  // Create test users
  for (let i = 1; i <= 200; i++) {
    http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
      email: `testuser${i}@test.com`,
      password: 'TestPassword123!',
      username: `testuser${i}`
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  return { setupComplete: true };
}

export default function (data) {
  // Get auth token for this VU (Virtual User)
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // Scenario 1: Load Review Queue
  const queueStart = Date.now();
  const queueRes = http.get(`${BASE_URL}/api/review/queue?limit=20`, { headers });
  reviewQueueLoadTime.add(Date.now() - queueStart < 300);
  
  check(queueRes, {
    'queue loaded successfully': (r) => r.status === 200,
    'queue has items': (r) => r.json('items') && r.json('items').length > 0,
  });
  
  errorRate.add(queueRes.status !== 200);
  sleep(1);

  // Scenario 2: Create Review Session
  const sessionStart = Date.now();
  const sessionRes = http.post(`${BASE_URL}/api/review/session/start`, 
    JSON.stringify({
      type: 'daily',
      itemIds: queueRes.json('items').slice(0, 10).map(item => item.id),
      settings: {
        shuffleOrder: true,
        allowRetry: true,
        showHints: true
      }
    }), 
    { headers }
  );
  sessionCreationTime.add(Date.now() - sessionStart < 1000);
  
  check(sessionRes, {
    'session created successfully': (r) => r.status === 200,
    'session has ID': (r) => r.json('sessionId') !== undefined,
  });
  
  if (sessionRes.status === 200) {
    const sessionId = sessionRes.json('sessionId');
    
    // Scenario 3: Submit Answers
    for (let i = 0; i < 5; i++) {
      const answerRes = http.post(
        `${BASE_URL}/api/review/session/${sessionId}/answer`,
        JSON.stringify({
          itemId: `item-${i}`,
          correct: Math.random() > 0.3, // 70% correct rate
          responseTime: Math.floor(Math.random() * 5000) + 1000,
          confidence: Math.floor(Math.random() * 5) + 1
        }),
        { headers }
      );
      
      check(answerRes, {
        'answer submitted': (r) => r.status === 200,
      });
      
      errorRate.add(answerRes.status !== 200);
      sleep(Math.random() * 2 + 1); // Random delay between answers
    }
    
    // Scenario 4: Complete Session
    const completeRes = http.post(
      `${BASE_URL}/api/review/session/${sessionId}/complete`,
      JSON.stringify({ feedback: 'Test session', rating: 5 }),
      { headers }
    );
    
    check(completeRes, {
      'session completed': (r) => r.status === 200,
      'summary received': (r) => r.json('summary') !== undefined,
    });
  }
  
  // Scenario 5: Pin/Unpin Content
  const pinRes = http.post(`${BASE_URL}/api/review/pin`, 
    JSON.stringify({
      contentType: 'kanji',
      contentId: `kanji-${Math.floor(Math.random() * 1000)}`,
      priority: 'normal'
    }),
    { headers }
  );
  
  check(pinRes, {
    'content pinned': (r) => r.status === 200,
  });
  
  errorRate.add(pinRes.status !== 200);
  
  // Scenario 6: Get Statistics
  const statsRes = http.get(`${BASE_URL}/api/review/stats?period=week`, { headers });
  
  check(statsRes, {
    'stats loaded': (r) => r.status === 200,
    'stats has overview': (r) => r.json('overview') !== undefined,
  });
  
  sleep(2);
}

export function teardown(data) {
  console.log('Cleaning up test data...');
  // Cleanup test users and data
}