#!/bin/bash

# Staging Smoke Tests
# Comprehensive testing suite for staging deployment

set -e

# Configuration
STAGING_URL="${STAGING_URL:-https://staging.moshimoshi.app}"
API_BASE="$STAGING_URL/api"
TIMEOUT=10

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test results
PASSED=0
FAILED=0
WARNINGS=0

# Test functions
test_endpoint() {
    local endpoint="$1"
    local expected_status="$2"
    local test_name="$3"
    
    echo -n "Testing $test_name... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$endpoint")
    
    if [ "$response" == "$expected_status" ]; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (Expected: $expected_status, Got: $response)"
        ((FAILED++))
        return 1
    fi
}

test_json_response() {
    local endpoint="$1"
    local json_path="$2"
    local expected_value="$3"
    local test_name="$4"
    
    echo -n "Testing $test_name... "
    
    response=$(curl -s --max-time $TIMEOUT "$endpoint")
    actual_value=$(echo "$response" | jq -r "$json_path" 2>/dev/null || echo "")
    
    if [ "$actual_value" == "$expected_value" ]; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (Expected: $expected_value, Got: $actual_value)"
        ((FAILED++))
        return 1
    fi
}

test_response_time() {
    local endpoint="$1"
    local max_time="$2"
    local test_name="$3"
    
    echo -n "Testing $test_name... "
    
    response_time=$(curl -s -o /dev/null -w "%{time_total}" --max-time $TIMEOUT "$endpoint")
    response_time_ms=$(echo "$response_time * 1000" | bc | cut -d. -f1)
    
    if [ "$response_time_ms" -lt "$max_time" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (${response_time_ms}ms)"
        ((PASSED++))
        return 0
    else
        echo -e "${YELLOW}⚠ WARNING${NC} (${response_time_ms}ms > ${max_time}ms)"
        ((WARNINGS++))
        return 1
    fi
}

echo "======================================"
echo "     Staging Environment Tests        "
echo "======================================"
echo ""
echo "Target: $STAGING_URL"
echo ""

# 1. Health Checks
echo "=== Health Checks ==="
test_endpoint "$API_BASE/health" "200" "Health endpoint"
test_endpoint "$API_BASE/ready" "200" "Ready endpoint"
test_json_response "$API_BASE/health" ".status" "healthy" "Health status"
echo ""

# 2. API Endpoints
echo "=== API Endpoints ==="
test_endpoint "$API_BASE/review/queue" "200" "Review queue endpoint"
test_endpoint "$API_BASE/review/session" "200" "Session endpoint"
test_endpoint "$API_BASE/progress" "200" "Progress endpoint"
test_endpoint "$API_BASE/stats" "200" "Statistics endpoint"
echo ""

# 3. Authentication
echo "=== Authentication ==="
test_endpoint "$STAGING_URL/api/auth/providers" "200" "Auth providers"
test_endpoint "$STAGING_URL/api/auth/csrf" "200" "CSRF token"
echo ""

# 4. Static Assets
echo "=== Static Assets ==="
test_endpoint "$STAGING_URL" "200" "Homepage"
test_endpoint "$STAGING_URL/favicon.ico" "200" "Favicon"
test_endpoint "$STAGING_URL/_next/static/css/" "404" "CSS bundle (should be hashed)"
echo ""

# 5. Performance Tests
echo "=== Performance ==="
test_response_time "$API_BASE/health" "100" "Health check response time"
test_response_time "$API_BASE/ready" "100" "Ready check response time"
test_response_time "$STAGING_URL" "1000" "Homepage load time"
echo ""

# 6. Security Headers
echo "=== Security Headers ==="
echo -n "Testing security headers... "
headers=$(curl -s -I --max-time $TIMEOUT "$STAGING_URL")

if echo "$headers" | grep -q "X-Frame-Options"; then
    echo -e "${GREEN}✓ X-Frame-Options present${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ X-Frame-Options missing${NC}"
    ((WARNINGS++))
fi

if echo "$headers" | grep -q "X-Content-Type-Options"; then
    echo -e "${GREEN}✓ X-Content-Type-Options present${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ X-Content-Type-Options missing${NC}"
    ((WARNINGS++))
fi

if echo "$headers" | grep -q "Strict-Transport-Security"; then
    echo -e "${GREEN}✓ HSTS present${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ HSTS missing${NC}"
    ((WARNINGS++))
fi
echo ""

# 7. Database Connectivity
echo "=== Database Connectivity ==="
echo -n "Testing database connection... "
db_test=$(curl -s --max-time $TIMEOUT "$API_BASE/health/db" | jq -r '.connected' 2>/dev/null || echo "false")
if [ "$db_test" == "true" ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC}"
    ((FAILED++))
fi
echo ""

# 8. Cache Connectivity
echo "=== Cache Connectivity ==="
echo -n "Testing Redis connection... "
redis_test=$(curl -s --max-time $TIMEOUT "$API_BASE/health/redis" | jq -r '.connected' 2>/dev/null || echo "false")
if [ "$redis_test" == "true" ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC}"
    ((FAILED++))
fi
echo ""

# 9. Feature Flags
echo "=== Feature Flags ==="
echo -n "Testing feature flags endpoint... "
flags=$(curl -s --max-time $TIMEOUT "$API_BASE/features")
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC}"
    ((FAILED++))
fi
echo ""

# Summary
echo "======================================"
echo "            Test Summary              "
echo "======================================"
echo ""
echo -e "Passed:   ${GREEN}$PASSED${NC}"
echo -e "Failed:   ${RED}$FAILED${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All critical tests passed!${NC}"
    echo "Staging environment is ready for load testing."
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please review before proceeding.${NC}"
    exit 1
fi