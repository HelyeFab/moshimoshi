#!/bin/bash

# News System Fix - Automated Deployment Script
# Run this after authenticating with: firebase login

set -e  # Exit on error

echo "================================"
echo "News System Fix - Deployment"
echo "================================"
echo ""

# Colors
RED='\033[0:31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if firebase is logged in
echo -e "${YELLOW}[1/4] Checking Firebase authentication...${NC}"
if ! firebase projects:list >/dev/null 2>&1; then
    echo -e "${RED}❌ Not authenticated with Firebase${NC}"
    echo "Please run: firebase login"
    exit 1
fi
echo -e "${GREEN}✅ Authenticated${NC}"
echo ""

# Deploy Firestore indexes
echo -e "${YELLOW}[2/4] Deploying Firestore indexes...${NC}"
firebase deploy --only firestore:indexes --project moshimoshi-de237
echo -e "${GREEN}✅ Indexes deployed (may take 5-10 minutes to build)${NC}"
echo ""

# Deploy Cloud Functions
echo -e "${YELLOW}[3/4] Deploying Cloud Functions...${NC}"
firebase deploy --only functions:manualNewsScraperFunction,functions:scheduledNewsScraperFunction --project moshimoshi-de237
echo -e "${GREEN}✅ Functions deployed${NC}"
echo ""

# Trigger manual scrapes
echo -e "${YELLOW}[4/4] Populating database with articles...${NC}"

echo "  - Scraping Watanoc..."
curl -s -X POST https://moshimoshi.vercel.app/api/news/scrape \
  -H "Content-Type: application/json" \
  -d '{"source": "watanoc"}' | jq -r '.articlesCount // "error"'

echo "  - Scraping Mainichi News..."
curl -s -X POST https://moshimoshi.vercel.app/api/news/scrape \
  -H "Content-Type: application/json" \
  -d '{"source": "mainichi-news"}' | jq -r '.articlesCount // "error"'

echo "  - Scraping Mainichi Elementary..."
curl -s -X POST https://moshimoshi.vercel.app/api/news/scrape \
  -H "Content-Type: application/json" \
  -d '{"source": "mainichi-shogakusei"}' | jq -r '.articlesCount // "error"'

echo "  - Scraping Todaii..."
curl -s -X POST https://moshimoshi.vercel.app/api/news/scrape \
  -H "Content-Type: application/json" \
  -d '{"source": "todaii"}' | jq -r '.articlesCount // "error"'

echo -e "${GREEN}✅ Scraping complete${NC}"
echo ""

# Verify results
echo -e "${YELLOW}Verifying article counts...${NC}"
node -e "
const admin = require('firebase-admin');
const serviceAccount = require('./moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

(async () => {
  const sources = ['NHK Easy', 'Watanoc', 'Mainichi News', 'Mainichi Elementary', 'Todaii'];

  console.log('Articles by source:');
  for (const source of sources) {
    const snapshot = await db.collection('news_articles')
      .where('source', '==', source)
      .count()
      .get();
    console.log('  -', source + ':', snapshot.data().count);
  }

  const total = await db.collection('news_articles').count().get();
  console.log('\\n  Total:', total.data().count, 'articles');

  process.exit(0);
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
"

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "Next steps:"
echo "1. Check Firebase Console for index build status"
echo "2. Visit /news page to verify articles load"
echo "3. Test pagination and filters"
echo ""
