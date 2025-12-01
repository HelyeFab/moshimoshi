#!/bin/bash
#
# Stripe Guardian - Dynamic Orchestrator for Moshimoshi Stripe Integration
# Generates comprehensive prompt from YAML context for new Claude sessions
# Optionally runs health checks and tracks session history
#

set -e

# Find project root (works from any directory)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Configuration
AGENT_FILE="$SCRIPT_DIR/stripe-implementation-context.yml"
SESSION_LOG_FILE="$SCRIPT_DIR/stripe-session-log.json"

# Parse arguments
SKIP_HEALTH=false
OUTPUT_FILE=""
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-health) SKIP_HEALTH=true; shift ;;
        --verbose) VERBOSE=true; shift ;;
        --output) OUTPUT_FILE="$2"; shift 2 ;;
        -h|--help)
            echo "Stripe Guardian - Knowledge Transfer for Claude Sessions"
            echo ""
            echo "Usage: $0 [OPTIONS] [output-file]"
            echo ""
            echo "Options:"
            echo "  --skip-health    Skip Stripe health check"
            echo "  --verbose        Show detailed output"
            echo "  --output FILE    Save prompt to file"
            echo "  -h, --help       Show this help"
            echo ""
            echo "Examples:"
            echo "  $0                    # Output prompt to terminal"
            echo "  $0 --output prompt.md # Save to file"
            echo "  $0 --skip-health      # Skip API checks"
            exit 0
            ;;
        *) OUTPUT_FILE="$1"; shift ;;
    esac
done

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

log_verbose() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo "$1" >&2
    fi
}

check_stripe_health() {
    log_verbose "Checking Stripe configuration..."

    local health_status="unknown"
    local has_secret_key="false"
    local has_webhook_secret="false"
    local key_mode="unknown"

    # Check for Stripe secret key
    if [[ -n "${STRIPE_SECRET_KEY:-}" ]]; then
        has_secret_key="true"
        if [[ "$STRIPE_SECRET_KEY" == sk_test_* ]]; then
            key_mode="test"
        elif [[ "$STRIPE_SECRET_KEY" == sk_live_* ]]; then
            key_mode="production"
        fi
    fi

    # Check for webhook secret
    if [[ -n "${STRIPE_WEBHOOK_SECRET:-}" ]]; then
        has_webhook_secret="true"
    fi

    # Determine overall health
    if [[ "$has_secret_key" == "true" ]]; then
        health_status="healthy"
    else
        health_status="no_key"
    fi

    echo "{\"status\": \"$health_status\", \"hasSecretKey\": $has_secret_key, \"hasWebhookSecret\": $has_webhook_secret, \"keyMode\": \"$key_mode\"}"
}

get_recent_session_updates() {
    if [[ -f "$AGENT_FILE" ]]; then
        # Extract session_updates section (last 5 entries)
        grep -A 100 "^session_updates:" "$AGENT_FILE" | grep "^  - date:" | tail -5 | while read -r line; do
            echo "$line"
        done
    fi
}

count_critical_files() {
    if [[ -f "$AGENT_FILE" ]]; then
        grep -E "^\s+- path:" "$AGENT_FILE" | wc -l | tr -d ' '
    else
        echo "0"
    fi
}

count_bugs_fixed() {
    if [[ -f "$AGENT_FILE" ]]; then
        grep -E "^\s+- id: \"BUG-" "$AGENT_FILE" | wc -l | tr -d ' '
    else
        echo "0"
    fi
}

count_webhook_events() {
    if [[ -f "$AGENT_FILE" ]]; then
        grep -E "^\s+- event:" "$AGENT_FILE" | wc -l | tr -d ' '
    else
        echo "0"
    fi
}

save_session_log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local action="$1"

    # Append to session log (keep last 20 entries)
    echo "{\"timestamp\": \"$timestamp\", \"action\": \"$action\"}" >> "$SESSION_LOG_FILE"

    # Keep only last 20 entries
    if [[ -f "$SESSION_LOG_FILE" ]]; then
        tail -20 "$SESSION_LOG_FILE" > "${SESSION_LOG_FILE}.tmp" && mv "${SESSION_LOG_FILE}.tmp" "$SESSION_LOG_FILE"
    fi
}

get_last_session() {
    if [[ -f "$SESSION_LOG_FILE" ]]; then
        tail -1 "$SESSION_LOG_FILE" 2>/dev/null || echo ""
    fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

# Check prerequisites
if [[ ! -f "$AGENT_FILE" ]]; then
    echo "Error: Agent file not found: $AGENT_FILE" >&2
    echo "Expected at: $AGENT_FILE" >&2
    exit 1
fi

echo "" >&2
echo "========================================" >&2
echo "  Stripe Guardian (Dynamic)" >&2
echo "========================================" >&2
echo "" >&2

# Gather statistics
CRITICAL_FILES=$(count_critical_files)
BUGS_FIXED=$(count_bugs_fixed)
WEBHOOK_EVENTS=$(count_webhook_events)
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Check health if not skipped
HEALTH_DATA=""
HEALTH_STATUS="skipped"
KEY_MODE="unknown"

if [[ "$SKIP_HEALTH" == "false" ]]; then
    log_verbose "Running health checks..."
    HEALTH_DATA=$(check_stripe_health)
    HEALTH_STATUS=$(echo "$HEALTH_DATA" | grep -oP '"status":\s*"\K[^"]+' || echo "unknown")
    KEY_MODE=$(echo "$HEALTH_DATA" | grep -oP '"keyMode":\s*"\K[^"]+' || echo "unknown")
fi

# Get last session info
LAST_SESSION=$(get_last_session)
LAST_SESSION_TIME=""
if [[ -n "$LAST_SESSION" ]]; then
    LAST_SESSION_TIME=$(echo "$LAST_SESSION" | grep -oP '"timestamp":\s*"\K[^"]+' || echo "")
fi

# Save this session
save_session_log "guardian_invoked"

# ============================================================================
# GENERATE DYNAMIC PROMPT
# ============================================================================

generate_prompt() {
cat << PROMPT_HEADER
# STRIPE GUARDIAN - MOSHIMOSHI INTEGRATION CONTEXT

**Generated:** $TIMESTAMP
**Stripe Mode:** $KEY_MODE
**Health Status:** $HEALTH_STATUS

---

## Your Mission

You are a specialized AI agent with **complete knowledge** of the Moshimoshi Stripe integration.
You understand every file, every data flow, every security consideration, and every architectural decision.

Act as if you built this system from the ground up. You have access to the complete implementation
context from previous sessions and should proceed with absolute confidence.

---

## Quick Reference

| Metric | Value |
|--------|-------|
| **Critical Files Documented** | $CRITICAL_FILES |
| **Known Bugs Fixed** | $BUGS_FIXED |
| **Webhook Events Handled** | $WEBHOOK_EVENTS |
| **Last Guardian Run** | ${LAST_SESSION_TIME:-"First run"} |
| **API Version** | 2025-08-27.basil |
| **Production Status** | READY |

---

## Architecture at a Glance

\`\`\`
[User Browser] --> [Next.js API Routes] --> [Stripe API]
                                       |
                                       v
[Stripe Dashboard] --> [Webhooks] --> [Firebase Functions]
                                       |
                                       v
                                   [Firestore]
                                       |
                                       v
                              [Cache Invalidation]
                                       |
                                       v
                              [User Sees Update]
\`\`\`

### Key Layers

1. **Frontend Library** (\`src/lib/stripe/\`)
   - \`server.ts\` - Stripe client singleton
   - \`types.ts\` - TypeScript definitions
   - \`mapping.ts\` - Price ID ↔ Plan conversion
   - \`api.ts\` - Client-side API wrapper

2. **API Routes** (\`src/app/api/stripe/\` & \`src/app/api/admin/\`)
   - User routes: checkout, portal, invoices, donate
   - Admin routes: test-checkout, test-renewal, test-cancel, cleanup, health

3. **Backend Functions** (\`functions/src/\`)
   - \`webhook.ts\` - Main webhook handler
   - \`handlers/\` - checkout, subscriptions, invoices
   - \`firestore.ts\` - Data persistence (810 lines)

---

## Critical Implementation Details

### Price IDs (MEMORIZE THESE)

| Plan | Test Mode | Production Mode |
|------|-----------|-----------------|
| Monthly (£8.99) | \`price_1S6wG7HdrJomitOw5YvQ71DD\` | \`price_1S6vKuHdrJomitOw4XuExllV\` |
| Yearly (£99.99) | \`price_1S6wGGHdrJomitOwcmT2JeUG\` | \`price_1S6vMBHdrJomitOwweaSGhYp\` |
| Easter Egg (£0) | \`price_1SEXlIHdrJomitOw956pZB3q\` | Same |

### Firestore Schema

\`\`\`
/users/{uid}/subscription
  ├── plan: 'free' | 'premium_monthly' | 'premium_yearly'
  ├── status: 'active' | 'incomplete' | 'past_due' | 'canceled' | 'trialing'
  ├── stripeCustomerId: string
  ├── stripeSubscriptionId: string
  ├── stripePriceId: string
  ├── currentPeriodEnd: Timestamp
  └── cancelAtPeriodEnd: boolean

/stripe/byUid/uidToCustomer/{uid} -> {customerId}
/stripe/byCustomer/customerToUid/{customerId} -> {uid}
/ops/stripe/processed_events/{eventId} -> {ts, ttl}
/logs/stripe/events/{auto-id} -> {eventId, type, ...}
\`\`\`

### Webhook Event Routing

\`\`\`typescript
switch (event.type) {
  case 'checkout.session.completed':     -> applyCheckoutCompleted()
  case 'customer.subscription.created':
  case 'customer.subscription.updated':
  case 'customer.subscription.deleted':  -> applySubscriptionEvent()
  case 'invoice.payment_succeeded':
  case 'invoice.payment_failed':         -> applyInvoiceEvent()
}
\`\`\`

---

## Security Checklist

- [x] Webhook signature verification (\`stripe.webhooks.constructEvent\`)
- [x] Admin authorization (Firestore \`isAdmin\` check)
- [x] Session-based auth (Redis JWT, not Firebase tokens)
- [x] Secrets in Google Secret Manager
- [x] Idempotency via processed_events collection
- [x] Customer existence verification before use

---

## Known Fixes (DON'T REPEAT THESE BUGS)

1. **BUG-001**: Duplicate event processing
   - Solution: Check \`wasProcessed(eventId)\` before handling

2. **BUG-002**: Session staleness after subscription change
   - Solution: \`invalidateAllUserCaches()\` after every webhook

3. **BUG-003**: Admin upgrade using wrong plan
   - Solution: Use \`toPlan(subscription.items.data[0].price.id)\`

4. **BUG-004**: Customer deleted in Stripe but mapped in Firestore
   - Solution: Verify customer with \`stripe.customers.retrieve()\`

5. **BUG-005**: API version mismatch
   - Solution: Standardized to \`2025-08-27.basil\` everywhere

---

## Admin Testing Suite

Test complete flows in production without spending money:

1. **Health Check**: \`GET /api/admin/stripe/health\`
2. **Test Checkout**: \`POST /api/admin/stripe/test-checkout\` (£0.00 subscription)
3. **Test Renewal**: \`POST /api/admin/stripe/test-renewal\` (triggers invoice webhook)
4. **Test Cancel**: \`POST /api/admin/stripe/test-cancel\` (triggers deletion webhook)
5. **Cleanup**: \`POST /api/admin/stripe/cleanup\` (reset to free tier)

---

## Complete Implementation Context

PROMPT_HEADER

# Append the YAML content
echo ""
echo '```yaml'
cat "$AGENT_FILE"
echo '```'

# Add session guidance
cat << 'PROMPT_FOOTER'

---

## Session Guidelines

### Your Capabilities

You have access to ALL context from the YAML above:
- Complete file paths with line numbers
- All webhook events and their handlers
- Firestore schema with field types
- Security implementations
- Known bugs and their fixes
- Admin testing procedures
- Performance characteristics

### DO NOT:

- Change business logic without explicit request
- Modify webhook signature verification
- Alter idempotency implementation
- Update price IDs without Stripe dashboard changes
- Skip cache invalidation after subscription changes
- Use Firebase tokens instead of session auth

### DO:

- Reference specific files and line numbers
- Check the "bugs_fixed" section before making changes
- Use the admin testing suite for verification
- Update the "session_updates" section in the YAML after major changes
- Commit frequently with descriptive messages

### User Preferences

- Prefers facts over hypotheses - investigate first
- Always commit before testing
- Use TodoWrite for multi-step tasks
- Ask before configuration changes
- Be direct - don't over-apologize

---

## Session Start

**You are now the Stripe integration expert.**

1. Review any specific request from the user
2. Reference the YAML context for implementation details
3. Make changes following established patterns
4. Test using admin endpoints or local dev
5. Update session_updates in the YAML if you discover something new

**Proceed with confidence!**

PROMPT_FOOTER
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
echo "  Guardian Ready" >&2
echo "  - $CRITICAL_FILES critical files documented" >&2
echo "  - $BUGS_FIXED known bugs fixed" >&2
echo "  - $WEBHOOK_EVENTS webhook events handled" >&2
echo "========================================" >&2
echo "" >&2
