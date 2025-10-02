# Security Audit Checklist - Gamification System
**Date**: YYYY-MM-DD
**Auditor**: Agent C (Observability & Release)
**Scope**: /api/stats/unified and gamification endpoints
**Status**: 🔄 In Progress

---

## Audit Objectives

Verify that security controls are properly enforced before production rollout:
1. JWT and session validation on all endpoints
2. Tier-based rate limiting enforcement
3. Client write blocking (server-only writes)
4. Audit logs capturing denied requests
5. No PII in application logs

---

## 1. JWT Validation ✅

### Test 1.1: Missing JWT Token
**Endpoint**: `POST /api/stats/unified`
**Test**: Send request without Authorization header
**Expected**: `401 Unauthorized`

```bash
curl -X POST https://staging.moshimoshi.app/api/stats/unified \
  -H "Content-Type: application/json" \
  -d '{"type":"xp","data":{"amount":10,"source":"test"}}'
```

**Result**: ⬜ Pass / ⬜ Fail
**Evidence**: [Screenshot/log]
**Notes**:

---

### Test 1.2: Invalid JWT Token
**Endpoint**: `POST /api/stats/unified`
**Test**: Send request with malformed JWT
**Expected**: `401 Unauthorized`

```bash
curl -X POST https://staging.moshimoshi.app/api/stats/unified \
  -H "Authorization: Bearer invalid.token.here" \
  -H "Content-Type: application/json" \
  -d '{"type":"xp","data":{"amount":10,"source":"test"}}'
```

**Result**: ⬜ Pass / ⬜ Fail
**Evidence**: [Screenshot/log]
**Notes**:

---

### Test 1.3: Expired JWT Token
**Endpoint**: `POST /api/stats/unified`
**Test**: Send request with expired token
**Expected**: `401 Unauthorized`

```bash
# Generate expired token or use known expired token
curl -X POST https://staging.moshimoshi.app/api/stats/unified \
  -H "Authorization: Bearer <EXPIRED_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"type":"xp","data":{"amount":10,"source":"test"}}'
```

**Result**: ⬜ Pass / ⬜ Fail
**Evidence**: [Screenshot/log]
**Notes**:

---

## 2. Session Validation ✅

### Test 2.1: Missing Session
**Endpoint**: `POST /api/stats/unified`
**Test**: Valid JWT but no session cookie
**Expected**: `401 Unauthorized` or session created

```bash
curl -X POST https://staging.moshimoshi.app/api/stats/unified \
  -H "Authorization: Bearer <VALID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"type":"xp","data":{"amount":10,"source":"test"}}'
```

**Result**: ⬜ Pass / ⬜ Fail
**Evidence**: [Screenshot/log]
**Notes**:

---

### Test 2.2: Session Hijacking Attempt
**Endpoint**: `POST /api/stats/unified`
**Test**: User A's token trying to modify User B's stats
**Expected**: `403 Forbidden`

```bash
# Use User A's token, try to update User B's stats
curl -X POST https://staging.moshimoshi.app/api/stats/unified \
  -H "Authorization: Bearer <USER_A_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"type":"xp","data":{"amount":10,"source":"test"},"userId":"<USER_B_ID>"}'
```

**Result**: ⬜ Pass / ⬜ Fail
**Evidence**: [Screenshot/log]
**Notes**:

---

## 3. Tier-Based Rate Limiting ✅

### Test 3.1: Free Tier Rate Limit (100 req/hr)
**Endpoint**: `POST /api/stats/unified`
**Test**: Send 101 requests in 1 hour from free user
**Expected**: 101st request returns `429 Too Many Requests`

```bash
# Script to send 101 requests
for i in {1..101}; do
  curl -X POST https://staging.moshimoshi.app/api/stats/unified \
    -H "Authorization: Bearer <FREE_USER_TOKEN>" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"xp\",\"data\":{\"amount\":10,\"source\":\"test_$i\"},\"idempotencyKey\":\"test_$i\"}"

  if [ $i -eq 101 ]; then
    echo "Request 101 should be rate limited"
  fi
done
```

**Result**: ⬜ Pass / ⬜ Fail
**Evidence**: [Screenshot showing 429 response]
**Actual Limit Hit**: [Number of requests before 429]
**Notes**:

---

### Test 3.2: Premium Tier Rate Limit (500 req/hr)
**Endpoint**: `POST /api/stats/unified`
**Test**: Send 501 requests in 1 hour from premium user
**Expected**: 501st request returns `429 Too Many Requests`

**Result**: ⬜ Pass / ⬜ Fail
**Evidence**: [Screenshot]
**Notes**:

---

### Test 3.3: Admin Tier High Limit (10,000 req/hr)
**Endpoint**: `POST /api/stats/unified`
**Test**: Verify admin users have significantly higher limits
**Expected**: Can make 1000+ requests without 429

**Result**: ⬜ Pass / ⬜ Fail
**Evidence**: [Screenshot]
**Notes**:

---

### Test 3.4: Rate Limit Headers
**Endpoint**: `POST /api/stats/unified`
**Test**: Verify rate limit headers present in response
**Expected**: Headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

```bash
curl -i -X POST https://staging.moshimoshi.app/api/stats/unified \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"type":"xp","data":{"amount":10,"source":"test"}}'
```

**Result**: ⬜ Pass / ⬜ Fail
**Evidence**: [Screenshot showing headers]
**Notes**:

---

## 4. Client Write Blocking ✅

### Test 4.1: Direct Firebase Write Attempt
**Test**: Attempt to write directly to Firestore `user_stats` collection from client
**Expected**: Permission denied (Firebase rules block client writes)

```javascript
// In browser console on app
const firestore = getFirestore()
const userStatsRef = doc(firestore, 'user_stats', 'test-user-123')
await setDoc(userStatsRef, { xp: { total: 9999 } })
// Should fail with "Missing or insufficient permissions"
```

**Result**: ⬜ Pass / ⬜ Fail
**Evidence**: [Screenshot of console error]
**Notes**:

---

### Test 4.2: localStorage Write Detection (CI)
**Test**: CI detects forbidden localStorage writes in stats stores
**Expected**: CI job "forbidden-client-writes" fails

**Test File**: Create branch with this code in `src/stores/achievement-store.ts`:
```typescript
// Intentionally add forbidden write
localStorage.setItem('test_stats', JSON.stringify({ xp: 100 }))
```

Push and verify CI fails.

**Result**: ⬜ Pass / ⬜ Fail
**Evidence**: [Link to failed CI run]
**Notes**:

---

### Test 4.3: Verify Unified API is Only Write Path
**Test**: Grep codebase for any non-API writes to stats
**Expected**: Only `/api/stats/unified` modifies user stats

```bash
# Search for direct Firebase writes outside API routes
grep -rn "adminDb.*set\|adminDb.*update" src/ --include="*.ts" --include="*.tsx" | grep -v "/api/"

# Should return empty or only allowed cases
```

**Result**: ⬜ Pass / ⬜ Fail
**Evidence**: [Command output]
**Notes**:

---

## 5. Audit Logs ✅

### Test 5.1: Unauthorized Access Logged
**Test**: Make unauthorized request, verify it's logged
**Expected**: Log entry with `metricType: api_error`, `error: unauthorized`

```bash
# Make unauthorized request
curl -X POST https://staging.moshimoshi.app/api/stats/unified \
  -H "Content-Type: application/json" \
  -d '{"type":"xp","data":{"amount":10}}'

# Check logs
# Should see entry: { service: "gamification", metricType: "api_error", error: "unauthorized" }
```

**Result**: ⬜ Pass / ⬜ Fail
**Evidence**: [Log entry screenshot]
**Notes**:

---

### Test 5.2: Rate Limit Exceeded Logged
**Test**: Trigger rate limit, verify it's logged
**Expected**: Log entry with `metricType: api_error`, `error: rate_limit_exceeded`

**Result**: ⬜ Pass / ⬜ Fail
**Evidence**: [Log entry screenshot]
**Notes**:

---

### Test 5.3: Invalid Tier Access Logged
**Test**: Free user attempts premium-only operation
**Expected**: Log entry with `metricType: api_error`, `error: insufficient_tier`

**Result**: ⬜ Pass / ⬜ Fail
**Evidence**: [Log entry screenshot]
**Notes**:

---

### Test 5.4: Correlation IDs Present
**Test**: Verify all log entries include correlation IDs for tracing
**Expected**: Each log entry has `correlationId` field

**Result**: ⬜ Pass / ⬜ Fail
**Evidence**: [Log samples showing correlation IDs]
**Notes**:

---

## 6. PII Protection ✅

### Test 6.1: No Email Addresses in Logs
**Test**: Search application logs for email patterns
**Expected**: No email addresses found

```bash
# Search logs for email pattern
grep -E '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' logs/application.log

# Should return empty
```

**Result**: ⬜ Pass / ⬜ Fail
**Evidence**: [Command output]
**Notes**:

---

### Test 6.2: User IDs Hashed/Masked
**Test**: Verify sensitive user data is not logged in plaintext
**Expected**: User IDs are hashed or only partial IDs shown

**Result**: ⬜ Pass / ⬜ Fail
**Evidence**: [Log samples]
**Notes**:

---

### Test 6.3: No Auth Tokens in Logs
**Test**: Verify JWT tokens are never logged
**Expected**: No "Bearer" tokens in logs

```bash
# Search for "Bearer" in logs
grep -i "Bearer" logs/application.log

# Should return empty
```

**Result**: ⬜ Pass / ⬜ Fail
**Evidence**: [Command output]
**Notes**:

---

## Summary

### Checklist
- [ ] 1.1: Missing JWT - Rejected ✅
- [ ] 1.2: Invalid JWT - Rejected ✅
- [ ] 1.3: Expired JWT - Rejected ✅
- [ ] 2.1: Missing Session - Handled ✅
- [ ] 2.2: Session Hijacking - Blocked ✅
- [ ] 3.1: Free Tier Rate Limit - Enforced ✅
- [ ] 3.2: Premium Tier Rate Limit - Enforced ✅
- [ ] 3.3: Admin Tier Limit - Verified ✅
- [ ] 3.4: Rate Limit Headers - Present ✅
- [ ] 4.1: Firebase Direct Write - Blocked ✅
- [ ] 4.2: CI Write Detection - Working ✅
- [ ] 4.3: Unified API Only - Verified ✅
- [ ] 5.1: Unauthorized Logged - Confirmed ✅
- [ ] 5.2: Rate Limit Logged - Confirmed ✅
- [ ] 5.3: Tier Access Logged - Confirmed ✅
- [ ] 5.4: Correlation IDs - Present ✅
- [ ] 6.1: No Emails in Logs - Verified ✅
- [ ] 6.2: User IDs Masked - Verified ✅
- [ ] 6.3: No Tokens in Logs - Verified ✅

### Overall Status
**Tests Passed**: X / 19
**Tests Failed**: X / 19
**Compliance**: ⬜ PASS / ⬜ FAIL

---

## Findings & Recommendations

### Critical Issues (P0)
*List any security vulnerabilities that must be fixed before production*

### High Priority Issues (P1)
*List security concerns that should be addressed soon*

### Medium Priority Issues (P2)
*List security improvements for future consideration*

### Positive Findings
*List security controls that are working well*

---

## Next Steps

1. [ ] Fix any P0 issues immediately
2. [ ] Schedule P1 fixes before production rollout
3. [ ] Document P2 items in backlog
4. [ ] Update QA Matrix with security audit results
5. [ ] Package evidence for Supervisor review

---

**Audit Completed**: YYYY-MM-DD HH:MM UTC
**Sign-off**: Agent C (Observability & Release)
**Status**: ${allPassed ? '✅ APPROVED FOR PRODUCTION' : '❌ REQUIRES FIXES'}
