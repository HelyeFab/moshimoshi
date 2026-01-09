#!/bin/bash

# Production Testing Script for Moshimoshi
# This script tests critical production endpoints to verify environment variables are working

BASE_URL="https://moshimoshi.app"

echo "========================================="
echo "  MOSHIMOSHI PRODUCTION TEST SUITE"
echo "========================================="
echo ""
echo "Testing: $BASE_URL"
echo "Time: $(date)"
echo ""

PASS=0
FAIL=0
WARN=0

test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_code="$3"

    echo -n "[$name] "
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)

    if [ "$response" = "$expected_code" ]; then
        echo "✓ PASS (HTTP $response)"
        ((PASS++))
    else
        echo "✗ FAIL (Expected $expected_code, got $response)"
        ((FAIL++))
    fi
}

test_endpoint_contains() {
    local name="$1"
    local url="$2"
    local search_term="$3"

    echo -n "[$name] "
    content=$(curl -s "$url" 2>/dev/null)

    if echo "$content" | grep -q "$search_term"; then
        echo "✓ PASS (Found: $search_term)"
        ((PASS++))
    else
        echo "⚠ WARN (Not found: $search_term)"
        ((WARN++))
    fi
}

echo "=== Basic Availability ==="
test_endpoint "Homepage" "$BASE_URL/en" "200"
test_endpoint "Service Worker" "$BASE_URL/service-worker.js" "200"
test_endpoint "Manifest" "$BASE_URL/manifest.json" "200"
test_endpoint "Favicon" "$BASE_URL/favicon.svg" "200"
echo ""

echo "=== API Endpoints ==="
test_endpoint "Health Check" "$BASE_URL/api/health" "200"
test_endpoint "Auth Login (Invalid)" "$BASE_URL/api/auth/login" "400"
test_endpoint "Auth Signup (GET Method)" "$BASE_URL/api/auth/signup" "405"
echo ""

echo "=== Pre-Launch Campaign ==="
test_endpoint_contains "Pre-Launch Lock" "$BASE_URL/en" "2026"
test_endpoint_contains "Firebase Config" "$BASE_URL/en" "FirebaseError"
echo ""

echo "=== Performance ==="
echo -n "[Response Time] "
response_time=$(curl -s -o /dev/null -w "%{time_total}" "$BASE_URL/en" 2>/dev/null)
echo "$response_time seconds"
echo ""

echo "========================================="
echo "  TEST RESULTS"
echo "========================================="
echo "Passed: $PASS"
echo "Failed: $FAIL"
echo "Warnings: $WARN"
echo ""

if [ $FAIL -eq 0 ]; then
    echo "✓ All critical tests passed!"
    echo ""
    echo "NEXT STEPS:"
    echo "1. Test user authentication (signup/login)"
    echo "2. Test Stripe payment flow"
    echo "3. Test flashcard review sessions"
    echo "4. Verify pre-launch countdown is correct"
    echo "5. Test promo code: MOSHI25"
    echo ""
    echo "See PRODUCTION_VERIFICATION_REPORT.md for full testing checklist"
    exit 0
else
    echo "✗ Some tests failed. Please investigate."
    exit 1
fi
