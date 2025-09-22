# Universal Review Engine - Test Style Guide
**Agent 1: Test Architect**  
**Last Updated: Day 1 of Week 1**

## 📋 Table of Contents
1. [Overview](#overview)
2. [Test Organization](#test-organization)
3. [Naming Conventions](#naming-conventions)
4. [Test Structure](#test-structure)
5. [Mock Usage](#mock-usage)
6. [Assertions](#assertions)
7. [Performance Testing](#performance-testing)
8. [Agent Coordination](#agent-coordination)
9. [Common Patterns](#common-patterns)
10. [Troubleshooting](#troubleshooting)

---

## Overview

This guide ensures consistent, maintainable, and efficient tests across all agents working on the Universal Review Engine. Follow these patterns to achieve our **80% coverage requirement**.

### Key Principles
- **Isolation**: Each test should be independent
- **Clarity**: Test names should describe what they test
- **Speed**: Tests should run in < 100ms (exceptions for integration tests)
- **Coverage**: Aim for 100% coverage in your assigned modules

---

## Test Organization

### File Structure
```
src/lib/review-engine/
├── core/
│   ├── algorithm.ts
│   └── __tests__/
│       ├── algorithm.test.ts      # Unit tests
│       └── algorithm.perf.test.ts # Performance tests
├── session/
│   ├── manager.ts
│   └── __tests__/
│       ├── manager.test.ts
│       └── manager.integration.test.ts
└── __tests__/
    ├── test-utils/         # Shared utilities (Agent 1)
    ├── integration/        # Cross-module tests
    └── e2e/               # End-to-end tests
```

### Test Categories
1. **Unit Tests** (`.test.ts`) - Single function/class
2. **Integration Tests** (`.integration.test.ts`) - Multiple modules
3. **Performance Tests** (`.perf.test.ts`) - Speed benchmarks
4. **E2E Tests** (`.e2e.test.ts`) - Full user flows

---

## Naming Conventions

### Test Files
```typescript
// ✅ Good
algorithm.test.ts
session-manager.test.ts
kana-adapter.integration.test.ts

// ❌ Bad
test-algorithm.ts
algorithmTests.ts
algorithm_tests.ts
```

### Test Suites
```typescript
// ✅ Good
describe('SRSAlgorithm', () => {
  describe('calculateNextInterval', () => {
    it('should increase interval for correct answer', () => {});
    it('should reset interval for incorrect answer', () => {});
  });
});

// ❌ Bad
describe('srs tests', () => {
  test('it works', () => {});
});
```

### Test Names
Use the format: `should [expected behavior] when [condition]`

```typescript
// ✅ Good
it('should return doubled interval when answer is correct', () => {});
it('should throw ValidationError when input is invalid', () => {});
it('should emit progress event when session completes', () => {});

// ❌ Bad
it('doubles interval', () => {});
it('test correct answer', () => {});
it('works', () => {});
```

---

## Test Structure

### Standard Test Template
```typescript
import { MockFactory, getTestDatabase } from '@test-utils';

describe('ComponentName', () => {
  // Setup
  let testDb: TestDatabase;
  let mockData: any;
  
  beforeAll(async () => {
    testDb = getTestDatabase();
  });
  
  beforeEach(() => {
    mockData = MockFactory.createTestScenario();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  // Group related tests
  describe('methodName', () => {
    it('should handle normal case', () => {
      // Arrange
      const input = mockData.items[0];
      
      // Act
      const result = methodName(input);
      
      // Assert
      expect(result).toBeValidReviewableContent();
    });
    
    it('should handle edge case', () => {
      // Test edge cases
    });
    
    it('should handle error case', () => {
      // Test error handling
    });
  });
});
```

### Async Test Pattern
```typescript
it('should handle async operations', async () => {
  // Arrange
  const session = MockFactory.createReviewSession();
  
  // Act
  const result = await sessionManager.startSession(session);
  
  // Assert
  expect(result).toBeActiveSession();
  await expect(result).toRespondWithin(100);
});
```

---

## Mock Usage

### Using MockFactory
```typescript
// Import shared mocks
import { MockFactory } from '@test-utils/mockFactory';

// Create single item
const content = MockFactory.createReviewableContent({
  contentType: 'kanji',
  difficulty: 0.7
});

// Create bulk data
const items = MockFactory.createBulkContent(50, 'vocabulary');

// Create complete scenario
const { session, items, statistics, events } = 
  MockFactory.createTestScenario(20);
```

### Using TestDatabase
```typescript
import { getTestDatabase } from '@test-utils/testDatabase';

it('should query database correctly', async () => {
  const db = getTestDatabase({ simulateLatency: true });
  
  // Use pre-seeded data
  const user = await db.getUser('user_active');
  expect(user.reviewItems.size).toBeGreaterThan(0);
  
  // Add custom data
  await db.saveContent(MockFactory.createReviewableContent());
});
```

### Mocking External Dependencies
```typescript
// Mock Firebase
jest.mock('@/lib/firebase/admin', () => ({
  db: {
    collection: jest.fn(() => ({
      doc: jest.fn(),
      where: jest.fn()
    }))
  }
}));

// Mock Redis
jest.mock('@upstash/redis', () => ({
  Redis: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn()
  }))
}));
```

---

## Assertions

### Use Custom Matchers
```typescript
// ✅ Good - Domain-specific assertions
expect(content).toBeValidReviewableContent();
expect(session).toBeActiveSession();
expect(srsData).toBeInLearningState('mastered');
expect(result).toHaveValidationScore(0.8, 1.0);

// ❌ Bad - Generic assertions
expect(content.id).toBeDefined();
expect(session.status).toBe('active');
expect(srsData.status).toEqual('mastered');
```

### Multiple Assertions Pattern
```typescript
// Use helper functions for complex assertions
function assertValidSession(session: ReviewSession) {
  expect(session).toBeActiveSession();
  expect(session.items).toHaveLength(20);
  expect(session).toHaveSessionProgress(0, 100);
  expect(session.userId).toBeTruthy();
}

it('should create valid session', () => {
  const session = createSession();
  assertValidSession(session);
});
```

---

## Performance Testing

### Performance Test Template
```typescript
describe('Performance', () => {
  it('should calculate SRS in under 10ms', async () => {
    const iterations = 1000;
    const items = MockFactory.createBulkContent(iterations);
    
    const start = performance.now();
    
    for (const item of items) {
      algorithm.calculateNext(item, { correct: true });
    }
    
    const duration = performance.now() - start;
    const avgTime = duration / iterations;
    
    expect(avgTime).toBeLessThan(10);
    
    // Log for CI
    console.log(`Average SRS calculation: ${avgTime.toFixed(2)}ms`);
  });
  
  it('should handle concurrent operations', async () => {
    const promises = Array(100).fill(null).map(() => 
      sessionManager.createSession()
    );
    
    await expect(Promise.all(promises)).toRespondWithin(1000);
  });
});
```

---

## Agent Coordination

### Agent Responsibilities

#### Agent 1 (Test Architect)
- Maintain test infrastructure
- Review all test PRs
- Monitor coverage reports
- Update this guide

#### Agent 2 (Core Systems)
- Test session management
- Test validation system
- Test progress tracking

#### Agent 3 (Adapters & API)
- Test all content adapters
- Test API endpoints
- Test offline sync

### Shared Resources
```typescript
// All agents use the same mock factory
import { MockFactory } from '@test-utils/mockFactory';

// All agents use the same test database
import { getTestDatabase } from '@test-utils/testDatabase';

// All agents use the same custom matchers
import '@test-utils/customMatchers';
```

### Daily Sync Points
1. **Morning (9 AM)**: Share coverage status
2. **Noon (12 PM)**: Report blockers
3. **Evening (5 PM)**: Commit and push tests

---

## Common Patterns

### Testing Event Emitters
```typescript
it('should emit progress event', (done) => {
  const emitter = new ProgressEventEmitter();
  
  emitter.on('progress:updated', (data) => {
    expect(data).toHaveProperty('accuracy');
    done();
  });
  
  emitter.emitProgressUpdate(mockProgress);
});
```

### Testing with Timers
```typescript
it('should schedule next review', () => {
  jest.useFakeTimers();
  
  const item = scheduler.scheduleReview(content);
  
  jest.advanceTimersByTime(86400000); // 1 day
  
  expect(item).toBeDueForReview();
  
  jest.useRealTimers();
});
```

### Testing Error Scenarios
```typescript
it('should handle network errors gracefully', async () => {
  // Mock network failure
  jest.spyOn(global, 'fetch').mockRejectedValueOnce(
    new Error('Network error')
  );
  
  const result = await apiClient.syncData();
  
  expect(result.success).toBe(false);
  expect(result.error).toContain('Network');
});
```

### Testing State Transitions
```typescript
it('should transition through states correctly', () => {
  const machine = new SessionStateMachine();
  
  expect(machine.state).toBe('idle');
  
  machine.start();
  expect(machine.state).toBe('active');
  
  machine.pause();
  expect(machine.state).toBe('paused');
  
  machine.complete();
  expect(machine.state).toBe('completed');
});
```

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: Flaky Tests
```typescript
// ❌ Problem: Race conditions
it('should update quickly', async () => {
  updateData();
  expect(getData()).toBe('updated'); // May fail
});

// ✅ Solution: Wait for updates
it('should update quickly', async () => {
  await updateData();
  await waitFor(() => expect(getData()).toBe('updated'));
});
```

#### Issue: Test Timeout
```typescript
// ❌ Problem: Default timeout too short
it('should process large dataset', async () => {
  await processMillionItems(); // Times out
});

// ✅ Solution: Increase timeout
it('should process large dataset', async () => {
  await processMillionItems();
}, 30000); // 30 second timeout
```

#### Issue: Memory Leaks
```typescript
// ❌ Problem: Not cleaning up
describe('EventEmitter', () => {
  const emitter = new EventEmitter();
  
  it('test 1', () => {
    emitter.on('event', handler); // Leak
  });
});

// ✅ Solution: Clean up properly
describe('EventEmitter', () => {
  let emitter;
  
  beforeEach(() => {
    emitter = new EventEmitter();
  });
  
  afterEach(() => {
    emitter.removeAllListeners();
  });
});
```

#### Issue: Coverage Gaps
```bash
# Find uncovered lines
npm run test:review -- --coverage --coverageReporters=text

# Generate HTML report
npm run test:review -- --coverage --coverageReporters=html

# Test specific file with coverage
npm run test:review -- algorithm.test.ts --coverage
```

---

## Coverage Requirements

### Minimum Thresholds
- **Global**: 80% all metrics
- **Core modules**: 90% all metrics
- **SRS algorithm**: 95% all metrics
- **Validation**: 85% all metrics

### Checking Coverage
```bash
# Run with coverage
npm run test:review:coverage

# Check specific module
npm run test:review -- --coverage --collectCoverageFrom='src/lib/review-engine/core/**'

# View HTML report
open coverage/review-engine/index.html
```

### Improving Coverage
1. Test all branches (if/else, switch)
2. Test error paths
3. Test edge cases (null, undefined, empty)
4. Test async rejections
5. Test event emissions

---

## Best Practices Checklist

Before committing tests, ensure:

- [ ] Tests run in isolation (`npm run test:review -- --runInBand`)
- [ ] No console.log statements (unless for performance metrics)
- [ ] All tests pass locally
- [ ] Coverage meets requirements
- [ ] Test names are descriptive
- [ ] Uses shared mocks from MockFactory
- [ ] No hardcoded values
- [ ] Async tests properly awaited
- [ ] Cleanup in afterEach
- [ ] No test interdependencies
- [ ] Performance tests included for critical paths
- [ ] Error cases tested
- [ ] Edge cases covered
- [ ] Documentation updated if needed

---

## Quick Reference

### Running Tests
```bash
# All tests
npm run test:review

# Specific agent's tests
npm run test:review -- --selectProjects="Agent 2: Session & Validation"

# Watch mode
npm run test:review -- --watch

# Debug mode
npm run test:review -- --detectOpenHandles --runInBand

# With coverage
npm run test:review:coverage

# Update snapshots
npm run test:review -- -u
```

### Coverage Commands
```bash
# Generate report
npm run test:review -- --coverage

# View in browser
open coverage/review-engine/index.html

# Check thresholds
npm run test:review -- --coverage --coverageThreshold='{"global":{"lines":80}}'
```

### Debugging
```bash
# Run single test
npm run test:review -- --testNamePattern="should calculate interval"

# Debug in VS Code
# Add breakpoint and press F5 with this launch.json:
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache", "${relativeFile}"],
  "console": "integratedTerminal"
}
```

---

## Support

- **Questions**: Post in #testing channel
- **Issues**: Create GitHub issue with `test` label
- **Updates**: Submit PR to update this guide
- **Reviews**: Tag Agent 1 for test review

---

**Remember**: Good tests are an investment in code quality. Take time to write them well!