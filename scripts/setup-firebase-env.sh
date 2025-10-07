#!/bin/bash

# Setup Firebase Admin Environment Variables
# This script extracts credentials from service account JSON and sets up .env.local

SERVICE_ACCOUNT_FILE="moshimoshi-service-account.json"

if [ ! -f "$SERVICE_ACCOUNT_FILE" ]; then
  echo "❌ Service account file not found: $SERVICE_ACCOUNT_FILE"
  echo "Expected location: $(pwd)/$SERVICE_ACCOUNT_FILE"
  exit 1
fi

echo "✅ Found service account file"

# Extract values from JSON
PROJECT_ID=$(cat $SERVICE_ACCOUNT_FILE | grep '"project_id"' | cut -d'"' -f4)
CLIENT_EMAIL=$(cat $SERVICE_ACCOUNT_FILE | grep '"client_email"' | cut -d'"' -f4)
PRIVATE_KEY=$(cat $SERVICE_ACCOUNT_FILE | grep '"private_key"' | cut -d'"' -f4)

echo "Project ID: $PROJECT_ID"
echo "Client Email: $CLIENT_EMAIL"
echo "Private Key: [REDACTED - $(echo $PRIVATE_KEY | wc -c) chars]"

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
  echo "Creating .env.local..."
  touch .env.local
fi

# Backup existing .env.local
cp .env.local .env.local.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Backed up existing .env.local"

# Remove old Firebase Admin entries if they exist
sed -i '/^FIREBASE_ADMIN_PROJECT_ID=/d' .env.local
sed -i '/^FIREBASE_ADMIN_CLIENT_EMAIL=/d' .env.local
sed -i '/^FIREBASE_ADMIN_PRIVATE_KEY=/d' .env.local

# Add new entries
echo "" >> .env.local
echo "# Firebase Admin SDK (Auto-generated from $SERVICE_ACCOUNT_FILE)" >> .env.local
echo "FIREBASE_ADMIN_PROJECT_ID=\"$PROJECT_ID\"" >> .env.local
echo "FIREBASE_ADMIN_CLIENT_EMAIL=\"$CLIENT_EMAIL\"" >> .env.local
echo "FIREBASE_ADMIN_PRIVATE_KEY=\"$PRIVATE_KEY\"" >> .env.local

echo ""
echo "✅ Firebase Admin environment variables added to .env.local"
echo ""
echo "Next steps:"
echo "1. Restart your dev server: npm run dev"
echo "2. Test the grammar explanation feature"
echo "3. Check server logs for [GrammarCache] messages"
echo ""
