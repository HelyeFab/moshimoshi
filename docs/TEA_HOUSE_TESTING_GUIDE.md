# Tea House Q&A - Emulator Testing Guide

This guide shows you how to test the Tea House Q&A functions (voting and moderation) using Firebase Emulators locally.

## 🎯 What This Tests

1. **Concurrent Vote Counting** - Verifies that 100+ simultaneous votes are counted accurately without race conditions
2. **AI Content Moderation** - Tests that questions are moderated automatically (requires API key)
3. **Vote Toggle Behavior** - Ensures vote changes (up→down, remove) work correctly

## 🚀 Quick Start

### Step 1: Build the Functions

```bash
cd functions
npm run build
cd ..
```

### Step 2: Start Firebase Emulators

```bash
firebase emulators:start
```

You should see output like:
```
✔ functions[us-central1-moderateQuestion]: http function initialized
✔ functions[us-central1-onQuestionVoteCreated]: firestore function initialized
...
✔ All emulators ready!
```

### Step 3: Run the Load Tests

**In a new terminal:**

```bash
node scripts/test-qa-emulator.js
```

## 📊 Expected Output

```
╔════════════════════════════════════════╗
║  Tea House Q&A - Emulator Load Tests  ║
╚════════════════════════════════════════╝

Configuration:
  - Concurrent votes: 100
  - Concurrent questions: 10
  - Wait time: 8000ms
  - Firestore: localhost:8080

========================================
TEST 1: Concurrent Vote Counting
========================================

Step 1: Creating test question...
✓ Test question created

Step 2: Creating 100 concurrent votes...
Creating votes [████████████████████] 100% (100/100)
✓ 100 votes created in 234ms

Step 3: Waiting 8000ms for functions to process...
✓ Wait complete

Step 4: Verifying vote counts...
Expected: { upvotes: 50, downvotes: 50 }
Actual:   { upvotes: 50, downvotes: 50 }

✓✓✓ TEST PASSED - Vote counting is 100% accurate!

========================================
TEST 2: Concurrent Question Moderation
========================================

... (moderation tests)

========================================
TEST 3: Vote Toggle Behavior
========================================

... (toggle tests)

========================================
TEST SUMMARY
========================================

Test 1 - Concurrent Voting:    PASSED
Test 2 - Moderation:            PARTIAL
Test 3 - Vote Toggle:           PASSED

🎉 ALL TESTS PASSED! Your Tea House Q&A functions are production-ready.
```

## 🔧 Configuration

Edit `scripts/test-qa-emulator.js` to adjust test parameters:

```javascript
const TEST_CONFIG = {
  CONCURRENT_VOTES: 100,      // Number of concurrent votes (increase for stress test)
  CONCURRENT_QUESTIONS: 10,   // Number of questions to moderate simultaneously
  WAIT_TIME: 8000,           // Wait time for functions (increase if tests fail)
};
```

## 🐛 Troubleshooting

### Issue: "FIRESTORE_EMULATOR_HOST not set"

**Solution:** Make sure emulators are running first:
```bash
firebase emulators:start
```

### Issue: Test 2 shows "All questions still pending"

**Reason:** AI moderation requires the `MODAL_API_KEY` secret, which isn't configured in emulators.

**This is expected!** The test validates the function triggers correctly. To test full moderation:
1. Deploy to a test project with the secret configured, OR
2. Mock the AI response in the test script

### Issue: Vote counts don't match

**Possible causes:**
1. Functions not processing fast enough - increase `WAIT_TIME`
2. Race condition in Cloud Function code (this shouldn't happen with the new config)
3. Emulator not running all function instances

**Debug:**
- Check emulator logs for errors
- Increase wait time to 15000ms (15 seconds)
- Verify functions built successfully (`cd functions && npm run build`)

### Issue: Functions not triggering

**Check:**
```bash
# Verify functions are loaded
curl http://localhost:4000  # Opens emulator UI

# Check function logs in emulator UI under "Logs" tab
```

## 📈 Performance Benchmarks

With the new concurrency limits, you should see:

| Metric | Target | Typical Result |
|--------|--------|----------------|
| Vote creation time (100 votes) | <500ms | ~200-300ms |
| Vote processing accuracy | 100% | 100% |
| Cold start (first vote) | <1s | ~100-200ms (minInstances=2) |
| Subsequent votes | <50ms | ~20-40ms |

## 🚀 Advanced Testing

### Stress Test (1000 concurrent votes)

```javascript
// Edit scripts/test-qa-emulator.js
const TEST_CONFIG = {
  CONCURRENT_VOTES: 1000,  // ⚠️ Stress test!
  CONCURRENT_QUESTIONS: 50,
  WAIT_TIME: 15000,        // Increase wait time
};
```

Then run:
```bash
node scripts/test-qa-emulator.js
```

### Monitor Function Performance

While tests run, check the emulator UI:
```
http://localhost:4000
```

Navigate to:
- **Logs** - See function execution logs
- **Firestore** - View data being created in real-time

## 📝 CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Test Firebase Functions
  run: |
    firebase emulators:exec --only functions,firestore "node scripts/test-qa-emulator.js"
```

## 🔒 Security Note

The test script uses the emulator with `projectId: 'demo-moshimoshi'`. This is safe and isolated - no real data is affected.

## 📚 What Each Test Validates

### Test 1: Concurrent Vote Counting
**What it tests:**
- Creates 100 votes simultaneously (50 upvotes, 50 downvotes)
- Verifies Cloud Functions count all votes correctly
- Detects race conditions in vote counting logic

**Why it matters:**
- If votes are lost, users will see incorrect vote counts
- Race conditions can cause data inconsistency
- This validates the Firestore transaction logic

### Test 2: Concurrent Moderation
**What it tests:**
- Creates 10 questions that need moderation
- Verifies moderation functions trigger correctly
- Checks that AI moderation API is called (if configured)

**Why it matters:**
- Ensures spam/inappropriate content is filtered
- Validates the moderation pipeline works at scale
- Tests that concurrent moderations don't conflict

### Test 3: Vote Toggle
**What it tests:**
- Upvote → verify count increases
- Change to downvote → verify old count decreases, new increases
- Remove vote → verify count decreases

**Why it matters:**
- Users can change their votes - this must work correctly
- Tests the delete triggers work as expected
- Validates vote removal doesn't cause negative counts

## 🎓 Understanding the Results

### 100% Accuracy ✅
All votes counted correctly. Functions are production-ready!

### 95-99% Accuracy ⚠️
Likely a race condition. Increase `maxInstances` or check transaction logic.

### <95% Accuracy ❌
Serious issue! Check:
1. Functions deployed correctly
2. Firestore rules allow writes
3. No errors in function logs

## 🔗 Related Documentation

- [Firebase Emulators Docs](https://firebase.google.com/docs/emulator-suite)
- [Firestore Transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Cloud Functions Testing](https://firebase.google.com/docs/functions/unit-testing)
- [Tea House Expert Report](/docs/tea-house-expert-report.md)

---

**Questions or Issues?**
Check the emulator logs and function code at:
- `/functions/src/qa-voting.ts` - Vote counting functions
- `/functions/src/qa-moderation.ts` - Moderation functions
