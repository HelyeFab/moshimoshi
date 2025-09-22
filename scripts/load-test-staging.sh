#!/bin/bash

# Load Testing Script for Staging Environment
# Tests with 500 concurrent users

set -e

# Configuration
STAGING_URL="${STAGING_URL:-https://staging.moshimoshi.app}"
CONCURRENT_USERS=500
TEST_DURATION="5m"
RAMP_UP="30s"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "======================================"
echo "   Load Testing Staging Environment  "
echo "======================================"
echo ""
echo "Target: $STAGING_URL"
echo "Concurrent Users: $CONCURRENT_USERS"
echo "Duration: $TEST_DURATION"
echo "Ramp-up: $RAMP_UP"
echo ""

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${YELLOW}k6 not found. Installing...${NC}"
    # Install k6
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install k6
    else
        sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
        echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
        sudo apt-get update
        sudo apt-get install k6
    fi
fi

# Create k6 test script
cat > /tmp/load-test.js <<'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const successRate = new Rate('success');

// Test configuration
export const options = {
    stages: [
        { duration: '__RAMP_UP__', target: __USERS__ },  // Ramp up
        { duration: '__DURATION__', target: __USERS__ }, // Stay at target
        { duration: '30s', target: 0 },                  // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% under 500ms, 99% under 1s
        http_req_failed: ['rate<0.05'],                  // Error rate under 5%
        errors: ['rate<0.05'],                           // Custom error rate under 5%
    },
};

const BASE_URL = '__BASE_URL__';

// Test scenarios
const scenarios = [
    { path: '/api/health', weight: 10 },
    { path: '/api/review/queue', weight: 30 },
    { path: '/api/review/session', weight: 25 },
    { path: '/api/progress', weight: 20 },
    { path: '/api/stats', weight: 10 },
    { path: '/', weight: 5 },
];

// Helper function to select scenario based on weight
function selectScenario() {
    const totalWeight = scenarios.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const scenario of scenarios) {
        random -= scenario.weight;
        if (random <= 0) {
            return scenario;
        }
    }
    return scenarios[0];
}

export default function () {
    const scenario = selectScenario();
    const url = `${BASE_URL}${scenario.path}`;
    
    // Add headers to simulate real browser
    const params = {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Load Test)',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: '10s',
    };
    
    // Make request
    const response = http.get(url, params);
    
    // Check response
    const success = check(response, {
        'status is 200': (r) => r.status === 200,
        'response time < 500ms': (r) => r.timings.duration < 500,
        'response time < 1000ms': (r) => r.timings.duration < 1000,
        'has valid JSON': (r) => {
            try {
                if (scenario.path.startsWith('/api')) {
                    JSON.parse(r.body);
                }
                return true;
            } catch {
                return false;
            }
        },
    });
    
    // Track metrics
    errorRate.add(!success);
    successRate.add(success);
    
    // Simulate user think time
    sleep(Math.random() * 2 + 1); // 1-3 seconds
}

// Handle test lifecycle
export function handleSummary(data) {
    return {
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
        '/tmp/load-test-results.json': JSON.stringify(data),
    };
}

function textSummary(data, options) {
    const { metrics } = data;
    
    let summary = '\n=== Load Test Results ===\n\n';
    
    // Request metrics
    summary += 'Request Metrics:\n';
    summary += `  Total Requests: ${metrics.http_reqs.values.count}\n`;
    summary += `  Request Rate: ${metrics.http_reqs.values.rate.toFixed(2)}/s\n`;
    summary += `  Failed Requests: ${(metrics.http_req_failed.values.rate * 100).toFixed(2)}%\n`;
    summary += '\n';
    
    // Response time metrics
    summary += 'Response Time:\n';
    summary += `  Average: ${metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
    summary += `  Median: ${metrics.http_req_duration.values.med.toFixed(2)}ms\n`;
    summary += `  P95: ${metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
    summary += `  P99: ${metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n`;
    summary += '\n';
    
    // Throughput
    const throughput = metrics.data_received.values.rate / 1024;
    summary += `Data Throughput: ${throughput.toFixed(2)} KB/s\n`;
    
    return summary;
}
EOF

# Replace placeholders in test script
sed -i "s|__BASE_URL__|$STAGING_URL|g" /tmp/load-test.js
sed -i "s|__USERS__|$CONCURRENT_USERS|g" /tmp/load-test.js
sed -i "s|__DURATION__|$TEST_DURATION|g" /tmp/load-test.js
sed -i "s|__RAMP_UP__|$RAMP_UP|g" /tmp/load-test.js

# Run load test
echo -e "${BLUE}Starting load test...${NC}"
echo ""

k6 run /tmp/load-test.js --summary-trend-stats="avg,min,med,max,p(95),p(99)" || {
    echo -e "${RED}Load test failed!${NC}"
    exit 1
}

# Analyze results
echo ""
echo -e "${GREEN}Load test completed!${NC}"
echo ""

# Parse JSON results if available
if [ -f /tmp/load-test-results.json ]; then
    echo "=== Performance Analysis ==="
    
    # Extract key metrics using jq
    if command -v jq &> /dev/null; then
        error_rate=$(jq '.metrics.http_req_failed.values.rate' /tmp/load-test-results.json)
        avg_duration=$(jq '.metrics.http_req_duration.values.avg' /tmp/load-test-results.json)
        p95_duration=$(jq '.metrics.http_req_duration.values["p(95)"]' /tmp/load-test-results.json)
        p99_duration=$(jq '.metrics.http_req_duration.values["p(99)"]' /tmp/load-test-results.json)
        total_requests=$(jq '.metrics.http_reqs.values.count' /tmp/load-test-results.json)
        
        echo "Total Requests: $total_requests"
        echo "Error Rate: $(echo "$error_rate * 100" | bc -l | cut -c1-5)%"
        echo "Avg Response Time: ${avg_duration}ms"
        echo "P95 Response Time: ${p95_duration}ms"
        echo "P99 Response Time: ${p99_duration}ms"
        
        # Determine if test passed
        if (( $(echo "$error_rate < 0.05" | bc -l) )) && \
           (( $(echo "$p95_duration < 500" | bc -l) )) && \
           (( $(echo "$p99_duration < 1000" | bc -l) )); then
            echo ""
            echo -e "${GREEN}✅ All performance targets met!${NC}"
            echo "Staging environment is ready for production deployment."
        else
            echo ""
            echo -e "${YELLOW}⚠️  Some performance targets not met${NC}"
            echo "Review metrics before proceeding to production."
        fi
    fi
fi

# Cleanup
rm -f /tmp/load-test.js /tmp/load-test-results.json

echo ""
echo "Load test artifacts cleaned up."
echo "Review staging monitoring dashboards for detailed metrics."