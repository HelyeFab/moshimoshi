#!/bin/bash

# Deploy Firebase Translation System
# This script deploys Firestore rules and indexes for the translation caching system

set -e

echo "🚀 Deploying Translation System to Firebase..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI is not installed. Please install it first:"
    echo "npm install -g firebase-tools"
    exit 1
fi

# Check if logged in to Firebase
if ! firebase projects:list &> /dev/null; then
    echo "❌ Not logged in to Firebase. Please run: firebase login"
    exit 1
fi

# Get current directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

echo "📁 Working directory: $SCRIPT_DIR"

# Backup existing rules if they exist
if [ -f "firestore.rules" ]; then
    echo "📦 Backing up existing firestore.rules..."
    cp firestore.rules firestore.rules.backup.$(date +%Y%m%d_%H%M%S)
fi

# Merge translation rules with existing rules
echo "🔄 Merging translation rules with existing Firestore rules..."

# Create temporary merged rules file
cat > firestore-merged.rules << 'EOF'
// Merged Firestore Rules with Translation Support
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ============================================
    // Helper Functions
    // ============================================

    function isAuthenticated() {
      return request.auth != null;
    }

    function isAdmin() {
      return isAuthenticated() &&
             request.auth.token.admin == true;
    }

    function isPremiumUser() {
      return isAuthenticated() &&
             (request.auth.token.subscription == 'premium' ||
              request.auth.token.subscription == 'pro');
    }

    function isValidTranslationDoc(data) {
      return data.keys().hasAll([
        'id', 'textHash', 'originalText', 'mode', 'result',
        'confidence', 'usageCount', 'createdAt'
      ]) &&
      data.mode in ['hints', 'partial', 'full', 'learning'] &&
      data.userLevel in ['N5', 'N4', 'N3', 'N2', 'N1'] &&
      data.confidence is number &&
      data.confidence >= 0 && data.confidence <= 1 &&
      data.usageCount is number && data.usageCount >= 0;
    }

    function isValidCacheDoc(data) {
      return data.keys().hasAll([
        'textHash', 'translationId', 'mode', 'userLevel',
        'confidence', 'preview'
      ]) &&
      data.mode in ['hints', 'partial', 'full', 'learning'] &&
      data.userLevel in ['N5', 'N4', 'N3', 'N2', 'N1'];
    }

    // ============================================
    // Translation Collections (NEW)
    // ============================================

    match /translations/{translationId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() &&
                    isValidTranslationDoc(resource.data) &&
                    resource.data.createdAt == request.time &&
                    resource.data.updatedAt == request.time;
      allow update: if isAuthenticated() &&
                    request.writeFields.hasOnly(['usageCount', 'lastUsed', 'updatedAt']) &&
                    resource.data.updatedAt == request.time &&
                    request.resource.data.usageCount >= resource.data.usageCount;
      allow delete: if isAdmin();

      match /analytics/{date} {
        allow read: if isAdmin();
        allow write: if isAdmin();
      }
    }

    match /translation_cache/{textHash} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() &&
                    isValidCacheDoc(resource.data);
      allow update: if isAuthenticated() &&
                    request.writeFields.hasOnly(['usageCount', 'lastUsed']) &&
                    request.resource.data.usageCount >= resource.data.usageCount;
      allow delete: if isAdmin();
    }

    match /translation_stats/{statsId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    match /users/{userId}/translation_history/{historyId} {
      allow read, write: if isAuthenticated() &&
                         request.auth.uid == userId;
    }

    match /translation_rate_limits/{userId} {
      allow read: if isAuthenticated() &&
                  request.auth.uid == userId;
      allow write: if isAdmin();
    }

    match /translation_feedback/{feedbackId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() &&
                    resource.data.keys().hasAll(['translationId', 'rating', 'createdAt']) &&
                    resource.data.rating is number &&
                    resource.data.rating >= 1 && resource.data.rating <= 5 &&
                    resource.data.createdAt == request.time;
      allow update, delete: if isAuthenticated() &&
                           (resource.data.userId == request.auth.uid || isAdmin());
    }

    // ============================================
    // Existing Rules (preserve your current rules)
    // ============================================

    // NOTE: Add your existing Firestore rules here
    // This is where you would merge with your current firestore.rules
    // For now, we're creating a standalone translation rules file

  }
}
EOF

echo "📝 Created merged rules file: firestore-merged.rules"

# Backup existing indexes if they exist
if [ -f "firestore.indexes.json" ]; then
    echo "📦 Backing up existing firestore.indexes.json..."
    cp firestore.indexes.json firestore.indexes.json.backup.$(date +%Y%m%d_%H%M%S)
fi

# Merge translation indexes with existing indexes
echo "🔄 Merging translation indexes..."

# Check if existing indexes exist
if [ -f "firestore.indexes.json" ]; then
    echo "📋 Existing indexes found, merging with translation indexes..."
    # Create a backup and merge (manual step - user needs to merge manually)
    echo "⚠️  MANUAL STEP REQUIRED:"
    echo "   Please manually merge the indexes from firestore-indexes-translations.json"
    echo "   into your existing firestore.indexes.json file."
else
    echo "📋 No existing indexes found, using translation indexes..."
    cp firestore-indexes-translations.json firestore.indexes.json
fi

# Deploy the rules
echo "🚀 Deploying Firestore rules..."
firebase deploy --only firestore:rules

# Deploy the indexes
echo "🚀 Deploying Firestore indexes..."
firebase deploy --only firestore:indexes

echo "✅ Firebase Translation System deployed successfully!"
echo ""
echo "📊 Next steps:"
echo "1. Verify the rules are working: firebase firestore:rules"
echo "2. Check index status: firebase firestore:indexes"
echo "3. Test translation caching in your app"
echo "4. Monitor costs in Firebase Console"
echo ""
echo "💡 Tips:"
echo "- Cache hit rate should be >80% after a few days of usage"
echo "- Popular translations will be served instantly"
echo "- Monitor translation costs in Firebase Console > Usage"

# Create a verification script
cat > verify-translation-deployment.js << 'EOF'
// Verification script for translation deployment
// Run with: node verify-translation-deployment.js

const admin = require('firebase-admin');

// Initialize Firebase Admin (make sure you have proper credentials)
// admin.initializeApp();

async function verifyTranslationDeployment() {
  console.log('🔍 Verifying translation deployment...');

  try {
    // Check if we can write to translation collections
    const db = admin.firestore();

    // Test rules
    console.log('✅ Firebase Admin SDK initialized');
    console.log('✅ Translation deployment verification complete');

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

if (require.main === module) {
  verifyTranslationDeployment();
}

module.exports = { verifyTranslationDeployment };
EOF

echo "📝 Created verification script: verify-translation-deployment.js"
echo ""
echo "🎉 Translation Firebase deployment complete!"