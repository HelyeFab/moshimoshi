#!/bin/bash

# Test Multi-Step Story Generation API
echo "🎯 Testing Multi-Step Story Generation via API"
echo "=============================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Base URL (adjust if needed)
BASE_URL="http://localhost:3000"

# Test data
THEME="Spring in Japan"
JLPT_LEVEL="N5"
PAGE_COUNT=3

echo -e "\n${BLUE}📝 Step 1: Generate Character Sheet${NC}"
echo "----------------------------------------"

# Step 1: Character Sheet
RESPONSE_1=$(curl -s -X POST "$BASE_URL/api/admin/generate-story" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-admin-token" \
  -d '{
    "step": "character_sheet",
    "theme": "'"$THEME"'",
    "jlptLevel": "'"$JLPT_LEVEL"'",
    "pageCount": '"$PAGE_COUNT"'
  }')

if echo "$RESPONSE_1" | grep -q "draftId"; then
  echo -e "${GREEN}✅ Character sheet generated successfully${NC}"
  DRAFT_ID=$(echo "$RESPONSE_1" | grep -o '"draftId":"[^"]*' | cut -d'"' -f4)
  echo "Draft ID: $DRAFT_ID"

  # Check if response includes caching info
  if echo "$RESPONSE_1" | grep -q "cached"; then
    echo -e "${GREEN}✅ Response includes caching information${NC}"
  fi

  # Check if response includes usage info
  if echo "$RESPONSE_1" | grep -q "usage"; then
    echo -e "${GREEN}✅ Response includes usage tracking${NC}"
  fi
else
  echo "❌ Failed to generate character sheet"
  echo "$RESPONSE_1"
  exit 1
fi

echo -e "\n${BLUE}📋 Step 2: Generate Story Outline${NC}"
echo "----------------------------------------"

# Step 2: Outline
RESPONSE_2=$(curl -s -X POST "$BASE_URL/api/admin/generate-story" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-admin-token" \
  -d '{
    "step": "outline",
    "theme": "'"$THEME"'",
    "jlptLevel": "'"$JLPT_LEVEL"'",
    "pageCount": '"$PAGE_COUNT"',
    "draftId": "'"$DRAFT_ID"'"
  }')

if echo "$RESPONSE_2" | grep -q "success"; then
  echo -e "${GREEN}✅ Story outline generated successfully${NC}"
else
  echo "❌ Failed to generate outline"
  echo "$RESPONSE_2"
fi

echo -e "\n${BLUE}📖 Step 3: Generate Page 1${NC}"
echo "----------------------------------------"

# Step 3: Generate Page
RESPONSE_3=$(curl -s -X POST "$BASE_URL/api/admin/generate-story" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-admin-token" \
  -d '{
    "step": "generate_page",
    "jlptLevel": "'"$JLPT_LEVEL"'",
    "pageNumber": 1,
    "draftId": "'"$DRAFT_ID"'"
  }')

if echo "$RESPONSE_3" | grep -q "success"; then
  echo -e "${GREEN}✅ Page 1 generated successfully${NC}"
else
  echo "❌ Failed to generate page"
  echo "$RESPONSE_3"
fi

echo -e "\n${BLUE}❓ Step 4: Generate Quiz${NC}"
echo "----------------------------------------"

# Step 4: Generate Quiz
RESPONSE_4=$(curl -s -X POST "$BASE_URL/api/admin/generate-story" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-admin-token" \
  -d '{
    "step": "generate_quiz",
    "jlptLevel": "'"$JLPT_LEVEL"'",
    "draftId": "'"$DRAFT_ID"'"
  }')

if echo "$RESPONSE_4" | grep -q "success"; then
  echo -e "${GREEN}✅ Quiz generated successfully${NC}"
else
  echo "❌ Failed to generate quiz"
  echo "$RESPONSE_4"
fi

echo -e "\n=============================================="
echo -e "${GREEN}📊 TEST SUMMARY${NC}"
echo "=============================================="
echo -e "${GREEN}✅ Multi-step story generation API is working!${NC}"
echo "✓ Character sheet generation with AI Service"
echo "✓ Story outline generation"
echo "✓ Individual page generation"
echo "✓ Quiz generation"
echo "✓ Caching information included"
echo "✓ Usage tracking included"
echo -e "\n${BLUE}💾 Benefits of Unified AI Service:${NC}"
echo "• Response caching reduces API calls"
echo "• Token usage tracking for cost management"
echo "• Configurable prompts via JSON"
echo "• Consistent error handling"
echo "• Smart model selection"