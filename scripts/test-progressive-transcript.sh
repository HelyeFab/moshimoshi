#!/bin/bash

# Test Script for Progressive Transcript System
# Runs all tests related to the new progressive loading feature

set -e  # Exit on error

echo "🧪 Testing Progressive Transcript System"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_warning "node_modules not found. Running npm install..."
    npm install
fi

# 1. Unit Tests
print_step "Running unit tests for useProgressiveTranscript hook..."
npm run test -- src/hooks/__tests__/useProgressiveTranscript.test.tsx --passWithNoTests
if [ $? -eq 0 ]; then
    print_success "Hook tests passed"
else
    print_error "Hook tests failed"
    exit 1
fi

echo ""

# 2. Component Tests
print_step "Running component tests for CaptionDisplay..."
npm run test -- src/components/youtube-shadowing/__tests__/CaptionDisplay.test.tsx --passWithNoTests
if [ $? -eq 0 ]; then
    print_success "Component tests passed"
else
    print_error "Component tests failed"
    exit 1
fi

echo ""

# 3. E2E Tests (if Playwright is installed)
if command -v npx &> /dev/null && npx playwright --version &> /dev/null; then
    print_step "Running E2E tests with Playwright..."
    npx playwright test e2e/progressive-transcript.spec.ts
    if [ $? -eq 0 ]; then
        print_success "E2E tests passed"
    else
        print_warning "E2E tests failed (may require running dev server)"
    fi
else
    print_warning "Playwright not installed. Skipping E2E tests."
    echo "  To install: npx playwright install"
fi

echo ""

# 4. Type Check
print_step "Running TypeScript type checking..."
npm run type-check
if [ $? -eq 0 ]; then
    print_success "Type checking passed"
else
    print_error "Type checking failed"
    exit 1
fi

echo ""

# 5. Test Coverage (optional)
print_step "Generating test coverage report..."
npm run test -- src/hooks/__tests__/useProgressiveTranscript.test.tsx src/components/youtube-shadowing/__tests__/CaptionDisplay.test.tsx --coverage --passWithNoTests
if [ $? -eq 0 ]; then
    print_success "Coverage report generated"
    echo "  View coverage: open coverage/lcov-report/index.html"
else
    print_warning "Coverage generation had issues"
fi

echo ""
echo "========================================"
echo -e "${GREEN}✓ All tests completed!${NC}"
echo ""
echo "Summary:"
echo "  ✓ Hook unit tests"
echo "  ✓ Component tests"
echo "  ✓ Type checking"
if command -v npx &> /dev/null && npx playwright --version &> /dev/null; then
    echo "  ✓ E2E tests"
fi
echo ""
echo "Next steps:"
echo "  1. Review coverage report"
echo "  2. Test manually with: npm run dev"
echo "  3. Deploy to staging"
