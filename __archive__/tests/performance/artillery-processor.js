// Artillery processor for custom logic
module.exports = {
  beforeRequest: beforeRequest,
  afterResponse: afterResponse,
  setupTestData: setupTestData
};

// Track performance metrics
const metrics = {
  queueLoadTimes: [],
  sessionCreationTimes: [],
  answerSubmissionTimes: [],
  errorCounts: {}
};

function beforeRequest(requestParams, context, ee, next) {
  // Add timestamp for tracking
  context.vars.requestStartTime = Date.now();
  
  // Add request ID for tracking
  context.vars.requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Log request for debugging
  if (process.env.DEBUG) {
    console.log(`[${context.vars.requestId}] ${requestParams.method} ${requestParams.url}`);
  }
  
  return next();
}

function afterResponse(requestParams, response, context, ee, next) {
  const responseTime = Date.now() - context.vars.requestStartTime;
  const endpoint = requestParams.url;
  
  // Track specific endpoint performance
  if (endpoint.includes('/api/review/queue')) {
    metrics.queueLoadTimes.push(responseTime);
    
    // Check if response time exceeds threshold
    if (responseTime > 300) {
      ee.emit('counter', 'slow_queue_loads', 1);
    }
  } else if (endpoint.includes('/api/review/session/start')) {
    metrics.sessionCreationTimes.push(responseTime);
    
    if (responseTime > 1000) {
      ee.emit('counter', 'slow_session_creation', 1);
    }
  } else if (endpoint.includes('/answer')) {
    metrics.answerSubmissionTimes.push(responseTime);
  }
  
  // Track errors by endpoint
  if (response.statusCode >= 400) {
    const errorKey = `${endpoint}_${response.statusCode}`;
    metrics.errorCounts[errorKey] = (metrics.errorCounts[errorKey] || 0) + 1;
    
    ee.emit('counter', 'api_errors', 1);
    
    // Log error details
    console.error(`[${context.vars.requestId}] Error ${response.statusCode} on ${endpoint}`);
    if (response.body) {
      console.error(`Response: ${JSON.stringify(response.body)}`);
    }
  }
  
  // Emit custom metrics
  ee.emit('histogram', 'response_time_by_endpoint', responseTime, { endpoint: endpoint });
  
  return next();
}

function setupTestData(context, events, done) {
  // Setup test data before scenarios run
  console.log('Setting up test data for load testing...');
  
  // Create test users
  const testUsers = [];
  for (let i = 1; i <= 100; i++) {
    testUsers.push({
      email: `loadtest${i}@test.com`,
      password: 'TestPassword123!',
      username: `loadtest${i}`
    });
  }
  
  context.vars.testUsers = testUsers;
  
  // Create test content items
  const contentItems = [];
  const contentTypes = ['kana', 'kanji', 'vocabulary', 'sentence'];
  
  for (let type of contentTypes) {
    for (let i = 1; i <= 100; i++) {
      contentItems.push({
        type: type,
        id: `${type}-${i}`,
        difficulty: Math.random()
      });
    }
  }
  
  context.vars.contentItems = contentItems;
  
  console.log(`Created ${testUsers.length} test users and ${contentItems.length} content items`);
  
  return done();
}

// Export performance report generator
module.exports.generateReport = function() {
  const report = {
    timestamp: new Date().toISOString(),
    metrics: {
      queueLoad: {
        count: metrics.queueLoadTimes.length,
        avg: average(metrics.queueLoadTimes),
        p95: percentile(metrics.queueLoadTimes, 95),
        p99: percentile(metrics.queueLoadTimes, 99),
        slowRequests: metrics.queueLoadTimes.filter(t => t > 300).length
      },
      sessionCreation: {
        count: metrics.sessionCreationTimes.length,
        avg: average(metrics.sessionCreationTimes),
        p95: percentile(metrics.sessionCreationTimes, 95),
        p99: percentile(metrics.sessionCreationTimes, 99),
        slowRequests: metrics.sessionCreationTimes.filter(t => t > 1000).length
      },
      answerSubmission: {
        count: metrics.answerSubmissionTimes.length,
        avg: average(metrics.answerSubmissionTimes),
        p95: percentile(metrics.answerSubmissionTimes, 95),
        p99: percentile(metrics.answerSubmissionTimes, 99)
      },
      errors: metrics.errorCounts
    }
  };
  
  return report;
};

// Helper functions
function average(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[index];
}