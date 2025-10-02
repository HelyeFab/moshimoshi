/**
 * Gamification System Load Test - k6
 *
 * Tests /api/stats/unified under peak + 2x burst load conditions
 *
 * SLO Targets:
 * - P50 latency: < 50ms
 * - P95 latency: < 200ms
 * - P99 latency: < 500ms
 * - Error rate: < 1%
 * - Peak: 200 req/min sustained
 * - Burst: 400 req/min for 5 minutes
 *
 * Usage:
 *   k6 run tests/load/gamification-load-test.js
 *   k6 run --out json=results.json tests/load/gamification-load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const xpLatency = new Trend('xp_operation_duration');
const streakLatency = new Trend('streak_operation_duration');
const sessionLatency = new Trend('session_operation_duration');
const achievementLatency = new Trend('achievement_operation_duration');

// Counters for operation types
const xpOps = new Counter('xp_operations');
const streakOps = new Counter('streak_operations');
const sessionOps = new Counter('session_operations');
const achievementOps = new Counter('achievement_operations');

// Test configuration
export const options = {
  stages: [
    // Baseline: Warm up to 50 req/min (16 VUs) for 2 min
    { duration: '2m', target: 16 },

    // Peak: Sustain 200 req/min (67 VUs) for 10 min
    { duration: '10m', target: 67 },

    // Burst: Spike to 400 req/min (134 VUs) for 5 min
    { duration: '5m', target: 134 },

    // Cool down: Back to baseline for 2 min
    { duration: '2m', target: 16 },

    // Ramp down
    { duration: '1m', target: 0 },
  ],

  thresholds: {
    // SLO: P95 latency must be < 200ms
    'http_req_duration': ['p(95)<200', 'p(99)<500'],

    // SLO: Error rate must be < 1%
    'errors': ['rate<0.01'],

    // Operation-specific thresholds
    'xp_operation_duration': ['p(95)<200'],
    'streak_operation_duration': ['p(95)<200'],
    'session_operation_duration': ['p(95)<250'], // Sessions slightly more complex
    'achievement_operation_duration': ['p(95)<200'],

    // Throughput checks
    'http_reqs': ['rate>3.33'], // 200+ req/min = 3.33+ req/sec
  },
};

// Test data generators
function generateUserId() {
  return `loadtest_user_${__VU}_${Math.floor(Math.random() * 100)}`;
}

function generateIdempotencyKey(userId, operation) {
  return `${operation}_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getSessionPayload(userId) {
  return {
    type: 'session',
    data: {
      type: 'drill',
      itemsReviewed: Math.floor(Math.random() * 20) + 5,
      accuracy: Math.floor(Math.random() * 30) + 70,
      duration: Math.floor(Math.random() * 300000) + 60000,
      xpEarned: Math.floor(Math.random() * 50) + 10,
    },
    idempotencyKey: generateIdempotencyKey(userId, 'session'),
  };
}

function getXPPayload(userId) {
  return {
    type: 'xp',
    data: {
      amount: Math.floor(Math.random() * 30) + 10,
      source: 'drill_completed',
    },
    idempotencyKey: generateIdempotencyKey(userId, 'xp'),
  };
}

function getStreakPayload(userId) {
  return {
    type: 'streak',
    data: {},
    idempotencyKey: generateIdempotencyKey(userId, 'streak'),
  };
}

function getAchievementPayload(userId) {
  const achievements = ['first_drill', 'streak_7', 'level_10', 'speed_demon'];
  return {
    type: 'achievement',
    data: {
      achievementId: achievements[Math.floor(Math.random() * achievements.length)],
      points: Math.floor(Math.random() * 50) + 10,
    },
    idempotencyKey: generateIdempotencyKey(userId, 'achievement'),
  };
}

export default function() {
  const userId = generateUserId();
  const baseUrl = __ENV.BASE_URL || 'http://localhost:3000';

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${__ENV.TEST_JWT_TOKEN || 'test-token'}`,
    },
  };

  // Realistic distribution of operations
  const rand = Math.random();
  let payload, operationType, latencyMetric;

  if (rand < 0.6) {
    // 60%: Session recording (most common)
    payload = getSessionPayload(userId);
    operationType = 'session';
    latencyMetric = sessionLatency;
    sessionOps.add(1);
  } else if (rand < 0.8) {
    // 20%: Direct XP update
    payload = getXPPayload(userId);
    operationType = 'xp';
    latencyMetric = xpLatency;
    xpOps.add(1);
  } else if (rand < 0.9) {
    // 10%: Streak update
    payload = getStreakPayload(userId);
    operationType = 'streak';
    latencyMetric = streakLatency;
    streakOps.add(1);
  } else {
    // 10%: Achievement unlock
    payload = getAchievementPayload(userId);
    operationType = 'achievement';
    latencyMetric = achievementLatency;
    achievementOps.add(1);
  }

  // Execute request with timing
  const startTime = Date.now();
  const response = http.post(
    `${baseUrl}/api/stats/unified`,
    JSON.stringify(payload),
    params
  );
  const duration = Date.now() - startTime;

  // Record custom latency
  latencyMetric.add(duration);

  // Validate response
  const result = check(response, {
    [`${operationType}: status is 200`]: (r) => r.status === 200,
    [`${operationType}: has valid JSON`]: (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.stats !== undefined || body.success !== undefined;
      } catch {
        return false;
      }
    },
    [`${operationType}: response < 500ms`]: () => duration < 500,
  });

  errorRate.add(!result);

  // Think time: 1-3 seconds between requests (simulate real users)
  sleep(Math.random() * 2 + 1);
}

export function setup() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 Gamification Load Test - Starting');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Target URL: ${__ENV.BASE_URL || 'http://localhost:3000'}`);
  console.log('Test Duration: ~22 minutes');
  console.log('');
  console.log('Load Profile:');
  console.log('  - Baseline: 50 req/min for 2 min (warmup)');
  console.log('  - Peak: 200 req/min for 10 min (sustained)');
  console.log('  - Burst: 400 req/min for 5 min (stress)');
  console.log('  - Cooldown: 2 min');
  console.log('');
  console.log('Operation Mix:');
  console.log('  - 60% Session recordings');
  console.log('  - 20% XP updates');
  console.log('  - 10% Streak updates');
  console.log('  - 10% Achievement unlocks');
  console.log('');
  console.log('SLO Targets:');
  console.log('  - P50 latency: < 50ms');
  console.log('  - P95 latency: < 200ms');
  console.log('  - P99 latency: < 500ms');
  console.log('  - Error rate: < 1%');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
}

export function teardown(data) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ Load Test Complete');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('Next Steps:');
  console.log('  1. Review metrics above for SLO compliance');
  console.log('  2. Check application logs for errors');
  console.log('  3. Review monitoring dashboards');
  console.log('  4. Generate detailed report: npm run load:report');
  console.log('');
  console.log('SLO Status:');
  console.log('  Check if http_req_duration p(95) < 200ms');
  console.log('  Check if errors rate < 1%');
  console.log('═══════════════════════════════════════════════════════════');
}
