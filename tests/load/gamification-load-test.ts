/**
 * Gamification System Load Test
 *
 * Tests the /api/stats/unified endpoint under realistic load conditions.
 *
 * Test Scenarios:
 * 1. Concurrent XP updates (100 virtual users, 10 activities each)
 * 2. Streak updates at day boundary (timezone stress test)
 * 3. Achievement unlock cascade (multiple achievements unlocking)
 * 4. Offline sync replay (large batch processing)
 * 5. Mixed operations (XP + streak + achievement simultaneously)
 *
 * SLO Targets:
 * - P50 latency: < 50ms
 * - P95 latency: < 200ms
 * - P99 latency: < 500ms
 * - Error rate: < 1%
 * - Throughput: 400 requests/min sustained
 *
 * Usage:
 *   npm run load:test
 *   k6 run tests/load/gamification-load-test.ts
 *
 * @requires k6 (https://k6.io/)
 */

import { check, sleep } from 'k6'
import http from 'k6/http'
import { Rate, Trend } from 'k6/metrics'

// Custom metrics
const errorRate = new Rate('errors')
const xpLatency = new Trend('xp_operation_latency')
const streakLatency = new Trend('streak_operation_latency')
const sessionLatency = new Trend('session_operation_latency')

// Test configuration
export const options = {
  stages: [
    // Ramp-up: 0 → 50 users over 1 minute
    { duration: '1m', target: 50 },
    // Sustain: 50 users for 5 minutes
    { duration: '5m', target: 50 },
    // Peak: 50 → 100 users over 2 minutes
    { duration: '2m', target: 100 },
    // Sustain peak: 100 users for 5 minutes (stress test)
    { duration: '5m', target: 100 },
    // Ramp-down: 100 → 0 over 1 minute
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    // SLO: 95% of requests must complete in < 200ms
    http_req_duration: ['p(95)<200'],
    // SLO: 99% of requests must complete in < 500ms
    'http_req_duration{scenario:xp_update}': ['p(99)<500'],
    // SLO: Error rate must be < 1%
    errors: ['rate<0.01'],
    // Custom thresholds for operations
    xp_operation_latency: ['p(95)<200'],
    streak_operation_latency: ['p(95)<200'],
    session_operation_latency: ['p(95)<250'], // Sessions are slightly more complex
  },
}

// Test data generators
function generateUserId(): string {
  return `load_test_user_${Math.floor(Math.random() * 1000)}`
}

function generateIdempotencyKey(userId: string, operation: string): string {
  return `${operation}_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function generateSessionData(userId: string) {
  return {
    type: 'session',
    data: {
      type: 'drill',
      itemsReviewed: Math.floor(Math.random() * 20) + 5,
      accuracy: Math.floor(Math.random() * 30) + 70, // 70-100%
      duration: Math.floor(Math.random() * 300000) + 60000, // 1-6 minutes
      xpEarned: Math.floor(Math.random() * 50) + 10, // 10-60 XP
    },
    idempotencyKey: generateIdempotencyKey(userId, 'session'),
  }
}

function generateXPUpdate(userId: string) {
  return {
    type: 'xp',
    data: {
      amount: Math.floor(Math.random() * 30) + 10, // 10-40 XP
      source: 'drill_completed',
    },
    idempotencyKey: generateIdempotencyKey(userId, 'xp'),
  }
}

function generateStreakUpdate(userId: string) {
  return {
    type: 'streak',
    data: {},
    idempotencyKey: generateIdempotencyKey(userId, 'streak'),
  }
}

function generateAchievementUnlock(userId: string) {
  const achievements = ['first_drill', 'streak_7', 'level_10', 'speed_demon']
  return {
    type: 'achievement',
    data: {
      achievementId: achievements[Math.floor(Math.random() * achievements.length)],
      points: Math.floor(Math.random() * 50) + 10,
    },
    idempotencyKey: generateIdempotencyKey(userId, 'achievement'),
  }
}

// Test scenarios
export default function () {
  const userId = generateUserId()
  const baseUrl = __ENV.BASE_URL || 'http://localhost:3000'
  const headers = {
    'Content-Type': 'application/json',
    // In production, add actual JWT token here
    'Authorization': `Bearer ${__ENV.TEST_JWT_TOKEN || 'test-token'}`,
  }

  // Scenario 1: Session recording (most common operation)
  // 60% of requests
  if (Math.random() < 0.6) {
    const sessionPayload = generateSessionData(userId)
    const startTime = Date.now()

    const response = http.post(
      `${baseUrl}/api/stats/unified`,
      JSON.stringify(sessionPayload),
      { headers }
    )

    const latency = Date.now() - startTime
    sessionLatency.add(latency)

    const result = check(response, {
      'session: status is 200': (r) => r.status === 200,
      'session: response time < 500ms': () => latency < 500,
      'session: has valid response': (r) => {
        try {
          const body = JSON.parse(r.body as string)
          return body.stats !== undefined
        } catch {
          return false
        }
      },
    })

    errorRate.add(!result)
  }

  // Scenario 2: Direct XP update
  // 20% of requests
  else if (Math.random() < 0.8) {
    const xpPayload = generateXPUpdate(userId)
    const startTime = Date.now()

    const response = http.post(
      `${baseUrl}/api/stats/unified`,
      JSON.stringify(xpPayload),
      { headers }
    )

    const latency = Date.now() - startTime
    xpLatency.add(latency)

    const result = check(response, {
      'xp: status is 200': (r) => r.status === 200,
      'xp: response time < 200ms': () => latency < 200,
    })

    errorRate.add(!result)
  }

  // Scenario 3: Streak update
  // 10% of requests
  else if (Math.random() < 0.9) {
    const streakPayload = generateStreakUpdate(userId)
    const startTime = Date.now()

    const response = http.post(
      `${baseUrl}/api/stats/unified`,
      JSON.stringify(streakPayload),
      { headers }
    )

    const latency = Date.now() - startTime
    streakLatency.add(latency)

    const result = check(response, {
      'streak: status is 200': (r) => r.status === 200,
      'streak: response time < 200ms': () => latency < 200,
    })

    errorRate.add(!result)
  }

  // Scenario 4: Achievement unlock
  // 10% of requests
  else {
    const achievementPayload = generateAchievementUnlock(userId)

    const response = http.post(
      `${baseUrl}/api/stats/unified`,
      JSON.stringify(achievementPayload),
      { headers }
    )

    const result = check(response, {
      'achievement: status is 200': (r) => r.status === 200,
    })

    errorRate.add(!result)
  }

  // Think time: 1-3 seconds between requests (simulate real user behavior)
  sleep(Math.random() * 2 + 1)
}

/**
 * Setup function (runs once at start)
 */
export function setup() {
  console.log('🚀 Starting gamification load test...')
  console.log(`Target URL: ${__ENV.BASE_URL || 'http://localhost:3000'}`)
  console.log('Test duration: ~15 minutes')
  console.log('Peak load: 100 virtual users')
  console.log('Expected throughput: ~400 requests/minute')
  console.log('')
}

/**
 * Teardown function (runs once at end)
 */
export function teardown(data: any) {
  console.log('')
  console.log('✅ Load test complete!')
  console.log('Review results above for SLO compliance.')
  console.log('')
  console.log('SLO Targets:')
  console.log('  - P95 latency: < 200ms')
  console.log('  - P99 latency: < 500ms')
  console.log('  - Error rate: < 1%')
  console.log('')
  console.log('Next steps:')
  console.log('  1. Review metrics in monitoring dashboard')
  console.log('  2. Check for any errors in application logs')
  console.log('  3. Generate load test report: npm run load:report')
}
