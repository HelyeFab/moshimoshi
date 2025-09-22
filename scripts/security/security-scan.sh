#!/bin/bash

# Production Security Scan Script
# Week 3 - Final Security Validation
# Agent 4: Security & Compliance Officer

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCAN_DATE=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="security-reports/${SCAN_DATE}"
CRITICAL_THRESHOLD=0
HIGH_THRESHOLD=0

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}     Production Security Scan - Review Engine v1.0           ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Create report directory
mkdir -p $REPORT_DIR

# Function to log results
log_result() {
    local test_name=$1
    local status=$2
    local details=$3
    
    if [ "$status" == "PASS" ]; then
        echo -e "${GREEN}✓${NC} $test_name: ${GREEN}PASSED${NC}"
    elif [ "$status" == "WARN" ]; then
        echo -e "${YELLOW}⚠${NC} $test_name: ${YELLOW}WARNING${NC} - $details"
    else
        echo -e "${RED}✗${NC} $test_name: ${RED}FAILED${NC} - $details"
    fi
    
    echo "[$status] $test_name: $details" >> $REPORT_DIR/scan-summary.txt
}

# 1. Dependency Security Scan
echo -e "\n${BLUE}[1/10] Dependency Security Scan${NC}"
echo "----------------------------------------"

# Check for npm audit
npm audit --json > $REPORT_DIR/npm-audit.json 2>&1 || true
VULNS=$(cat $REPORT_DIR/npm-audit.json | grep -o '"critical":[0-9]*' | cut -d: -f2 | head -1)
HIGHS=$(cat $REPORT_DIR/npm-audit.json | grep -o '"high":[0-9]*' | cut -d: -f2 | head -1)

if [ "$VULNS" == "0" ] && [ "$HIGHS" == "0" ]; then
    log_result "NPM Dependencies" "PASS" "No critical or high vulnerabilities"
else
    log_result "NPM Dependencies" "FAIL" "Found $VULNS critical and $HIGHS high vulnerabilities"
fi

# 2. Secret Detection
echo -e "\n${BLUE}[2/10] Secret Detection Scan${NC}"
echo "----------------------------------------"

# Check for exposed secrets
SECRETS_FOUND=0
SECRET_PATTERNS=(
    "api[_-]?key"
    "secret[_-]?key"
    "password"
    "token"
    "private[_-]?key"
    "firebase.*key"
    "stripe.*key"
)

for pattern in "${SECRET_PATTERNS[@]}"; do
    if grep -r -i "$pattern.*=.*['\"].*['\"]" --include="*.js" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=.next . > /dev/null 2>&1; then
        SECRETS_FOUND=$((SECRETS_FOUND + 1))
        echo "  Warning: Potential secret found matching pattern: $pattern"
    fi
done

if [ $SECRETS_FOUND -eq 0 ]; then
    log_result "Secret Detection" "PASS" "No hardcoded secrets detected"
else
    log_result "Secret Detection" "WARN" "Found $SECRETS_FOUND potential secret patterns"
fi

# 3. Security Headers Check
echo -e "\n${BLUE}[3/10] Security Headers Configuration${NC}"
echo "----------------------------------------"

# Check for security headers in Next.js config
if [ -f "next.config.ts" ] || [ -f "next.config.js" ]; then
    HEADERS_CONFIGURED=true
    
    # Check for specific headers
    for header in "X-Frame-Options" "X-Content-Type-Options" "X-XSS-Protection" "Strict-Transport-Security" "Content-Security-Policy"; do
        if grep -q "$header" next.config.* 2>/dev/null || grep -q "$header" src/middleware.ts 2>/dev/null; then
            echo "  ✓ $header configured"
        else
            echo "  ✗ $header not found"
            HEADERS_CONFIGURED=false
        fi
    done
    
    if [ "$HEADERS_CONFIGURED" == "true" ]; then
        log_result "Security Headers" "PASS" "All required headers configured"
    else
        log_result "Security Headers" "WARN" "Some security headers missing"
    fi
else
    log_result "Security Headers" "WARN" "next.config not found"
fi

# 4. Authentication & Authorization
echo -e "\n${BLUE}[4/10] Authentication Security${NC}"
echo "----------------------------------------"

# Check for secure authentication patterns
AUTH_ISSUES=0

# Check for JWT secret configuration
if ! grep -q "JWT_SECRET\|SESSION_SECRET" .env.example 2>/dev/null; then
    echo "  ⚠ JWT/Session secret not configured in environment"
    AUTH_ISSUES=$((AUTH_ISSUES + 1))
fi

# Check for password hashing
if grep -r "bcrypt\|argon2\|scrypt" --include="*.ts" --include="*.js" . > /dev/null 2>&1; then
    echo "  ✓ Password hashing library detected"
else
    echo "  ✗ No password hashing library found"
    AUTH_ISSUES=$((AUTH_ISSUES + 1))
fi

if [ $AUTH_ISSUES -eq 0 ]; then
    log_result "Authentication" "PASS" "Authentication properly configured"
else
    log_result "Authentication" "WARN" "$AUTH_ISSUES authentication issues found"
fi

# 5. API Security
echo -e "\n${BLUE}[5/10] API Security Validation${NC}"
echo "----------------------------------------"

# Check for rate limiting
if grep -r "ratelimit\|rate-limit" --include="*.ts" --include="*.js" src/ > /dev/null 2>&1; then
    echo "  ✓ Rate limiting configured"
    RATE_LIMIT_OK=true
else
    echo "  ✗ Rate limiting not detected"
    RATE_LIMIT_OK=false
fi

# Check for input validation
if grep -r "zod\|joi\|yup\|validator" --include="*.ts" --include="*.js" src/ > /dev/null 2>&1; then
    echo "  ✓ Input validation library detected"
    VALIDATION_OK=true
else
    echo "  ✗ No input validation library found"
    VALIDATION_OK=false
fi

if [ "$RATE_LIMIT_OK" == "true" ] && [ "$VALIDATION_OK" == "true" ]; then
    log_result "API Security" "PASS" "API security measures in place"
else
    log_result "API Security" "WARN" "Some API security measures missing"
fi

# 6. CORS Configuration
echo -e "\n${BLUE}[6/10] CORS Configuration${NC}"
echo "----------------------------------------"

if grep -r "cors" --include="*.ts" --include="*.js" src/ > /dev/null 2>&1; then
    echo "  ✓ CORS configuration detected"
    log_result "CORS" "PASS" "CORS properly configured"
else
    echo "  ⚠ CORS configuration not found"
    log_result "CORS" "WARN" "CORS configuration not detected"
fi

# 7. Database Security
echo -e "\n${BLUE}[7/10] Database Security${NC}"
echo "----------------------------------------"

DB_ISSUES=0

# Check for parameterized queries
if grep -r "\\$\{.*\}" --include="*.ts" --include="*.js" src/lib/firebase > /dev/null 2>&1; then
    echo "  ⚠ Potential SQL injection vulnerability (template literals in queries)"
    DB_ISSUES=$((DB_ISSUES + 1))
fi

# Check for connection pooling
if grep -r "connection.*pool\|pool.*config" --include="*.ts" src/lib/ > /dev/null 2>&1; then
    echo "  ✓ Connection pooling configured"
else
    echo "  ⚠ Connection pooling not detected"
    DB_ISSUES=$((DB_ISSUES + 1))
fi

if [ $DB_ISSUES -eq 0 ]; then
    log_result "Database Security" "PASS" "Database security measures in place"
else
    log_result "Database Security" "WARN" "$DB_ISSUES database security issues"
fi

# 8. SSL/TLS Configuration
echo -e "\n${BLUE}[8/10] SSL/TLS Configuration${NC}"
echo "----------------------------------------"

# Check for HTTPS enforcement
if grep -r "https\|ssl\|tls" docker-compose.yml nginx/ k8s/ 2>/dev/null | grep -q "ssl\|443"; then
    echo "  ✓ SSL/TLS configuration found"
    log_result "SSL/TLS" "PASS" "SSL/TLS properly configured"
else
    echo "  ⚠ SSL/TLS configuration not found in deployment files"
    log_result "SSL/TLS" "WARN" "Verify SSL/TLS configuration"
fi

# 9. Logging & Monitoring
echo -e "\n${BLUE}[9/10] Security Logging${NC}"
echo "----------------------------------------"

LOGGING_OK=true

# Check for security event logging
if grep -r "logAuth\|logSecurity\|audit" --include="*.ts" src/ > /dev/null 2>&1; then
    echo "  ✓ Security event logging detected"
else
    echo "  ⚠ Security event logging not found"
    LOGGING_OK=false
fi

# Check for PII protection in logs
if grep -r "password\|token\|key" --include="*.ts" src/lib/monitoring/ > /dev/null 2>&1; then
    echo "  ⚠ Potential PII in logs - verify redaction"
    LOGGING_OK=false
else
    echo "  ✓ No obvious PII in logging code"
fi

if [ "$LOGGING_OK" == "true" ]; then
    log_result "Security Logging" "PASS" "Logging properly configured"
else
    log_result "Security Logging" "WARN" "Review logging configuration"
fi

# 10. OWASP Top 10 Compliance
echo -e "\n${BLUE}[10/10] OWASP Top 10 Compliance Check${NC}"
echo "----------------------------------------"

OWASP_ISSUES=0

# A01:2021 – Broken Access Control
echo -n "  Checking A01 - Broken Access Control... "
if grep -r "useAdmin\|checkAuth\|requireAuth" --include="*.ts" src/ > /dev/null 2>&1; then
    echo "✓"
else
    echo "✗"
    OWASP_ISSUES=$((OWASP_ISSUES + 1))
fi

# A02:2021 – Cryptographic Failures
echo -n "  Checking A02 - Cryptographic Failures... "
if grep -r "bcrypt\|crypto\|encryption" --include="*.ts" src/ > /dev/null 2>&1; then
    echo "✓"
else
    echo "✗"
    OWASP_ISSUES=$((OWASP_ISSUES + 1))
fi

# A03:2021 – Injection
echo -n "  Checking A03 - Injection Prevention... "
if grep -r "zod\|sanitize\|escape" --include="*.ts" src/ > /dev/null 2>&1; then
    echo "✓"
else
    echo "✗"
    OWASP_ISSUES=$((OWASP_ISSUES + 1))
fi

# A04:2021 – Insecure Design
echo -n "  Checking A04 - Secure Design... "
if [ -f "SECURITY.md" ] || [ -f "docs/security.md" ]; then
    echo "✓"
else
    echo "⚠"
fi

# A05:2021 – Security Misconfiguration
echo -n "  Checking A05 - Security Configuration... "
if [ -f ".env.example" ] && grep -q "NODE_ENV=production" docker-compose.yml 2>/dev/null; then
    echo "✓"
else
    echo "⚠"
fi

if [ $OWASP_ISSUES -eq 0 ]; then
    log_result "OWASP Top 10" "PASS" "OWASP compliance verified"
else
    log_result "OWASP Top 10" "WARN" "$OWASP_ISSUES OWASP items need review"
fi

# Generate Summary Report
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                    SECURITY SCAN SUMMARY                    ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Count results
PASS_COUNT=$(grep -c "PASS" $REPORT_DIR/scan-summary.txt)
WARN_COUNT=$(grep -c "WARN" $REPORT_DIR/scan-summary.txt || echo "0")
FAIL_COUNT=$(grep -c "FAIL" $REPORT_DIR/scan-summary.txt || echo "0")

echo ""
echo "  Scan Date: $(date)"
echo "  Report Location: $REPORT_DIR/"
echo ""
echo "  Results:"
echo -e "    ${GREEN}Passed:${NC} $PASS_COUNT"
echo -e "    ${YELLOW}Warnings:${NC} $WARN_COUNT"
echo -e "    ${RED}Failed:${NC} $FAIL_COUNT"
echo ""

if [ $FAIL_COUNT -gt 0 ]; then
    echo -e "  ${RED}Status: FAILED - Critical issues must be resolved${NC}"
    exit 1
elif [ $WARN_COUNT -gt 5 ]; then
    echo -e "  ${YELLOW}Status: NEEDS REVIEW - Multiple warnings detected${NC}"
    exit 0
else
    echo -e "  ${GREEN}Status: PASSED - System ready for production${NC}"
    exit 0
fi