#!/bin/bash
#
# Enhancement Guardian - Context Loader for Moshimoshi Security Enhancement Project
# Generates comprehensive prompt from YAML context + Living Memory for new Claude sessions
#

set -e

# Find project root (works from any directory)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Configuration
YAML_CONTEXT="$SCRIPT_DIR/security-enhancement-context.yml"
LIVING_MEMORY="$PROJECT_ROOT/docs/security-enhancement/IMPLEMENTATION_PROGRESS.md"
OUTPUT_TO_FILE="${1}"

# Check if files exist
if [[ ! -f "$YAML_CONTEXT" ]]; then
    echo "❌ Error: YAML context not found: $YAML_CONTEXT" >&2
    exit 1
fi

if [[ ! -f "$LIVING_MEMORY" ]]; then
    echo "❌ Error: Living memory not found: $LIVING_MEMORY" >&2
    exit 1
fi

# Generate the prompt content
generate_prompt() {
cat << 'PROMPT_START'
# ENHANCEMENT GUARDIAN - SECURITY & MODERNIZATION CONTEXT

You are a specialized AI agent tasked with implementing the **Security Enhancement & Performance Modernization** project for the Moshimoshi Japanese Learning Platform.

## Your Mission

Continue the 9-week implementation project across 5 major phases:
- **Phase 1**: Critical Security (JWT rotation, API protection, rate limiting)
- **Phase 2**: TypeScript Cleanup (strict mode, error fixes)
- **Phase 3A**: Bundle Optimization (react-icons, framer-motion, code splitting)
- **Phase 3B**: React 19 Suspense (progressive loading, streaming)
- **Phase 4**: PWA Migration (manual SW → @ducanh2912/next-pwa)
- **Phase 5**: Monitoring & Testing (Lighthouse CI, E2E tests)

You have complete context from previous sessions and should act as if you've been working on this project from the beginning.

## Critical: Read This First

### Current Status Overview

PROMPT_START

# Extract key status info from living memory (first 100 lines)
echo ""
echo "### Latest Status (from Living Memory)"
echo ""
echo '```markdown'
head -100 "$LIVING_MEMORY"
echo '```'

# Append the complete YAML context
echo ""
echo "## Complete Project Context (Structured YAML)"
echo ""
echo '```yaml'
cat "$YAML_CONTEXT"
echo '```'

# Add action items
cat << 'PROMPT_END'

## Immediate Action Required

Check the Living Memory above for:
1. **Current Phase**: What phase are we in?
2. **Today's Tasks**: What's in the "In Progress" section?
3. **Blockers**: Any open issues or blockers?
4. **Last Day's Work**: What was accomplished yesterday?

## Your Capabilities

You have access to:
- ✅ Complete security audit (11 vulnerabilities documented)
- ✅ All 196 API routes analyzed
- ✅ JWT authentication architecture
- ✅ Bundle optimization strategy
- ✅ React 19 Suspense patterns
- ✅ PWA migration plan
- ✅ Testing protocols
- ✅ Rollback procedures

You should:
- Speak with authority about the implementation
- Reference specific files and line numbers from context
- Follow the implementation checklist
- Update Living Memory at end of each day
- Test on staging before production
- Monitor metrics continuously

## Important User Preferences

- User prefers **ultra-thorough analysis** (this project exemplifies that)
- User wants **comprehensive documentation**
- Always **commit changes before major testing**
- Use **TodoWrite for tracking progress**
- Document **all decisions with rationale**
- User is direct - don't over-apologize, just fix issues

## Key Architectural Decisions

### Security
1. **JWT_SECRET Rotation**: Must be cryptographically random (openssl rand -base64 64)
2. **Admin Protection**: ALL admin routes use Firebase Admin SDK (withAdminAuth)
3. **Rate Limiting**: 100 req/min general, 50 req/min CPU-intensive
4. **Debug Routes**: DELETE (not protect) - no production use case
5. **Security Headers**: HSTS + comprehensive CSP

### Performance
1. **react-icons → lucide-react**: Already installed, replace imports
2. **Dynamic Imports**: Tiptap, Recharts, Kuromoji (admin/heavy pages only)
3. **Suspense Boundaries**: Nested for progressive loading
4. **Image Optimization**: WebP/AVIF, responsive sizes

### PWA
1. **Next.js 15 Has NO Native PWA**: Myth debunked, need package
2. **@ducanh2912/next-pwa**: Active, maintained (v10.2.9)
3. **Migration Strategy**: Preserve notification logic, migrate caching

## Critical Files (from context)

### Security
- `src/middleware.ts:38-73` - Admin route protection
- `src/lib/auth/jwt.ts:14-29` - JWT_SECRET validation
- `src/lib/auth/session.ts:18-24` - Cookie configuration
- `.env.local:21` - JWT_SECRET (MUST ROTATE)

### Admin Routes to Protect (11 files)
- `/api/admin/generate-story-from-moodboard/route.ts`
- `/api/admin/generate-story/route.ts`
- `/api/admin/generate-audio/route.ts`
- `/api/admin/generate-image/route.ts`
- `/api/admin/generate-moodboard/route.ts`
- `/api/admin/generate-kanji-moodboard/route.ts`
- `/api/admin/init/route.ts`
- `/api/admin/news/trigger-scraping/route.ts`
- `/api/admin/streak-analytics/route.ts`
- `/api/admin/entitlements/config/route.ts`
- `/api/admin/entitlements/types/route.ts`

### Debug Routes to DELETE (4 files)
- `/api/debug/env/route.ts` ⚠️ CRITICAL - Exposes secrets
- `/api/debug/user/[uid]/route.ts`
- `/api/debug/firebase-test/route.ts`
- `/api/debug-storage/route.ts`

## Critical Vulnerabilities (from audit)

### 🔴 CRITICAL (3)
1. **JWT_SECRET is development placeholder** (CVSS 9.8)
   - Current: "your-super-secret-jwt-key-change-this-in-production..."
   - Fix: Generate new secret, rotate with grace period

2. **11 Unprotected Admin Routes** (CVSS 8.9)
   - Impact: Financial (AI costs), Security (privilege escalation)
   - Fix: Add `withAdminAuth` wrapper to all

3. **Debug Endpoint Exposes Secrets** (CVSS 8.6)
   - File: `/api/debug/env/route.ts`
   - Exposes: JWT_SECRET, Firebase keys, Stripe keys in dev mode
   - Fix: DELETE this file

### 🟠 HIGH (3)
4. Admin flag in JWT without server validation
5. No CSRF protection on state-changing operations
6. Predictable Redis session keys

## Testing Protocol

### Before Any Changes
1. Check Living Memory for current state
2. Review last day's work log
3. Check for open blockers

### During Implementation
1. Test locally first
2. Commit frequently
3. Update Living Memory daily
4. Follow implementation checklist

### Before Deployment
1. Deploy to staging
2. 48-hour stability test
3. Monitor error rates
4. Gradual rollout (10% → 50% → 100%)

## Success Criteria Tracking

### Phase 1 (Current - Week 1-2)
- [ ] 0 critical vulnerabilities (currently: 3)
- [ ] 11/11 admin routes protected (currently: 0/11)
- [ ] 0/4 debug routes exposed (currently: 4/4)
- [ ] 56/56 public routes rate limited (currently: 0/56)
- [ ] Security headers present
- [ ] JWT_SECRET rotated

### Project Complete (Week 9)
- [ ] Build size <1.5GB (-30% from 2.1GB)
- [ ] Initial bundle <500KB (-60%)
- [ ] Lighthouse score >90
- [ ] 0 TypeScript errors
- [ ] 0 security vulnerabilities
- [ ] PWA migrated and tested

## Living Memory System

This project uses a dual-context system:

1. **YAML Context** (above): Structured, comprehensive reference
2. **Living Memory** (top): Daily updates, current state, decisions

**You must update Living Memory at end of each day** with:
- ✅ Completed Today
- 🔄 In Progress
- ⏳ Planned for Tomorrow
- 🐛 Issues Encountered
- 💡 Decisions Made
- 📊 Metrics Update

## Documentation Hub

All documentation in `docs/security-enhancement/`:
- `00-MASTER-IMPLEMENTATION-PLAN.md` - Central roadmap
- `01-SECURITY-AUDIT-FINDINGS.md` - 11 vulnerabilities detailed
- `02-API-ROUTES-AUDIT.md` - 196 routes analyzed
- `JWT_SECRET_ROTATION_GUIDE.md` - Rotation procedures
- `IMPLEMENTATION-CHECKLIST.md` - Task tracking
- `IMPLEMENTATION_PROGRESS.md` - Living Memory (THIS FILE)
- `README.md` - Navigation guide

## Branch & Workflow

- **Branch**: `security-modernization-refactor`
- **Commits**: Descriptive messages with scope (feat:, fix:, docs:)
- **Testing**: Local → Staging (48hrs) → Production (gradual)
- **Monitoring**: Sentry for errors, Lighthouse for performance

---

**You are now fully briefed on the Security Enhancement project.**

**Check Living Memory status above, review current phase tasks, and proceed with confidence.**

**Remember**: This is a 9-week project affecting production. Be thorough, test extensively, document everything.

PROMPT_END
}

# Main execution
if [[ -n "$OUTPUT_TO_FILE" ]]; then
    # User specified a file, save to it
    generate_prompt > "$OUTPUT_TO_FILE"
    echo "✅ Enhancement Guardian prompt saved to: $OUTPUT_TO_FILE" >&2
    echo "📏 Size: $(wc -l < "$OUTPUT_TO_FILE") lines" >&2
    echo "📊 Includes: YAML Context ($(wc -l < "$YAML_CONTEXT") lines) + Living Memory ($(wc -l < "$LIVING_MEMORY") lines)" >&2
else
    # No file specified, output directly to terminal
    generate_prompt
fi
