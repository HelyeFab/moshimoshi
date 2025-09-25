#!/bin/bash

# Script to sync main branch changes to time-machine branch
# while preserving TimeMachine functionality

set -e  # Exit on error

echo "🔄 Syncing main branch to time-machine branch..."

# Save current branch
CURRENT_BRANCH=$(git branch --show-current)

# Ensure we have latest main
echo "📥 Fetching latest main..."
git checkout main
git pull origin main 2>/dev/null || true  # Pull if remote exists

# Switch to time-machine branch
echo "🕐 Switching to time-machine branch..."
git checkout time-machine

# Merge main into time-machine
echo "🔀 Merging main into time-machine..."
if git merge main --no-edit -m "Sync with main branch"; then
    echo "✅ Merge successful!"

    # Ensure TimeMachine is still enabled after merge
    echo "🔧 Verifying TimeMachine is enabled..."

    # Check if TimeMachine modifications are intact
    if ! grep -q "TimeMachineButton" src/app/layout.tsx; then
        echo "⚠️  TimeMachine was removed during merge, re-enabling..."

        # Re-apply TimeMachine changes
        sed -i '' '/@\/components\/layout\/Navbar/a\
import TimeMachineButton from "@/components/dev/TimeMachineButton"' src/app/layout.tsx

        sed -i '' '/<Navbar user={user} showUserMenu={true} \/>/a\
        <TimeMachineButton \/>' src/app/layout.tsx
    fi

    # Ensure dateProvider uses virtualClock
    if ! grep -q "virtualClock" src/lib/time/dateProvider.ts; then
        echo "⚠️  dateProvider not using virtualClock, fixing..."
        cat > src/lib/time/dateProvider.ts << 'EOF'
/**
 * Date Provider - Central abstraction for date/time operations
 *
 * This module provides a single source of truth for getting the current time
 * throughout the application. In production, it uses real time. In development,
 * it can use the virtual clock for time travel testing.
 */

import { virtualClock } from './virtualClock'

/**
 * Interface for date provider functions
 */
export interface DateProvider {
  now: () => number
  nowDate: () => Date
}

/**
 * Time Machine enabled date provider
 * Uses virtualClock for time travel testing
 */
export const dateProvider: DateProvider = {
  now: () => virtualClock.now(),
  nowDate: () => virtualClock.nowDate()
}

// Export convenience functions
export const now = dateProvider.now
export const nowDate = dateProvider.nowDate
EOF
    fi

    # Commit the verification changes if any were made
    if ! git diff --quiet; then
        echo "📝 Committing TimeMachine preservation..."
        git add -A
        git commit -m "Preserve TimeMachine functionality after merge"
    fi

    echo "✅ Time-machine branch is now synced with main!"
    echo "   TimeMachine remains enabled for testing."

else
    echo "❌ Merge failed! Please resolve conflicts manually."
    echo "   After resolving, ensure TimeMachine remains enabled."
    exit 1
fi

# Return to original branch
echo "↩️  Returning to $CURRENT_BRANCH..."
git checkout "$CURRENT_BRANCH"

echo "✨ Sync complete!"
echo ""
echo "📌 Quick branch switching:"
echo "   • Work in main:        git checkout main"
echo "   • Test with time:      git checkout time-machine"
echo "   • Sync again:          ./sync-time-machine.sh"