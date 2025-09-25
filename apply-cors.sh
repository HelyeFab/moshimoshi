#!/bin/bash

# Apply CORS Configuration to Firebase Storage Bucket
# This script sets up CORS for the Firebase Storage bucket to allow TTS audio playback

echo "🔧 Applying CORS configuration to Firebase Storage..."
echo ""
echo "This script will configure CORS for your Firebase Storage bucket."
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed."
    echo ""
    echo "To install gcloud CLI:"
    echo "1. Visit: https://cloud.google.com/sdk/docs/install"
    echo "2. Follow the installation instructions for your OS"
    echo "3. Run: gcloud init"
    echo "4. Then run this script again"
    echo ""
    echo "Alternative: Use gsutil if you have it installed:"
    echo "gsutil cors set cors.json gs://moshimoshi-de237.firebasestorage.app"
    exit 1
fi

# Your Firebase Storage bucket
BUCKET="gs://moshimoshi-de237.firebasestorage.app"

echo "📋 Bucket: $BUCKET"
echo ""

# Apply CORS configuration
echo "🚀 Applying CORS configuration..."
gsutil cors set cors.json $BUCKET

if [ $? -eq 0 ]; then
    echo "✅ CORS configuration applied successfully!"
    echo ""
    echo "📌 Current CORS configuration:"
    gsutil cors get $BUCKET
    echo ""
    echo "✨ TTS audio should now work from localhost!"
else
    echo "❌ Failed to apply CORS configuration"
    echo ""
    echo "Please make sure you're authenticated with gcloud:"
    echo "gcloud auth login"
    exit 1
fi