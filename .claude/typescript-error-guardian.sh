#!/bin/bash
#
# TypeScript Error Guardian - Dynamic Bash Version
# Generates comprehensive prompt with LIVE error counts and session progress
#

set -e

# Find project root (works from any directory)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Configuration
AGENT_FILE="$SCRIPT_DIR/typescript-error-fixing-context.yml"
ERROR_TRACKING_FILE="$PROJECT_ROOT/docs/TYPESCRIPT_ERRORS_FILES.md"
SESSION_LOG_FILE="$SCRIPT_DIR/typescript-session-log.json"

# Parse arguments
SKIP_TSC=false
OUTPUT_FILE=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-tsc) SKIP_TSC=true; shift ;;
        --output) OUTPUT_FILE="$2"; shift 2 ;;
        *) OUTPUT_FILE="$1"; shift ;;
    esac
done

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

get_live_error_count() {
    echo "Running TypeScript compiler (this may take 2-3 minutes)..." >&2

    local start_time=$(date +%s)
    local tsc_output=$(npx tsc --noEmit 2>&1 || true)
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    # Count errors (excluding test files)
    local total_errors=$(echo "$tsc_output" | grep -E "^src/.*error TS" | grep -v "\.test\." | grep -v "\.spec\." | grep -v "__tests__" | wc -l | tr -d ' ')

    # Get unique files with errors
    local file_count=$(echo "$tsc_output" | grep -E "^src/.*error TS" | grep -v "\.test\." | sed 's/(.*//' | sort -u | wc -l | tr -d ' ')

    # Get top 10 files by error count
    local top_files=$(echo "$tsc_output" | grep -E "^src/.*error TS" | grep -v "\.test\." | sed 's/(.*//' | sort | uniq -c | sort -rn | head -10)

    echo "Completed in ${duration}s" >&2

    # Return as JSON-like format
    echo "{\"totalErrors\": $total_errors, \"fileCount\": $file_count, \"duration\": $duration, \"timestamp\": \"$(date '+%Y-%m-%d %H:%M:%S')\"}"
    echo "TOP_FILES:$top_files"
}

get_fixed_files_from_tracking() {
    if [[ ! -f "$ERROR_TRACKING_FILE" ]]; then
        echo "0"
        return
    fi

    # Count rows in the Fixed Files table (lines matching | `file` | date | notes |)
    local count=$(grep -E '^\|\s*`[^`]+`\s*\|\s*[0-9]{4}-[0-9]{2}-[0-9]{2}\s*\|' "$ERROR_TRACKING_FILE" | wc -l | tr -d ' ')
    echo "$count"
}

get_today_fixes() {
    local today=$(date '+%Y-%m-%d')
    if [[ ! -f "$ERROR_TRACKING_FILE" ]]; then
        echo "0"
        return
    fi
    grep -E "^\|\s*\`[^\`]+\`\s*\|\s*$today\s*\|" "$ERROR_TRACKING_FILE" | wc -l | tr -d ' '
}

get_yesterday_fixes() {
    local yesterday=$(date -d "yesterday" '+%Y-%m-%d' 2>/dev/null || date -v-1d '+%Y-%m-%d' 2>/dev/null || echo "")
    if [[ -z "$yesterday" ]] || [[ ! -f "$ERROR_TRACKING_FILE" ]]; then
        echo "0"
        return
    fi
    grep -E "^\|\s*\`[^\`]+\`\s*\|\s*$yesterday\s*\|" "$ERROR_TRACKING_FILE" | wc -l | tr -d ' '
}

get_week_fixes() {
    if [[ ! -f "$ERROR_TRACKING_FILE" ]]; then
        echo "0"
        return
    fi
    # Get dates from last 7 days and count matches
    local count=0
    for i in {0..6}; do
        local check_date=$(date -d "-$i days" '+%Y-%m-%d' 2>/dev/null || date -v-${i}d '+%Y-%m-%d' 2>/dev/null || continue)
        local day_count=$(grep -E "^\|\s*\`[^\`]+\`\s*\|\s*$check_date\s*\|" "$ERROR_TRACKING_FILE" | wc -l | tr -d ' ')
        count=$((count + day_count))
    done
    echo "$count"
}

get_recent_fix_list() {
    local date_filter="$1"
    local limit="${2:-10}"
    if [[ ! -f "$ERROR_TRACKING_FILE" ]]; then
        return
    fi
    grep -E "^\|\s*\`[^\`]+\`\s*\|\s*$date_filter\s*\|" "$ERROR_TRACKING_FILE" | head -n "$limit" | while read -r line; do
        local file=$(echo "$line" | sed -E 's/.*`([^`]+)`.*/\1/')
        local notes=$(echo "$line" | sed -E 's/.*\|[^|]*\|[^|]*\|\s*([^|]*)\s*\|.*/\1/' | xargs)
        echo "- \`$file\` - $notes"
    done
}

save_session_log() {
    local errors="$1"
    local files="$2"
    local fixed="$3"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    # Create or update session log (simple append, keep last 20)
    local temp_log=$(mktemp)
    echo "{\"timestamp\": \"$timestamp\", \"errors\": $errors, \"files\": $files, \"fixed\": $fixed}" >> "$SESSION_LOG_FILE"

    # Keep only last 20 entries
    tail -20 "$SESSION_LOG_FILE" > "$temp_log" && mv "$temp_log" "$SESSION_LOG_FILE"
}

get_previous_session() {
    if [[ -f "$SESSION_LOG_FILE" ]] && [[ $(wc -l < "$SESSION_LOG_FILE") -ge 2 ]]; then
        tail -2 "$SESSION_LOG_FILE" | head -1
    fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

# Check prerequisites
if [[ ! -f "$AGENT_FILE" ]]; then
    echo "Error: Agent file not found: $AGENT_FILE" >&2
    exit 1
fi

echo "" >&2
echo "========================================" >&2
echo "  TypeScript Error Guardian (Dynamic)" >&2
echo "========================================" >&2
echo "" >&2

# Get statistics
FIXED_COUNT=$(get_fixed_files_from_tracking)
TODAY_FIXES=$(get_today_fixes)
YESTERDAY_FIXES=$(get_yesterday_fixes)
WEEK_FIXES=$(get_week_fixes)
TOTAL_ESTIMATED=340
PROGRESS_PERCENT=$((FIXED_COUNT * 100 / TOTAL_ESTIMATED))

# Get live error count unless skipped
ERROR_DATA=""
TOTAL_ERRORS="?"
FILE_COUNT="?"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
MODE="Live Analysis"
TOP_FILES_DATA=""

if [[ "$SKIP_TSC" == "false" ]]; then
    ERROR_OUTPUT=$(get_live_error_count)
    ERROR_DATA=$(echo "$ERROR_OUTPUT" | head -1)
    TOP_FILES_DATA=$(echo "$ERROR_OUTPUT" | grep "^TOP_FILES:" | sed 's/^TOP_FILES://')

    TOTAL_ERRORS=$(echo "$ERROR_DATA" | grep -oP '"totalErrors":\s*\K[0-9]+' || echo "?")
    FILE_COUNT=$(echo "$ERROR_DATA" | grep -oP '"fileCount":\s*\K[0-9]+' || echo "?")

    # Save session
    save_session_log "$TOTAL_ERRORS" "$FILE_COUNT" "$FIXED_COUNT"
else
    MODE="Cached Data"
    echo "Skipping tsc (use without --skip-tsc for live data)" >&2
fi

# Get previous session for trend
PREV_SESSION=$(get_previous_session)
TREND_INFO=""
if [[ -n "$PREV_SESSION" ]]; then
    PREV_ERRORS=$(echo "$PREV_SESSION" | grep -oP '"errors":\s*\K[0-9]+' || echo "")
    PREV_FIXED=$(echo "$PREV_SESSION" | grep -oP '"fixed":\s*\K[0-9]+' || echo "")
    PREV_TIME=$(echo "$PREV_SESSION" | grep -oP '"timestamp":\s*"\K[^"]+' || echo "")
    if [[ -n "$PREV_ERRORS" ]] && [[ "$TOTAL_ERRORS" != "?" ]]; then
        ERROR_DELTA=$((TOTAL_ERRORS - PREV_ERRORS))
        FIXED_DELTA=$((FIXED_COUNT - PREV_FIXED))
        if [[ $ERROR_DELTA -lt 0 ]]; then
            TREND_ICON="📉"
        elif [[ $ERROR_DELTA -gt 0 ]]; then
            TREND_ICON="📈"
        else
            TREND_ICON="➡️"
        fi
        TREND_INFO="### Trend Since Last Session ($PREV_TIME)
- Errors: $TREND_ICON $ERROR_DELTA ($TOTAL_ERRORS now)
- Fixed Files: +$FIXED_DELTA new"
    fi
fi

# ============================================================================
# GENERATE DYNAMIC PROMPT
# ============================================================================

generate_prompt() {
cat << PROMPT_HEADER
# TYPESCRIPT ERROR GUARDIAN - DYNAMIC SESSION CONTEXT

**Generated:** $TIMESTAMP
**Mode:** $MODE

---

## 📊 LIVE ERROR STATUS

| Metric | Value |
|--------|-------|
| **Total Errors** | $TOTAL_ERRORS |
| **Files with Errors** | $FILE_COUNT |
| **Files Fixed** | $FIXED_COUNT |
| **Progress** | $PROGRESS_PERCENT% complete |
| **Last Scan** | $TIMESTAMP |

$TREND_INFO

## 🕐 RECENT SESSION PROGRESS

PROMPT_HEADER

# Today's fixes
if [[ $TODAY_FIXES -gt 0 ]]; then
    echo "### Fixed Today ($TODAY_FIXES files)"
    get_recent_fix_list "$(date '+%Y-%m-%d')" 10
    if [[ $TODAY_FIXES -gt 10 ]]; then
        echo "- ...and $((TODAY_FIXES - 10)) more"
    fi
    echo ""
fi

# Yesterday's fixes
if [[ $YESTERDAY_FIXES -gt 0 ]]; then
    local yesterday=$(date -d "yesterday" '+%Y-%m-%d' 2>/dev/null || date -v-1d '+%Y-%m-%d' 2>/dev/null)
    echo "### Fixed Yesterday ($YESTERDAY_FIXES files)"
    get_recent_fix_list "$yesterday" 5
    if [[ $YESTERDAY_FIXES -gt 5 ]]; then
        echo "- ...and $((YESTERDAY_FIXES - 5)) more"
    fi
    echo ""
fi

cat << PROMPT_PROGRESS
### Overall Progress
- **Total Fixed:** $FIXED_COUNT / ~$TOTAL_ESTIMATED files
- **This Week:** $WEEK_FIXES files fixed
- **Remaining:** ~$((TOTAL_ESTIMATED - FIXED_COUNT)) files

PROMPT_PROGRESS

# Top files with errors (suggestions)
if [[ -n "$TOP_FILES_DATA" ]]; then
    echo "## 🎯 SUGGESTED NEXT FILES (most errors)"
    echo ""
    echo "| Errors | File |"
    echo "|--------|------|"
    echo "$TOP_FILES_DATA" | head -5 | while read -r count file; do
        echo "| $count | \`$file\` |"
    done
    echo ""
fi

cat << 'PROMPT_CONTEXT'
---

## 📋 COMPLETE IMPLEMENTATION CONTEXT

You are a senior TypeScript / React / Next.js engineer working on **MoshiMoshi** - a Japanese learning platform.

Your task is to fix TypeScript errors **without changing business logic**.

### Project Tech Stack
- Next.js 15.5.2, TypeScript, Firebase/Firestore
- Auth: Firebase Auth + Custom JWT Sessions
- Payments: Stripe
- State: Zustand + React Query
- Offline: IndexedDB + Service Workers

### Workflow Per Error

1. **Identify** - Copy the exact error message and location
2. **Understand** - What does this code do? Dependencies?
3. **Analyse** - Why is the type error happening?
4. **Plan** - Describe the minimal, safe fix
5. **Implement** - Apply changes, avoid `any` and `!`
6. **Verify** - Run `npx tsc --noEmit`
7. **Summarise** - Explain why the fix is safe
8. **Update Tracking** - Mark file fixed in `docs/TYPESCRIPT_ERRORS_FILES.md`

### Fix Preferences

**PREFER:**
- Type narrowing with runtime checks
- Proper interfaces and type definitions
- Optional chaining (`?.`) and nullish coalescing (`??`)
- Firestore converters for typed collections

**AVOID:**
- `any` type (unless documented)
- `!` non-null assertions (unless justified)
- `as unknown as T` casting chains
- Changing logic to fix types

### DO NOT Modify (Unless Asked)
- Business rules and entitlement logic
- Payment/subscription flows (Stripe)
- Auth flows and session handling
- Review engine core algorithm
- Gamification XP/streak calculations

### Key Commands

```bash
# Full type check (2-3 min)
npx tsc --noEmit

# Count non-test errors
npx tsc --noEmit 2>&1 | grep -E "^src/.*error TS" | grep -v "\.test\." | wc -l

# Dev server (errors = warnings)
npm run dev
```

### Error Tracking Document

**CRITICAL:** After fixing any file, update `docs/TYPESCRIPT_ERRORS_FILES.md`:

1. Add to the "Fixed Files" table:
   `| `src/path/to/file.ts` | YYYY-MM-DD | Brief description |`

2. Update category counts in the Summary table

This prevents future sessions from duplicating work!

---

## 🎬 SESSION START

**You are now fully briefed with live data.**

1. Review the "Suggested Next Files" above
2. Or pick from `docs/TYPESCRIPT_ERRORS_FILES.md`
3. Fix errors following the workflow
4. Update the tracking document after each file
5. Commit frequently with descriptive messages

**Proceed with confidence!**
PROMPT_CONTEXT
}

# ============================================================================
# OUTPUT
# ============================================================================

if [[ -n "$OUTPUT_FILE" ]]; then
    generate_prompt > "$OUTPUT_FILE"
    echo "Prompt saved to: $OUTPUT_FILE" >&2
    echo "Lines: $(wc -l < "$OUTPUT_FILE")" >&2
else
    generate_prompt
fi

echo "" >&2
echo "========================================" >&2
echo "  Guardian Ready - $FIXED_COUNT files fixed so far" >&2
echo "========================================" >&2
echo "" >&2
