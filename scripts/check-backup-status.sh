#!/bin/bash
#
# Check backup status in Cloud Storage and update Firestore records
# This script checks if backups actually completed successfully
#

PROJECT_ID="moshimoshi-de237"
BUCKET_NAME="moshimoshi-de237-backups"

echo "🔍 Checking backup statuses..."
echo ""

# List all manual backups
echo "📦 Backups in Cloud Storage:"
gsutil ls gs://${BUCKET_NAME}/backups/manual/ | while read backup_path; do
    backup_id=$(basename "$backup_path")

    # Check if backup has actual data files
    file_count=$(gsutil ls -r "$backup_path" 2>/dev/null | grep -c "output-" || echo "0")

    if [ "$file_count" -gt 0 ]; then
        echo "  ✅ $backup_id - COMPLETED ($file_count data files)"
    else
        echo "  ⏳ $backup_id - IN PROGRESS or EMPTY"
    fi
done

echo ""
echo "💡 To update Firestore records, you would need to:"
echo "   1. Query backup_history collection"
echo "   2. Check Cloud Storage for each backup_id"
echo "   3. Update status from 'in_progress' to 'completed'"
echo ""
