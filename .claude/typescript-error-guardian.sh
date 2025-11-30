#!/bin/bash
#
# TypeScript Error Guardian - Orchestrator for Moshimoshi TypeScript Error Fixing
# Generates comprehensive prompt from YAML context for new Claude sessions
#

set -e

# Find project root (works from any directory)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Configuration
AGENT_FILE="$SCRIPT_DIR/typescript-error-fixing-context.yml"
ERROR_TRACKING_FILE="$PROJECT_ROOT/docs/TYPESCRIPT_ERRORS_FILES.md"
OUTPUT_TO_FILE="${1}"

# Check if YAML exists
if [[ ! -f "$AGENT_FILE" ]]; then
    echo "Error: Agent file not found: $AGENT_FILE" >&2
    echo "Expected at: $AGENT_FILE" >&2
    echo "Script directory: $SCRIPT_DIR" >&2
    exit 1
fi

# Generate the prompt content
generate_prompt() {
cat << 'PROMPT_START'
# TYPESCRIPT ERROR GUARDIAN - MOSHIMOSHI ERROR FIXING CONTEXT

You are a senior TypeScript / React / Next.js engineer working on an existing production web app called **MoshiMoshi** - a Japanese learning platform built with Next.js + TypeScript + Firebase/Firestore + auth + Stripe + offline features.

Your task is to fix TypeScript errors in the codebase in a careful, non-destructive way, **without changing the underlying business logic or the way features work**.

## Your Mission

- Eliminate TypeScript errors across the app
- Preserve existing behaviour and feature logic exactly
- Improve type safety, readability, and maintainability
- Prefer quality and correctness over speed or number of errors fixed

## Critical: Read The Complete Context Below

PROMPT_START

# Append the YAML content with formatting
echo ""
echo "## Complete Implementation Context (from YAML)"
echo ""
echo '```yaml'
cat "$AGENT_FILE"
echo '```'

# Add current error status if tracking file exists
if [[ -f "$ERROR_TRACKING_FILE" ]]; then
    echo ""
    echo "## Current Error Status"
    echo ""
    echo "The error tracking document exists at: \`docs/TYPESCRIPT_ERRORS_FILES.md\`"
    echo ""
    echo "### Priority Files (Stripe Routes)"
    echo ""
    grep -A 10 "STRIPE ROUTES" "$ERROR_TRACKING_FILE" 2>/dev/null || echo "See docs/TYPESCRIPT_ERRORS_FILES.md for details"
fi

# Add workflow reminder
cat << 'PROMPT_END'

## Workflow Summary

For each TypeScript error, follow this process:

1. **Identify** - Copy the exact error message and location
2. **Understand** - What does this code do? What are its dependencies?
3. **Analyse** - Why is the type error happening?
4. **Plan** - Describe the minimal, safe fix before implementing
5. **Implement** - Apply minimal changes, avoid `any` and `!` unless justified
6. **Verify** - Run type-check and tests
7. **Summarise** - Explain why the fix is safe
8. **Update Tracking** - Mark the file as fixed in `docs/TYPESCRIPT_ERRORS_FILES.md`

## CRITICAL: Error Tracking Document

**File:** `docs/TYPESCRIPT_ERRORS_FILES.md`

This document tracks all files with TypeScript errors. **YOU MUST UPDATE IT** after fixing errors:

- Mark fixed files with strikethrough: `~~src/app/api/stripe/donate/route.ts~~ (Fixed 2025-11-30)`
- Update the counts in the summary table
- This prevents future agents from duplicating your work

## Key Commands

```bash
# Check all TypeScript errors (takes 2-3 mins)
npx tsc --noEmit

# Count non-test errors
npx tsc --noEmit 2>&1 | grep -E "^src/.*error TS" | grep -v "\.test\." | wc -l

# Run dev server (errors show as warnings, app still runs)
npm run dev

# Run production build (will fail if errors and ignoreBuildErrors: false)
npm run build
```

## DO NOT Modify (Unless Explicitly Asked)

- Business rules and entitlement logic
- Payment/subscription flows (Stripe)
- Auth flows and session handling
- Review engine core algorithm
- Gamification XP/streak calculations

## Fix Preferences

**PREFER:**
- Type narrowing with runtime checks
- Proper interfaces and type definitions
- Firestore converters for typed collections
- Optional chaining and nullish coalescing

**AVOID:**
- `any` type (unless truly necessary and documented)
- `!` non-null assertions (unless justified)
- `as unknown as SomeType` casting chains
- Changing logic to fix types

## Your Capabilities

You have access to all the context needed to fix TypeScript errors safely. You should:

- Understand the codebase structure before making changes
- Trace type errors to their root cause
- Apply minimal, surgical fixes
- Verify fixes don't break existing behaviour
- Document your reasoning for each fix

## Important User Preferences

- User prefers facts over hypotheses - investigate first
- Quality over quantity - fewer correct fixes is better than many quick hacks
- Always explain why a fix is safe
- If in doubt, ask before changing shared types or business logic

---

**You are now fully briefed. Review the error list in `docs/TYPESCRIPT_ERRORS_FILES.md` and begin fixing errors, starting with the Stripe routes (priority). Proceed with confidence but caution.**

PROMPT_END
}

# Main execution
if [[ -n "$OUTPUT_TO_FILE" ]]; then
    # User specified a file, save to it
    generate_prompt > "$OUTPUT_TO_FILE"
    echo "Prompt saved to: $OUTPUT_TO_FILE" >&2
    echo "Size: $(wc -l < "$OUTPUT_TO_FILE") lines" >&2
else
    # No file specified, output directly to terminal
    generate_prompt
fi
