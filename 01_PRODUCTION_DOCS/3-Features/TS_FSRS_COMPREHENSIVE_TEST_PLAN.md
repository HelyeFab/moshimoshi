# ts-fsrs Integration - Comprehensive Test Plan

**Created**: 2026-01-04
**Purpose**: Ensure bulletproof production deployment
**Current Coverage**: 30 tests (unit level)
**Target Coverage**: 150+ tests (unit + integration + e2e)

---

## 📊 Current Test Coverage Analysis

### ✅ **Already Covered (30 tests)**

1. **Type Conversions** (8 tests)
   - SRSData → ts-fsrs Card
   - ts-fsrs Card → SRSData
   - ReviewResult → Rating
   - State mappings

2. **Basic Functionality** (12 tests)
   - Card initialization
   - First review calculations
   - State transitions (new → learning → review)
   - Graduation logic
   - Mastery detection

3. **Retrievability & Scheduling** (6 tests)
   - Forgetting curve calculations
   - Interval calculations
   - Streak tracking

4. **Configuration** (4 tests)
   - Custom parameters
   - Parameter updates
   - Version detection
   - Default parameters

---

## 🔴 **Critical Gaps for Production**

### 1. Edge Cases & Boundary Conditions (CRITICAL)
**Priority**: 🔴 **HIGH**
**Impact**: Data corruption, calculation errors
**Tests Needed**: 25+ tests

#### Missing Tests:

##### **Extreme Intervals**
- [ ] Cards with max interval (36500 days)
- [ ] Cards approaching max interval (36000+ days)
- [ ] Cards with 0 interval
- [ ] Cards with negative intervals (data corruption scenario)
- [ ] Interval overflow handling

##### **Extreme Stability**
- [ ] Stability = 0 (new cards)
- [ ] Stability = 0.0001 (very unstable)
- [ ] Stability > 10000 (very stable, mature cards)
- [ ] Negative stability (data corruption)
- [ ] NaN/Infinity stability

##### **Extreme Difficulty**
- [ ] Difficulty = 0 (impossible)
- [ ] Difficulty = 10 (max)
- [ ] Difficulty > 10 (data corruption)
- [ ] Negative difficulty
- [ ] NaN difficulty

##### **Overdue Cards**
- [ ] 1 day overdue
- [ ] 7 days overdue (week)
- [ ] 30 days overdue (month)
- [ ] 100+ days overdue (severely overdue)
- [ ] 365+ days overdue (year+)
- [ ] Overdue bonus calculation accuracy

##### **Date Edge Cases**
- [ ] Leap year handling (Feb 29)
- [ ] Year boundary (Dec 31 → Jan 1)
- [ ] DST transitions
- [ ] Timezone edge cases
- [ ] Far future dates (2050+)
- [ ] Cards reviewed "in the future" (clock skew)

##### **Null/Undefined Handling**
- [ ] Missing srsData entirely
- [ ] Partial srsData (missing fields)
- [ ] Null lastReviewedAt
- [ ] Undefined stability/difficulty
- [ ] Empty ReviewResult
- [ ] Missing required fields in ReviewableContent

---

### 2. Data Migration & Backward Compatibility (CRITICAL)
**Priority**: 🔴 **HIGH**
**Impact**: User data loss, broken reviews
**Tests Needed**: 15+ tests

#### Missing Tests:

##### **Old FSRS → ts-fsrs Migration**
- [ ] Migrate card with FSRS-4 parameters (17 weights)
- [ ] Migrate card with FSRS-5 parameters (19 weights)
- [ ] Migrate card with missing algorithm field
- [ ] Migrate card with invalid algorithm field
- [ ] Migrate learning card mid-session
- [ ] Migrate review card
- [ ] Migrate mastered card
- [ ] Handle cards with corrupt SRS data

##### **SM-2 Compatibility**
- [ ] SM-2 cards remain untouched
- [ ] Mixed deck (SM-2 + FSRS) works correctly
- [ ] AlgorithmFactory routes correctly
- [ ] No cross-contamination between algorithms

##### **Version Compatibility**
- [ ] Read FSRS-5 data in FSRS-6 system
- [ ] Upgrade FSRS-5 → FSRS-6 automatically
- [ ] Handle version mismatch gracefully
- [ ] Preserve user data during upgrade

---

### 3. Integration with Flashcard System (CRITICAL)
**Priority**: 🔴 **HIGH**
**Impact**: Broken user workflows
**Tests Needed**: 20+ tests

#### Missing Tests:

##### **FlashcardManager Integration**
- [ ] Create deck with FSRS algorithm
- [ ] Add cards to FSRS deck
- [ ] Review cards via FlashcardManager
- [ ] Update SRS data after review
- [ ] Get due cards count
- [ ] Get next review date
- [ ] Archive/delete cards

##### **StudySession Integration**
- [ ] Start session with FSRS cards
- [ ] Complete full session (10+ cards)
- [ ] Handle session interruption
- [ ] Resume interrupted session
- [ ] Mixed session (new + learning + review)
- [ ] Session statistics accuracy

##### **SRSHelper Integration**
- [ ] Calculate next review date
- [ ] Get card status (new/learning/review)
- [ ] Determine if card is due
- [ ] Calculate retention rate
- [ ] Track progress over time

##### **SyncManager Integration**
- [ ] Sync FSRS data to Firestore
- [ ] Sync from Firestore
- [ ] Handle sync conflicts
- [ ] Offline queue processing
- [ ] Partial sync recovery

---

### 4. Performance & Scale Testing (HIGH)
**Priority**: 🟡 **MEDIUM-HIGH**
**Impact**: App slowdown, memory issues
**Tests Needed**: 10+ tests

#### Missing Tests:

##### **Batch Processing**
- [ ] Process 100 cards in sequence
- [ ] Process 1000 cards in sequence
- [ ] Process 10,000 cards (stress test)
- [ ] Calculate all due cards in large deck
- [ ] Memory usage under load

##### **Performance Benchmarks**
- [ ] Single review calculation < 1ms
- [ ] 100 reviews < 100ms
- [ ] 1000 reviews < 1s
- [ ] Initialization time < 10ms
- [ ] Parameter update time < 50ms

##### **Concurrent Operations**
- [ ] Multiple reviews in parallel (race conditions)
- [ ] Concurrent reads/writes
- [ ] Queue processing under load

---

### 5. User Scenarios & Workflows (MEDIUM)
**Priority**: 🟡 **MEDIUM**
**Impact**: User experience issues
**Tests Needed**: 25+ tests

#### Missing Tests:

##### **Complete Study Flows**
- [ ] Day 1: New user, first 20 cards
- [ ] Day 2: Review yesterday's cards + 20 new
- [ ] Day 7: Week review pattern
- [ ] Day 30: Month review pattern
- [ ] Day 90: Long-term retention

##### **Learning Progression**
- [ ] New card → Learning (multiple steps)
- [ ] Learning → Review (graduation)
- [ ] Review → Mastered (stability > 100 days)
- [ ] Review → Lapsed (forgotten)
- [ ] Lapsed → Relearning → Review

##### **Mixed Review Sessions**
- [ ] Session with 50% new, 30% learning, 20% review
- [ ] Session with all review cards
- [ ] Session with all new cards
- [ ] Session with lapsed cards
- [ ] Session with mastered cards (rare reviews)

##### **Streak & Accuracy Tracking**
- [ ] Build 10-day streak
- [ ] Break streak, rebuild
- [ ] Track best streak
- [ ] Calculate accuracy over time
- [ ] Leech detection (8+ failures)

##### **Real-Time Simulations**
- [ ] Simulate 30 days of reviews (fast-forward)
- [ ] Simulate 90 days of reviews
- [ ] Simulate forgetting pattern (skip reviews)
- [ ] Simulate perfect retention (all correct)
- [ ] Simulate poor retention (50% correct)

---

### 6. Error Handling & Resilience (MEDIUM)
**Priority**: 🟡 **MEDIUM**
**Impact**: App crashes, data loss
**Tests Needed**: 15+ tests

#### Missing Tests:

##### **Invalid Input Handling**
- [ ] Null ReviewableContent
- [ ] Invalid ReviewResult
- [ ] Corrupt SRSData
- [ ] Invalid rating value
- [ ] Invalid state value
- [ ] Invalid timestamp

##### **Algorithm Errors**
- [ ] ts-fsrs throws exception
- [ ] Parameter validation fails
- [ ] Calculation produces NaN
- [ ] Calculation produces Infinity
- [ ] Division by zero scenarios

##### **Recovery Scenarios**
- [ ] Recover from corrupt parameters
- [ ] Reset to defaults on error
- [ ] Partial data recovery
- [ ] Graceful degradation
- [ ] Error logging and reporting

##### **Concurrent Modification**
- [ ] Two devices review same card
- [ ] Sync conflict resolution
- [ ] Last-write-wins behavior
- [ ] Timestamp-based conflict resolution

---

### 7. Algorithm Correctness Validation (MEDIUM)
**Priority**: 🟢 **MEDIUM-LOW**
**Impact**: Incorrect scheduling (but not breaking)
**Tests Needed**: 20+ tests

#### Missing Tests:

##### **Mathematical Correctness**
- [ ] Forgetting curve matches R(t,S) = (1 + t/(9*S))^(-1)
- [ ] Stability increases after correct reviews
- [ ] Difficulty increases after incorrect reviews
- [ ] Interval fuzz is ±2.5% (when enabled)
- [ ] Short-term learning steps work correctly

##### **Statistical Validation**
- [ ] 90% retention target achieved over 1000 reviews
- [ ] Interval distribution matches expected
- [ ] Stability convergence over time
- [ ] Difficulty distribution is reasonable
- [ ] No drift from target retention

##### **Comparison Tests**
- [ ] Compare with official FSRS reference implementation
- [ ] Compare with Anki FSRS results (if possible)
- [ ] Verify against published FSRS papers
- [ ] Ensure no regression from old implementation

##### **Parameter Optimization**
- [ ] Default parameters are reasonable
- [ ] Custom parameters work correctly
- [ ] Parameter updates propagate
- [ ] Invalid parameters rejected

---

### 8. Regression Testing (MEDIUM)
**Priority**: 🟢 **MEDIUM-LOW**
**Impact**: Breaking existing features
**Tests Needed**: 10+ tests

#### Missing Tests:

##### **Existing Features**
- [ ] SM-2 algorithm still works
- [ ] Flashcard system unaffected
- [ ] Statistics calculations correct
- [ ] Streak tracking accurate
- [ ] Achievement system works
- [ ] Leaderboard scoring correct

##### **UI Integration**
- [ ] Flashcard viewer displays SRS data
- [ ] Review buttons work correctly
- [ ] Stats dashboard shows FSRS metrics
- [ ] Settings page allows algorithm selection

##### **API Compatibility**
- [ ] Public API unchanged
- [ ] No breaking changes to interfaces
- [ ] Backward compatible with old code

---

## 📋 **Implementation Roadmap**

### **Phase 1: Critical Production Blockers** (2-3 hours)
**Priority**: 🔴 Must complete before deployment

1. **Edge Cases & Boundary Conditions** (25 tests)
   - Extreme values (stability, difficulty, intervals)
   - Overdue cards (7d, 30d, 100d+)
   - Null/undefined handling
   - Date edge cases

2. **Data Migration Testing** (15 tests)
   - Old FSRS → ts-fsrs migration
   - SM-2 compatibility
   - Data corruption recovery

3. **FlashcardManager Integration** (10 tests)
   - Create/review/update flow
   - Due cards calculation
   - Session lifecycle

**Deliverable**: 50 additional tests, production-ready confidence

---

### **Phase 2: High-Value Integration Tests** (2-3 hours)
**Priority**: 🟡 Should complete within 1 week

1. **Complete Study Workflows** (15 tests)
   - Day 1, 7, 30, 90 simulations
   - Learning progression scenarios
   - Mixed review sessions

2. **Performance & Scale** (10 tests)
   - Batch processing (100, 1000 cards)
   - Performance benchmarks
   - Memory usage

3. **Error Handling** (10 tests)
   - Invalid input handling
   - Recovery scenarios
   - Conflict resolution

**Deliverable**: 35 additional tests, high confidence in user workflows

---

### **Phase 3: Algorithm Validation** (3-4 hours)
**Priority**: 🟢 Nice to have within 1 month

1. **Mathematical Correctness** (15 tests)
   - Forgetting curve validation
   - Stability/difficulty calculations
   - Interval distribution

2. **Statistical Validation** (10 tests)
   - Retention rate accuracy
   - Long-term simulations (1000+ reviews)
   - Comparison with reference

3. **Regression Testing** (10 tests)
   - SM-2 still works
   - UI integration
   - API compatibility

**Deliverable**: 35 additional tests, bulletproof confidence

---

## 📊 **Test Coverage Goals**

| Category | Current | Phase 1 | Phase 2 | Phase 3 | Total Target |
|----------|---------|---------|---------|---------|--------------|
| Unit Tests | 30 | +50 | +15 | +20 | 115 |
| Integration Tests | 0 | +10 | +20 | +5 | 35 |
| E2E/Simulation Tests | 0 | 0 | +10 | +10 | 20 |
| **Total** | **30** | **90** | **135** | **170** | **170+** |

---

## 🎯 **Success Criteria**

### **Minimum for Production (Phase 1)**
- [ ] 90+ total tests passing
- [ ] All edge cases covered
- [ ] Data migration verified
- [ ] FlashcardManager integration working
- [ ] Zero critical bugs found

### **High Confidence (Phase 2)**
- [ ] 135+ total tests passing
- [ ] All user workflows tested
- [ ] Performance benchmarks met
- [ ] Error handling verified
- [ ] Production dry-run successful

### **Bulletproof (Phase 3)**
- [ ] 170+ total tests passing
- [ ] Algorithm mathematically validated
- [ ] Statistical accuracy confirmed
- [ ] Regression suite complete
- [ ] 1 month of production monitoring

---

## 🛠️ **Test Infrastructure Needed**

### **Test Utilities**
```typescript
// Create realistic test data
createMockCard(overrides?: Partial<SRSData>): SRSData
createMockReviewHistory(days: number, accuracy: number): ReviewResult[]
createMockDeck(cardCount: number, algorithm: 'sm2' | 'fsrs'): Deck

// Simulation helpers
simulateReviewSession(cards: Card[], days: number): SessionResult
fastForwardDays(card: Card, days: number): Card
simulateUserBehavior(pattern: 'perfect' | 'good' | 'poor'): ReviewResult[]

// Assertion helpers
expectValidSRSData(srsData: SRSData): void
expectStabilityInRange(stability: number, min: number, max: number): void
expectReasonableInterval(interval: number, previousInterval: number): void
expectRetentionRate(history: ReviewResult[], target: number, tolerance: number): void
```

### **Test Fixtures**
- Sample decks (10, 100, 1000 cards)
- Review histories (1 week, 1 month, 3 months)
- Edge case data (corrupt, extreme values)
- Migration scenarios (FSRS-4, FSRS-5 data)

### **Performance Monitoring**
- Execution time tracking
- Memory usage profiling
- Benchmark comparisons
- Regression detection

---

## 📝 **Test File Structure**

```
src/lib/review-engine/srs/__tests__/
├── ts-fsrs-wrapper.test.ts                    # ✅ Current (30 tests)
├── ts-fsrs-wrapper.edge-cases.test.ts         # 🔴 Phase 1 (25 tests)
├── ts-fsrs-wrapper.migration.test.ts          # 🔴 Phase 1 (15 tests)
├── ts-fsrs-wrapper.integration.test.ts        # 🔴 Phase 1 (10 tests)
├── ts-fsrs-wrapper.workflows.test.ts          # 🟡 Phase 2 (15 tests)
├── ts-fsrs-wrapper.performance.test.ts        # 🟡 Phase 2 (10 tests)
├── ts-fsrs-wrapper.errors.test.ts             # 🟡 Phase 2 (10 tests)
├── ts-fsrs-wrapper.algorithm.test.ts          # 🟢 Phase 3 (15 tests)
├── ts-fsrs-wrapper.statistics.test.ts         # 🟢 Phase 3 (10 tests)
├── ts-fsrs-wrapper.regression.test.ts         # 🟢 Phase 3 (10 tests)
└── helpers/
    ├── test-data-factory.ts                   # Test data generators
    ├── simulation-helpers.ts                  # Time simulation
    ├── assertion-helpers.ts                   # Custom matchers
    └── fixtures.ts                            # Sample data
```

---

## 🚦 **Deployment Gates**

### **Gate 1: Phase 1 Complete (Required for Production)**
- ✅ All edge cases pass
- ✅ Migration tested with real data
- ✅ FlashcardManager integration verified
- ✅ Manual testing on staging
- ✅ Code review approved

### **Gate 2: Phase 2 Complete (Required for General Release)**
- ✅ All workflows tested
- ✅ Performance benchmarks met
- ✅ Error handling verified
- ✅ 1 week beta testing
- ✅ User feedback incorporated

### **Gate 3: Phase 3 Complete (Gold Standard)**
- ✅ Algorithm validated
- ✅ Statistical accuracy confirmed
- ✅ 1 month production monitoring
- ✅ Zero critical issues
- ✅ Documentation complete

---

## 🎯 **Immediate Next Steps**

### **1. Create Phase 1 Test Files** (TODAY)
```bash
# Create test file structure
touch src/lib/review-engine/srs/__tests__/ts-fsrs-wrapper.edge-cases.test.ts
touch src/lib/review-engine/srs/__tests__/ts-fsrs-wrapper.migration.test.ts
touch src/lib/review-engine/srs/__tests__/ts-fsrs-wrapper.integration.test.ts

# Create helper utilities
mkdir -p src/lib/review-engine/srs/__tests__/helpers
touch src/lib/review-engine/srs/__tests__/helpers/test-data-factory.ts
touch src/lib/review-engine/srs/__tests__/helpers/simulation-helpers.ts
touch src/lib/review-engine/srs/__tests__/helpers/assertion-helpers.ts
```

### **2. Implement Critical Tests** (NEXT 2-3 HOURS)
Priority order:
1. Edge cases (extreme values, overdue, null handling)
2. Migration (FSRS-4/5 → FSRS-6, corruption recovery)
3. FlashcardManager integration (review flow)

### **3. Run Test Suite** (CONTINUOUS)
```bash
# Run all tests
npm test ts-fsrs

# Run specific category
npm test ts-fsrs-wrapper.edge-cases

# Watch mode during development
npm test -- --watch ts-fsrs
```

---

## 📈 **Success Metrics**

| Metric | Current | Phase 1 Target | Phase 2 Target | Phase 3 Target |
|--------|---------|----------------|----------------|----------------|
| **Test Count** | 30 | 90+ | 135+ | 170+ |
| **Code Coverage** | ~80% | 95%+ | 98%+ | 99%+ |
| **Edge Cases** | Basic | Complete | Complete | Complete |
| **Integration** | None | Basic | Complete | Complete |
| **Performance** | Not tested | < 1ms/review | < 1ms/review | < 1ms/review |
| **Production Ready** | ⚠️ Maybe | ✅ Yes | ✅ Yes | ✅ Bulletproof |

---

**Current Status**: ✅ Phase 0 Complete (30 tests)
**Next Milestone**: 🔴 Phase 1 - Production Blockers (90 tests)
**Timeline**: 2-3 hours
**Blocker for Deployment**: Yes - Complete Phase 1 before production

---

**Questions?** Review this plan and let me know which phase you'd like to tackle first!
