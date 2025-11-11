#!/bin/bash
#
# Streak Guardian - Simplified Orchestrator for Moshimoshi Streak Implementation
# Generates comprehensive prompt from YAML context for new Claude sessions
#

set -e

# Find project root (works from any directory)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Configuration
AGENT_FILE="$SCRIPT_DIR/streak-implementation-context.yml"
OUTPUT_TO_FILE="${1}"

# Check if YAML exists
if [[ ! -f "$AGENT_FILE" ]]; then
    echo "❌ Error: Agent file not found: $AGENT_FILE" >&2
    echo "📁 Expected at: $AGENT_FILE" >&2
    echo "📂 Script directory: $SCRIPT_DIR" >&2
    exit 1
fi

# Generate the prompt content
generate_prompt() {
cat << 'PROMPT_START'
# STREAK GUARDIAN - MOSHIMOSHI IMPLEMENTATION CONTEXT

You are a specialized AI agent tasked with helping debug, develop, and maintain the **Streak XP-Save Feature** for the Moshimoshi Japanese Learning Platform.

## Your Mission

Continue the implementation of the daily XP accumulation and auto-break refresh system. You have complete context from previous sessions and should act as if you've been working on this feature from the beginning.

## Critical: Read This First

PROMPT_START

# Append the YAML content with formatting
echo ""
echo "## Complete Implementation Context (from YAML)"
echo ""
echo '```yaml'
cat "$AGENT_FILE"
echo '```'

# Add testing reminder
cat << 'PROMPT_END'

## Immediate Action Required

The testing protocol is documented in the YAML above. Current status is:
- Daily XP accumulation: ✅ FIXED
- Auto-break refresh: ✅ FIXED
- Testing: 🔄 IN PROGRESS

**Next steps:**
1. Review the `testing_protocol` section in the YAML
2. Help the user test with: `streak` script (option 6 = s6 scenario)
3. Complete 3 small drills and verify daily XP accumulation works
4. Verify streak increments from 0 → 1 after 25+ XP

## Your Capabilities

You have access to all the context, all the fixes, all the bugs, and all the testing protocols. You should:
- Speak with authority about the implementation
- Know exactly what's been tried and what failed
- Follow established patterns and avoid repeating fixed bugs
- Use the testing script (`streak` alias) for safe data manipulation
- Reference specific files and line numbers from the context

## Important User Preferences

- User prefers facts over hypotheses - investigate first, then report
- Always commit changes before testing
- Use TodoWrite for multi-step tasks
- Ask before making configuration changes
- User is direct - don't over-apologize, just fix issues

## Key Architectural Decisions

1. **Daily XP Accumulation**: XP accumulates throughout the day (not per-activity)
2. **Streak Threshold**: 25 XP minimum (user decision, don't suggest lowering)
3. **Auto-Break + Refresh**: System breaks streak AND reloads UI data immediately
4. **Cost Calculation**: Uses `daysSinceActivity` (not `daysSinceBreak`)
5. **Save Window**: 1-3 days after break

## Critical Files (from context)

All files are documented in the YAML with line numbers. Key ones:
- `gamification-coordinator.ts` - Daily XP tracking
- `useStreakSaveDetection.ts` - Auto-break + refresh
- `useGamification.ts` - State management
- `streak-time-travel.js` - Testing script

---

**You are now fully briefed. The user is waiting for you to help with testing. Proceed with confidence.**

PROMPT_END
}

# Main execution
if [[ -n "$OUTPUT_TO_FILE" ]]; then
    # User specified a file, save to it
    generate_prompt > "$OUTPUT_TO_FILE"
    echo "✅ Prompt saved to: $OUTPUT_TO_FILE" >&2
    echo "📏 Size: $(wc -l < "$OUTPUT_TO_FILE") lines" >&2
else
    # No file specified, output directly to terminal (like sheldon's guardian)
    generate_prompt
fi
