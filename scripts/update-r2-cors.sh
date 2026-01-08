#!/bin/bash
# Update R2 CORS Configuration Script
# Usage: ./scripts/update-r2-cors.sh

set -e

ACCOUNT_ID="e96be1325db4e122ca31691f8c2adbda"
BUCKET_NAME="moshmoshi-anki"

# Check if CLOUDFLARE_API_TOKEN is set
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "Error: CLOUDFLARE_API_TOKEN environment variable not set"
  echo "Get your API token from: https://dash.cloudflare.com/profile/api-tokens"
  exit 1
fi

# CORS configuration
CORS_CONFIG='{
  "rules": [
    {
      "AllowedOrigins": [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://moshimoshi.app",
        "https://www.moshimoshi.app"
      ],
      "AllowedMethods": ["GET", "PUT", "POST", "HEAD", "DELETE"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag", "Content-Length"],
      "MaxAgeSeconds": 3600
    }
  ]
}'

echo "Updating CORS configuration for bucket: $BUCKET_NAME"

# Make API request
response=$(curl -s -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/r2/buckets/$BUCKET_NAME/cors" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$CORS_CONFIG")

# Check response
if echo "$response" | grep -q '"success":true'; then
  echo "✅ CORS configuration updated successfully!"
  echo "$response" | python3 -m json.tool
else
  echo "❌ Failed to update CORS configuration"
  echo "$response" | python3 -m json.tool
  exit 1
fi
