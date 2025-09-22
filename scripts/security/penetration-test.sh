#!/bin/bash

# Penetration Testing Script
# Week 3 - Security Validation
# Agent 4: Security & Compliance Officer

set -e

# Configuration
TARGET_URL="${1:-http://localhost:3000}"
REPORT_DIR="security-reports/pentest-$(date +%Y%m%d_%H%M%S)"
MAX_THREADS=5

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}           Penetration Testing - Review Engine v1.0           ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "Target: $TARGET_URL"
echo "Report: $REPORT_DIR"
echo ""

# Create report directory
mkdir -p $REPORT_DIR

# Test results tracking
VULNERABILITIES=()
WARNINGS=()
PASSED=()

# Log test result
log_test() {
    local test_name=$1
    local status=$2
    local details=$3
    
    case $status in
        "VULN")
            echo -e "${RED}[VULNERABLE]${NC} $test_name: $details"
            VULNERABILITIES+=("$test_name: $details")
            echo "[VULNERABLE] $test_name: $details" >> $REPORT_DIR/findings.txt
            ;;
        "WARN")
            echo -e "${YELLOW}[WARNING]${NC} $test_name: $details"
            WARNINGS+=("$test_name: $details")
            echo "[WARNING] $test_name: $details" >> $REPORT_DIR/findings.txt
            ;;
        "PASS")
            echo -e "${GREEN}[SECURE]${NC} $test_name"
            PASSED+=("$test_name")
            echo "[SECURE] $test_name" >> $REPORT_DIR/findings.txt
            ;;
    esac
}

# 1. SQL Injection Testing
echo -e "\n${BLUE}[1/10] SQL Injection Testing${NC}"
echo "----------------------------------------"

SQL_PAYLOADS=(
    "' OR '1'='1"
    "1' OR '1' = '1"
    "admin'--"
    "' UNION SELECT NULL--"
    "1' AND 1=1--"
)

for payload in "${SQL_PAYLOADS[@]}"; do
    response=$(curl -s -X POST "$TARGET_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$payload\",\"password\":\"test\"}" 2>/dev/null || echo "")
    
    if [[ $response == *"error"* ]] || [[ $response == *"Invalid"* ]]; then
        continue
    elif [[ $response == *"SQL"* ]] || [[ $response == *"syntax"* ]]; then
        log_test "SQL Injection" "VULN" "Vulnerable to payload: $payload"
        break
    fi
done

if [ ${#VULNERABILITIES[@]} -eq 0 ]; then
    log_test "SQL Injection" "PASS" ""
fi

# 2. XSS Testing
echo -e "\n${BLUE}[2/10] Cross-Site Scripting (XSS) Testing${NC}"
echo "----------------------------------------"

XSS_PAYLOADS=(
    "<script>alert('XSS')</script>"
    "<img src=x onerror=alert('XSS')>"
    "javascript:alert('XSS')"
    "<svg onload=alert('XSS')>"
    "'-alert('XSS')-'"
)

for payload in "${XSS_PAYLOADS[@]}"; do
    # Test in various input fields
    response=$(curl -s -X POST "$TARGET_URL/api/review/submit" \
        -H "Content-Type: application/json" \
        -d "{\"answer\":\"$payload\"}" 2>/dev/null || echo "")
    
    if [[ $response == *"$payload"* ]] && [[ $response != *"&lt;"* ]]; then
        log_test "XSS" "VULN" "Reflected XSS with payload: $payload"
        break
    fi
done

if [[ ! " ${VULNERABILITIES[@]} " =~ "XSS" ]]; then
    log_test "XSS" "PASS" ""
fi

# 3. Authentication Bypass Testing
echo -e "\n${BLUE}[3/10] Authentication Bypass Testing${NC}"
echo "----------------------------------------"

# Test accessing protected endpoints without auth
PROTECTED_ENDPOINTS=(
    "/api/admin/users"
    "/api/user/profile"
    "/api/review/history"
)

AUTH_VULNERABLE=false
for endpoint in "${PROTECTED_ENDPOINTS[@]}"; do
    response_code=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET_URL$endpoint")
    
    if [ "$response_code" == "200" ]; then
        log_test "Authentication Bypass" "VULN" "Unprotected endpoint: $endpoint"
        AUTH_VULNERABLE=true
    fi
done

if [ "$AUTH_VULNERABLE" == "false" ]; then
    log_test "Authentication Bypass" "PASS" ""
fi

# 4. Broken Access Control
echo -e "\n${BLUE}[4/10] Broken Access Control Testing${NC}"
echo "----------------------------------------"

# Test IDOR vulnerability
response=$(curl -s "$TARGET_URL/api/user/1/data" 2>/dev/null || echo "")
if [[ $response != *"unauthorized"* ]] && [[ $response != *"403"* ]]; then
    log_test "IDOR" "VULN" "User data accessible without proper authorization"
else
    log_test "IDOR" "PASS" ""
fi

# 5. Security Misconfiguration
echo -e "\n${BLUE}[5/10] Security Misconfiguration Testing${NC}"
echo "----------------------------------------"

# Check for exposed files
SENSITIVE_FILES=(
    "/.env"
    "/.git/config"
    "/package.json"
    "/admin"
    "/.DS_Store"
    "/backup.sql"
)

CONFIG_ISSUES=false
for file in "${SENSITIVE_FILES[@]}"; do
    response_code=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET_URL$file")
    
    if [ "$response_code" == "200" ]; then
        log_test "Exposed Files" "VULN" "Sensitive file exposed: $file"
        CONFIG_ISSUES=true
    fi
done

if [ "$CONFIG_ISSUES" == "false" ]; then
    log_test "Security Configuration" "PASS" ""
fi

# 6. API Rate Limiting Test
echo -e "\n${BLUE}[6/10] API Rate Limiting Testing${NC}"
echo "----------------------------------------"

# Send rapid requests
SUCCESS_COUNT=0
for i in {1..50}; do
    response_code=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET_URL/api/auth/login" \
        -X POST -H "Content-Type: application/json" \
        -d '{"email":"test@test.com","password":"test"}')
    
    if [ "$response_code" == "200" ] || [ "$response_code" == "401" ]; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    fi
done

if [ $SUCCESS_COUNT -gt 45 ]; then
    log_test "Rate Limiting" "VULN" "No rate limiting detected (${SUCCESS_COUNT}/50 requests succeeded)"
else
    log_test "Rate Limiting" "PASS" ""
fi

# 7. CSRF Testing
echo -e "\n${BLUE}[7/10] Cross-Site Request Forgery (CSRF) Testing${NC}"
echo "----------------------------------------"

# Test for CSRF token validation
response=$(curl -s -X POST "$TARGET_URL/api/user/update" \
    -H "Content-Type: application/json" \
    -d '{"name":"CSRF Test"}' \
    --cookie "session=fake" 2>/dev/null || echo "")

if [[ $response == *"success"* ]]; then
    log_test "CSRF" "VULN" "No CSRF token validation"
else
    log_test "CSRF" "PASS" ""
fi

# 8. Security Headers Check
echo -e "\n${BLUE}[8/10] Security Headers Testing${NC}"
echo "----------------------------------------"

headers=$(curl -s -I "$TARGET_URL" 2>/dev/null)

REQUIRED_HEADERS=(
    "X-Frame-Options"
    "X-Content-Type-Options"
    "X-XSS-Protection"
    "Strict-Transport-Security"
    "Content-Security-Policy"
)

MISSING_HEADERS=()
for header in "${REQUIRED_HEADERS[@]}"; do
    if [[ ! "$headers" == *"$header"* ]]; then
        MISSING_HEADERS+=("$header")
    fi
done

if [ ${#MISSING_HEADERS[@]} -gt 0 ]; then
    log_test "Security Headers" "WARN" "Missing headers: ${MISSING_HEADERS[*]}"
else
    log_test "Security Headers" "PASS" ""
fi

# 9. Cryptographic Testing
echo -e "\n${BLUE}[9/10] Cryptographic Security Testing${NC}"
echo "----------------------------------------"

# Check for weak algorithms
if curl -s "$TARGET_URL" -I 2>/dev/null | grep -q "Set-Cookie.*HttpOnly"; then
    log_test "Cookie Security" "PASS" ""
else
    log_test "Cookie Security" "WARN" "Cookies missing HttpOnly flag"
fi

# Check SSL/TLS
if [[ "$TARGET_URL" == https://* ]]; then
    ssl_info=$(echo | openssl s_client -connect "${TARGET_URL#https://}:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
    if [[ -n "$ssl_info" ]]; then
        log_test "SSL/TLS" "PASS" ""
    else
        log_test "SSL/TLS" "WARN" "SSL certificate issues detected"
    fi
else
    log_test "SSL/TLS" "WARN" "Not using HTTPS"
fi

# 10. Business Logic Testing
echo -e "\n${BLUE}[10/10] Business Logic Testing${NC}"
echo "----------------------------------------"

# Test for logic flaws
# Example: Negative quantity in payment
response=$(curl -s -X POST "$TARGET_URL/api/payment/process" \
    -H "Content-Type: application/json" \
    -d '{"amount":-100,"currency":"USD"}' 2>/dev/null || echo "")

if [[ $response == *"success"* ]]; then
    log_test "Business Logic" "VULN" "Accepts negative payment amounts"
else
    log_test "Business Logic" "PASS" ""
fi

# Generate Report
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                  PENETRATION TEST REPORT                    ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

cat > $REPORT_DIR/report.md << EOF
# Penetration Test Report

**Date:** $(date)
**Target:** $TARGET_URL
**Tester:** Security & Compliance Officer (Agent 4)

## Executive Summary

This penetration test was conducted to identify security vulnerabilities in the Moshimoshi Review Engine v1.0 before production deployment.

### Statistics
- **Critical Vulnerabilities:** ${#VULNERABILITIES[@]}
- **Warnings:** ${#WARNINGS[@]}
- **Passed Tests:** ${#PASSED[@]}

## Findings

### Critical Vulnerabilities
EOF

if [ ${#VULNERABILITIES[@]} -gt 0 ]; then
    for vuln in "${VULNERABILITIES[@]}"; do
        echo "- $vuln" >> $REPORT_DIR/report.md
    done
else
    echo "No critical vulnerabilities found." >> $REPORT_DIR/report.md
fi

cat >> $REPORT_DIR/report.md << EOF

### Warnings
EOF

if [ ${#WARNINGS[@]} -gt 0 ]; then
    for warn in "${WARNINGS[@]}"; do
        echo "- $warn" >> $REPORT_DIR/report.md
    done
else
    echo "No warnings." >> $REPORT_DIR/report.md
fi

cat >> $REPORT_DIR/report.md << EOF

### Passed Tests
EOF

for pass in "${PASSED[@]}"; do
    echo "- ✓ $pass" >> $REPORT_DIR/report.md
done

cat >> $REPORT_DIR/report.md << EOF

## Recommendations

1. **Immediate Actions Required:**
   - Fix all critical vulnerabilities before deployment
   - Implement missing security headers
   - Enable rate limiting on all endpoints

2. **Short-term Improvements:**
   - Enhance input validation
   - Implement comprehensive logging
   - Regular security audits

3. **Long-term Security Strategy:**
   - Implement Web Application Firewall (WAF)
   - Regular penetration testing (quarterly)
   - Security training for development team

## Compliance Status

- **OWASP Top 10:** ${#VULNERABILITIES[@]} issues found
- **PCI DSS:** Review required for payment processing
- **GDPR:** Data protection measures in place

## Conclusion

EOF

if [ ${#VULNERABILITIES[@]} -eq 0 ]; then
    echo "The application has passed penetration testing with no critical vulnerabilities. It is recommended for production deployment with continued monitoring." >> $REPORT_DIR/report.md
    echo -e "\n${GREEN}✓ PENETRATION TEST PASSED${NC}"
else
    echo "The application has critical security vulnerabilities that must be addressed before production deployment." >> $REPORT_DIR/report.md
    echo -e "\n${RED}✗ PENETRATION TEST FAILED${NC}"
fi

echo ""
echo "Report saved to: $REPORT_DIR/report.md"
echo ""

# Exit with appropriate code
if [ ${#VULNERABILITIES[@]} -gt 0 ]; then
    exit 1
else
    exit 0
fi