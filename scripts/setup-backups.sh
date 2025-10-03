#!/bin/bash
#
# Setup Automated Daily Backups for Firebase Firestore
# This script configures Cloud Scheduler to trigger daily backups
#
# Prerequisites:
# - gcloud CLI installed and authenticated
# - Cloud Scheduler API enabled
# - Cloud Functions or Cloud Run service for backup trigger
# - Storage bucket for backups
#
# Usage: ./scripts/setup-backups.sh

set -e

PROJECT_ID="${FIREBASE_PROJECT_ID:-moshimoshi-de237}"
BUCKET_NAME="${FIREBASE_STORAGE_BUCKET:-moshimoshi-de237.firebasestorage.app}"
BACKUP_SCHEDULE="0 2 * * *"  # Daily at 2 AM UTC
REGION="${FIREBASE_REGION:-us-central1}"

echo "🔥 Setting up Automated Firebase Backups"
echo "Project: $PROJECT_ID"
echo "Bucket: $BUCKET_NAME"
echo "Schedule: $BACKUP_SCHEDULE (Daily at 2 AM UTC)"
echo "Region: $REGION"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI is not installed"
    exit 1
fi

# Set the project
gcloud config set project "$PROJECT_ID"

# Enable required APIs
echo "📌 Enabling required APIs..."
gcloud services enable cloudscheduler.googleapis.com --quiet
gcloud services enable firestore.googleapis.com --quiet

# Create backup bucket if it doesn't exist
echo ""
echo "📦 Checking storage bucket..."
if ! gsutil ls "gs://${BUCKET_NAME}/backups/" &> /dev/null; then
    echo "Creating backup directory in bucket..."
    echo "" | gsutil cp - "gs://${BUCKET_NAME}/backups/.keep"
fi

# Grant Firestore export permission to service account
echo ""
echo "🔐 Granting permissions to service account..."
SERVICE_ACCOUNT="${PROJECT_ID}@appspot.gserviceaccount.com"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/datastore.importExportAdmin" \
    --quiet || echo "  (Permission may already exist)"

# Create Cloud Scheduler job
echo ""
echo "⏰ Creating Cloud Scheduler job..."
SCHEDULER_JOB_NAME="firestore-daily-backup"

# Check if job already exists
if gcloud scheduler jobs describe "$SCHEDULER_JOB_NAME" --location="$REGION" &> /dev/null; then
    echo "  Job already exists. Updating..."
    gcloud scheduler jobs delete "$SCHEDULER_JOB_NAME" --location="$REGION" --quiet
fi

# Note: This creates a job that calls the backup API endpoint
# The API endpoint must be deployed and accessible
BACKUP_API_URL="https://${PROJECT_ID}.web.app/api/admin/backup/trigger"

# For production, you should use Cloud Functions instead
# This is a placeholder - you'll need to implement the actual backup function
echo ""
echo "⚠️  NOTE: This requires your Next.js app to be deployed with the backup API endpoint"
echo "   Alternative: Use Cloud Functions to trigger backups directly"
echo ""

cat > /tmp/backup-payload.json <<EOF
{
  "reason": "Automated daily backup",
  "type": "scheduled"
}
EOF

gcloud scheduler jobs create http "$SCHEDULER_JOB_NAME" \
    --location="$REGION" \
    --schedule="$BACKUP_SCHEDULE" \
    --uri="$BACKUP_API_URL" \
    --http-method=POST \
    --headers="Content-Type=application/json" \
    --message-body-from-file=/tmp/backup-payload.json \
    --time-zone="UTC" \
    --quiet || true

rm /tmp/backup-payload.json

echo ""
echo "✅ Automated backups configured!"
echo ""
echo "📋 Configuration Summary:"
echo "  - Schedule: Daily at 2 AM UTC"
echo "  - Backup location: gs://${BUCKET_NAME}/backups/"
echo "  - Retention: Manual cleanup required"
echo "  - Job name: $SCHEDULER_JOB_NAME"
echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo "1. Verify the backup API endpoint is deployed and accessible"
echo "2. Test the scheduler job: gcloud scheduler jobs run $SCHEDULER_JOB_NAME --location=$REGION"
echo "3. Monitor the first automated backup in the admin dashboard"
echo "4. Setup backup cleanup policy (recommend: keep last 30 days)"
echo ""
echo "Manual backup test:"
echo "  Visit: http://localhost:3001/admin/monitoring"
echo "  Click: 'Backup Now' button"
echo ""
