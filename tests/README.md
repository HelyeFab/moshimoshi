# Moshimoshi Test Suite

This directory contains automated test suites for various features of the Moshimoshi application.

## Available Test Suites

### 1. Village Layout Personalization Test Suite

**File**: `village-layout-personalization.test.js`

**Purpose**: Tests the complete flow of Learning Village dashboard personalization based on user onboarding goals, including cascade invalidation when goals change.

**Coverage**: 13 tests across 5 test suites
- Fresh users with different goals
- Layout persistence
- Cascade invalidation (goal changes)
- Edge cases
- Firestore data integrity

**Run**:
```bash
node tests/village-layout-personalization.test.js
```

**Expected Output**:
```
✅ All tests passed! Village layout personalization is working correctly.

Total Tests: 13
✅ Passed: 13
❌ Failed: 0
Success Rate: 100.0%
```

**Prerequisites**:
- Firebase Admin SDK access
- Valid `moshimoshi-service-account.json` in project root
- Firestore database access

**Cleanup**: The test suite automatically creates and deletes test users, so no manual cleanup is needed.

---

## Running All Tests

To run all test suites sequentially:

```bash
cd /home/beano/DevProjects/NextJs/moshimoshi
node tests/village-layout-personalization.test.js
# Add more test suites here as they're created
```

---

## Writing New Tests

When creating new test suites, follow these patterns:

### 1. Test Structure

```javascript
class TestRunner {
  async setup() { /* Initialize */ }
  async teardown() { /* Cleanup */ }
  async test(name, testFn) { /* Run test */ }
  assertEqual(actual, expected, message) { /* Assert */ }
}
```

### 2. Test User Management

```javascript
// Create test users
const uid = await this.createTestUser('Test Name', 'test@example.com');
this.testUsers.push(uid);

// Automatically cleaned up in teardown()
```

### 3. Test Organization

Group related tests into suites:

```javascript
console.log('\n📋 Test Suite 1: Feature Name\n');

await this.test('Should do X', async () => {
  // Test implementation
});

await this.test('Should do Y', async () => {
  // Test implementation
});
```

### 4. Assertions

```javascript
// Use assertEqual for comparisons
this.assertEqual(actual, expected, 'Error message if fails');

// Throw errors for other conditions
if (!condition) {
  throw new Error('Condition not met');
}
```

---

## Test Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Always clean up test data in `teardown()`
3. **Descriptive Names**: Test names should clearly describe what they're testing
4. **Edge Cases**: Include tests for edge cases and error conditions
5. **Data Integrity**: Verify data is correctly stored in all locations
6. **Performance**: Keep tests fast (< 2 minutes for full suite)

---

## CI/CD Integration

To integrate tests into CI/CD pipeline:

```yaml
# .github/workflows/test.yml
name: Run Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm install
      - name: Run test suite
        env:
          FIREBASE_SERVICE_ACCOUNT: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
        run: node tests/village-layout-personalization.test.js
```

---

## Troubleshooting

### Tests Failing

1. **Check Firebase credentials**: Ensure `moshimoshi-service-account.json` is present
2. **Check Firestore rules**: Test users need read/write access
3. **Check quota limits**: Firebase has daily quotas for user creation
4. **Review logs**: Error messages will show which specific assertions failed

### Cleanup Issues

If test users aren't being cleaned up:

```javascript
// Manually run cleanup
const admin = require('firebase-admin');
admin.initializeApp(/* ... */);

// Delete user
await admin.auth().deleteUser(uid);
await admin.firestore().collection('users').doc(uid).delete();
```

---

## Contributing

When adding new features to Moshimoshi:

1. Write tests BEFORE implementing the feature (TDD)
2. Ensure tests cover happy path, edge cases, and error conditions
3. Run all tests before committing
4. Update this README with new test suite documentation

---

## Test Results Archive

Test results are logged but not archived. For production deployment verification, consider:

1. Running tests before each deployment
2. Saving test output to deployment logs
3. Setting up automated testing in staging environment

---

Last Updated: 2026-01-10
