#!/bin/bash
#
# Enable Point-in-Time Recovery (PITR) for Firebase Firestore
# This script enables PITR which allows restoring the database to any point in the last 7 days
#
# Prerequisites:
# - gcloud CLI installed and authenticated
# - Permission: roles/datastore.owner or roles/owner on the Firebase project
#
# Usage: ./scripts/enable-pitr.sh

set -e

PROJECT_ID="${FIREBASE_PROJECT_ID:-moshimoshi-de237}"
DATABASE_ID="(default)"

echo "🔥 Enabling Point-in-Time Recovery for Firebase Firestore"
echo "Project: $PROJECT_ID"
echo "Database: $DATABASE_ID"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI is not installed"
    echo "Install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q "."; then
    echo "❌ Error: Not authenticated with gcloud"
    echo "Run: gcloud auth login"
    exit 1
fi

# Set the project
echo "📌 Setting project to $PROJECT_ID..."
gcloud config set project "$PROJECT_ID"

# Enable PITR
echo ""
echo "⚡ Enabling Point-in-Time Recovery..."
echo "This will:"
echo "  - Enable 7-day retention for database recovery"
echo "  - Allow restoring to any point in time within the last 7 days"
echo "  - Increase storage costs by ~25%"
echo ""

read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Aborted"
    exit 1
fi

gcloud firestore databases update \
    --type=firestore-native \
    --enable-pitr

echo ""
echo "✅ Point-in-Time Recovery enabled successfully!"
echo ""
echo "📋 PITR Details:"
echo "  - Retention: 7 days"
echo "  - Earliest restore point: Now"
echo "  - Cost increase: ~25% of storage costs"
echo ""
echo "⚠️  IMPORTANT: It may take a few minutes for PITR to become fully active"
echo ""
echo "Next steps:"
echo "1. ✅ PITR is now enabled"
echo "2. ⏭️  Setup automated daily backups: ./scripts/setup-backups.sh"
echo "3. ⏭️  Test backup functionality from admin dashboard"
echo ""
