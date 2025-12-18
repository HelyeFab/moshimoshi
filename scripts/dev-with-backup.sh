#!/bin/bash

# dev-with-backup.sh
# Runs the dev server and backs up .env.local when it stops

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="/home/beano/Life-Org/SecondBrain/Moshimoshi/Git"
ENV_FILE="$PROJECT_ROOT/.env.local"
LOG_FILE="$PROJECT_ROOT/backup.log"

# Function to backup .env.local with timestamp
backup_env() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Backup function called" >> "$LOG_FILE"

    if [ -f "$ENV_FILE" ]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') - ENV_FILE exists: $ENV_FILE" >> "$LOG_FILE"

        # Create backup directory if it doesn't exist
        mkdir -p "$BACKUP_DIR"
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Created backup dir: $BACKUP_DIR" >> "$LOG_FILE"

        # Create timestamped backup as .md file so Obsidian shows it
        TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')
        BACKUP_FILE="$BACKUP_DIR/env-local-$TIMESTAMP.md"

        # Copy the file
        cp "$ENV_FILE" "$BACKUP_FILE"
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Copied to: $BACKUP_FILE" >> "$LOG_FILE"

        # Also update the main env-local.md (without timestamp)
        cp "$ENV_FILE" "$BACKUP_DIR/env-local.md"
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Updated: $BACKUP_DIR/env-local.md" >> "$LOG_FILE"

        echo "" >> "$LOG_FILE"
        echo "✅ Backed up .env.local"
    else
        echo "$(date '+%Y-%m-%d %H:%M:%S') - ENV_FILE not found: $ENV_FILE" >> "$LOG_FILE"
        echo "⚠️  .env.local not found"
    fi
}

# Trap EXIT signal to backup when script ends (including Ctrl+C)
trap backup_env EXIT

# Run the dev server (the original concurrently command)
cd "$PROJECT_ROOT"
concurrently "next dev" "npm run notebooklm:watch"
