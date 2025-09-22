#!/bin/bash

echo "🔍 Starting Secret Scanning..."
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FOUND_ISSUES=0

# Patterns to search for
declare -A patterns=(
    ["AWS Access Key"]="AKIA[0-9A-Z]{16}"
    ["AWS Secret Key"]="[0-9a-zA-Z/+=]{40}"
    ["GitHub Token"]="gh[ps]_[0-9a-zA-Z]{36}"
    ["Generic API Key"]="api[_-]?key[_-]?[=:][[:space:]]*['\"][0-9a-zA-Z]{32,}['\"]"
    ["Generic Secret"]="secret[_-]?[=:][[:space:]]*['\"][0-9a-zA-Z]{32,}['\"]"
    ["Private Key"]="-----BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY-----"
    ["JWT Secret"]="jwt[_-]?secret[_-]?[=:][[:space:]]*['\"][^'\"]{32,}['\"]"
    ["Database URL with Password"]="(postgres|mysql|mongodb)://[^:]+:[^@]+@"
    ["Stripe Key"]="sk_(test|live)_[0-9a-zA-Z]{24,}"
    ["Firebase Key"]="AIza[0-9A-Za-z\\-_]{35}"
)

# Files and directories to exclude
EXCLUDE_DIRS="node_modules|.git|coverage|dist|build|.next"
EXCLUDE_FILES="package-lock.json|yarn.lock|*.map|*.min.js"

echo "Scanning for potential secrets..."
echo ""

for pattern_name in "${!patterns[@]}"; do
    pattern="${patterns[$pattern_name]}"
    echo -n "Checking for $pattern_name... "
    
    # Use grep with extended regex to find patterns
    results=$(grep -rEn "$pattern" . \
        --exclude-dir={node_modules,.git,coverage,dist,build,.next} \
        --exclude={package-lock.json,yarn.lock,*.map,*.min.js} \
        --exclude="secret-scan.sh" 2>/dev/null)
    
    if [ ! -z "$results" ]; then
        echo -e "${RED}FOUND${NC}"
        echo "$results" | while IFS= read -r line; do
            echo -e "  ${YELLOW}↳${NC} $line"
        done
        ((FOUND_ISSUES++))
    else
        echo -e "${GREEN}OK${NC}"
    fi
done

echo ""
echo "================================"

# Check for .env files
echo "Checking for .env files..."
env_files=$(find . -name ".env*" -not -path "./node_modules/*" -not -name ".env.example" -not -name ".env.sample" 2>/dev/null)

if [ ! -z "$env_files" ]; then
    echo -e "${YELLOW}Found .env files:${NC}"
    echo "$env_files"
    echo -e "${YELLOW}⚠️  Make sure these are in .gitignore!${NC}"
    
    # Check if they're in git
    for file in $env_files; do
        if git ls-files --error-unmatch "$file" 2>/dev/null; then
            echo -e "${RED}❌ WARNING: $file is tracked by git!${NC}"
            ((FOUND_ISSUES++))
        else
            echo -e "${GREEN}✓ $file is not tracked by git${NC}"
        fi
    done
else
    echo -e "${GREEN}No .env files found${NC}"
fi

echo ""
echo "================================"
echo "Checking .gitignore..."

# Check if important files are in .gitignore
important_ignores=(".env" ".env.local" ".env.production" "*.key" "*.pem" "*.p12")

for ignore in "${important_ignores[@]}"; do
    if grep -q "^$ignore" .gitignore 2>/dev/null; then
        echo -e "${GREEN}✓ $ignore is in .gitignore${NC}"
    else
        echo -e "${YELLOW}⚠️  $ignore is not in .gitignore${NC}"
    fi
done

echo ""
echo "================================"
echo "Secret Scan Complete!"
echo ""

if [ $FOUND_ISSUES -gt 0 ]; then
    echo -e "${RED}❌ Found $FOUND_ISSUES potential security issues${NC}"
    echo "Please review and fix these issues before deployment."
    exit 1
else
    echo -e "${GREEN}✅ No secrets detected!${NC}"
    echo "Remember to always use environment variables for sensitive data."
    exit 0
fi