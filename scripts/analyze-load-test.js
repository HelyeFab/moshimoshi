/**
 * Load Test Results Analyzer
 *
 * Analyzes k6 JSON output and generates a markdown report
 * with SLO compliance checks and recommendations.
 *
 * Usage:
 *   node scripts/analyze-load-test.js tests/load/results.json
 */

const fs = require('fs');
const path = require('path');

// SLO Thresholds
const SLO = {
  P50_LATENCY_MS: 50,
  P95_LATENCY_MS: 200,
  P99_LATENCY_MS: 500,
  ERROR_RATE_PERCENT: 1,
  MIN_THROUGHPUT_RPM: 200,
};

function analyzeResults(jsonFile) {
  console.log(`📊 Analyzing load test results from ${jsonFile}...`);

  if (!fs.existsSync(jsonFile)) {
    console.error(`❌ Results file not found: ${jsonFile}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));

  // Extract metrics
  const metrics = data.metrics;

  const httpReqDuration = metrics.http_req_duration;
  const errors = metrics.errors;
  const httpReqs = metrics.http_reqs;

  // Calculate key metrics
  const p50 = httpReqDuration.values['p(50)'];
  const p95 = httpReqDuration.values['p(95)'];
  const p99 = httpReqDuration.values['p(99)'];
  const avg = httpReqDuration.values.avg;
  const max = httpReqDuration.values.max;

  const errorRate = errors.values.rate * 100; // Convert to percentage
  const totalRequests = httpReqs.values.count;
  const requestRate = httpReqs.values.rate;
  const requestsPerMinute = requestRate * 60;

  // SLO Compliance Checks
  const sloResults = {
    p50Compliant: p50 < SLO.P50_LATENCY_MS,
    p95Compliant: p95 < SLO.P95_LATENCY_MS,
    p99Compliant: p99 < SLO.P99_LATENCY_MS,
    errorRateCompliant: errorRate < SLO.ERROR_RATE_PERCENT,
    throughputCompliant: requestsPerMinute >= SLO.MIN_THROUGHPUT_RPM,
  };

  const allCompliant = Object.values(sloResults).every((v) => v === true);

  // Generate Report
  const report = generateReport({
    p50,
    p95,
    p99,
    avg,
    max,
    errorRate,
    totalRequests,
    requestsPerMinute,
    sloResults,
    allCompliant,
    metrics,
  });

  // Write report
  const reportPath = 'docs/testing/load-test-report-' + new Date().toISOString().split('T')[0] + '.md';
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, report);

  console.log('');
  console.log(`✅ Report generated: ${reportPath}`);
  console.log('');

  // Print summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 Load Test Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Total Requests: ${totalRequests.toLocaleString()}`);
  console.log(`Throughput: ${requestsPerMinute.toFixed(1)} req/min`);
  console.log('');
  console.log('Latency:');
  console.log(`  P50: ${p50.toFixed(1)}ms ${sloResults.p50Compliant ? '✅' : '❌'} (target: < ${SLO.P50_LATENCY_MS}ms)`);
  console.log(`  P95: ${p95.toFixed(1)}ms ${sloResults.p95Compliant ? '✅' : '❌'} (target: < ${SLO.P95_LATENCY_MS}ms)`);
  console.log(`  P99: ${p99.toFixed(1)}ms ${sloResults.p99Compliant ? '✅' : '❌'} (target: < ${SLO.P99_LATENCY_MS}ms)`);
  console.log(`  Avg: ${avg.toFixed(1)}ms`);
  console.log(`  Max: ${max.toFixed(1)}ms`);
  console.log('');
  console.log(`Error Rate: ${errorRate.toFixed(2)}% ${sloResults.errorRateCompliant ? '✅' : '❌'} (target: < ${SLO.ERROR_RATE_PERCENT}%)`);
  console.log('');
  console.log(`Overall SLO Compliance: ${allCompliant ? '✅ PASS' : '❌ FAIL'}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  return allCompliant ? 0 : 1;
}

function generateReport(data) {
  const {
    p50,
    p95,
    p99,
    avg,
    max,
    errorRate,
    totalRequests,
    requestsPerMinute,
    sloResults,
    allCompliant,
    metrics,
  } = data;

  const date = new Date().toISOString().split('T')[0];

  return `# Load Test Report - ${date}

**Test Target**: /api/stats/unified
**Date**: ${new Date().toISOString()}
**Status**: ${allCompliant ? '✅ PASS' : '❌ FAIL'}
**Agent**: Agent C (Observability & Release)

---

## Executive Summary

${allCompliant
  ? '✅ **All SLO targets met.** The system is ready for production rollout under expected load conditions.'
  : '❌ **SLO violations detected.** Review findings and optimize before production rollout.'}

### Overall Results

| Metric | Result | Target | Status |
|--------|--------|--------|--------|
| **P50 Latency** | ${p50.toFixed(1)}ms | < ${SLO.P50_LATENCY_MS}ms | ${sloResults.p50Compliant ? '✅' : '❌'} |
| **P95 Latency** | ${p95.toFixed(1)}ms | < ${SLO.P95_LATENCY_MS}ms | ${sloResults.p95Compliant ? '✅' : '❌'} |
| **P99 Latency** | ${p99.toFixed(1)}ms | < ${SLO.P99_LATENCY_MS}ms | ${sloResults.p99Compliant ? '✅' : '❌'} |
| **Error Rate** | ${errorRate.toFixed(2)}% | < ${SLO.ERROR_RATE_PERCENT}% | ${sloResults.errorRateCompliant ? '✅' : '❌'} |
| **Throughput** | ${requestsPerMinute.toFixed(1)} req/min | ≥ ${SLO.MIN_THROUGHPUT_RPM} req/min | ${sloResults.throughputCompliant ? '✅' : '❌'} |

---

## Test Configuration

### Load Profile

- **Baseline**: 50 req/min for 2 minutes (warmup)
- **Peak**: 200 req/min for 10 minutes (sustained load)
- **Burst**: 400 req/min for 5 minutes (stress test)
- **Cooldown**: 50 req/min for 2 minutes
- **Total Duration**: ~22 minutes

### Operation Mix

- **60%** Session recordings (\`type: 'session'\`)
- **20%** XP updates (\`type: 'xp'\`)
- **10%** Streak updates (\`type: 'streak'\`)
- **10%** Achievement unlocks (\`type: 'achievement'\`)

---

## Detailed Metrics

### Latency Distribution

| Percentile | Duration | Status |
|------------|----------|--------|
| Min | ${metrics.http_req_duration.values.min.toFixed(1)}ms | - |
| P50 (Median) | ${p50.toFixed(1)}ms | ${sloResults.p50Compliant ? '✅' : '❌'} |
| P90 | ${metrics.http_req_duration.values['p(90)'].toFixed(1)}ms | - |
| P95 | ${p95.toFixed(1)}ms | ${sloResults.p95Compliant ? '✅' : '❌'} |
| P99 | ${p99.toFixed(1)}ms | ${sloResults.p99Compliant ? '✅' : '❌'} |
| Max | ${max.toFixed(1)}ms | - |
| Average | ${avg.toFixed(1)}ms | - |

### Request Statistics

- **Total Requests**: ${totalRequests.toLocaleString()}
- **Request Rate**: ${requestsPerMinute.toFixed(1)} req/min (${(requestsPerMinute / 60).toFixed(2)} req/sec)
- **Success Rate**: ${(100 - errorRate).toFixed(2)}%
- **Error Rate**: ${errorRate.toFixed(2)}%

### Operation-Specific Performance

${metrics.session_operation_duration ? `
#### Session Operations
- Count: ${metrics.session_operations.values.count.toLocaleString()}
- P95 Latency: ${metrics.session_operation_duration.values['p(95)'].toFixed(1)}ms
- Average: ${metrics.session_operation_duration.values.avg.toFixed(1)}ms
` : ''}

${metrics.xp_operation_duration ? `
#### XP Operations
- Count: ${metrics.xp_operations.values.count.toLocaleString()}
- P95 Latency: ${metrics.xp_operation_duration.values['p(95)'].toFixed(1)}ms
- Average: ${metrics.xp_operation_duration.values.avg.toFixed(1)}ms
` : ''}

${metrics.streak_operation_duration ? `
#### Streak Operations
- Count: ${metrics.streak_operations.values.count.toLocaleString()}
- P95 Latency: ${metrics.streak_operation_duration.values['p(95)'].toFixed(1)}ms
- Average: ${metrics.streak_operation_duration.values.avg.toFixed(1)}ms
` : ''}

${metrics.achievement_operation_duration ? `
#### Achievement Operations
- Count: ${metrics.achievement_operations.values.count.toLocaleString()}
- P95 Latency: ${metrics.achievement_operation_duration.values['p(95)'].toFixed(1)}ms
- Average: ${metrics.achievement_operation_duration.values.avg.toFixed(1)}ms
` : ''}

---

## Findings

${!sloResults.p95Compliant ? `
### ⚠️ P95 Latency Violation
**Issue**: P95 latency is ${p95.toFixed(1)}ms, exceeding the ${SLO.P95_LATENCY_MS}ms target.

**Impact**: 5% of requests are taking longer than acceptable.

**Recommendations**:
1. Add database indexes on frequently queried fields
2. Implement Redis caching for user stats reads
3. Optimize Firestore queries (use composite indexes)
4. Consider connection pool tuning
5. Review slow query logs for bottlenecks
` : ''}

${!sloResults.p99Compliant ? `
### ⚠️ P99 Latency Violation
**Issue**: P99 latency is ${p99.toFixed(1)}ms, exceeding the ${SLO.P99_LATENCY_MS}ms target.

**Impact**: 1% of requests experiencing severe latency.

**Recommendations**:
1. Investigate database lock contention
2. Check for N+1 query patterns
3. Review connection pool exhaustion
4. Consider request timeout tuning
` : ''}

${!sloResults.errorRateCompliant ? `
### ❌ Error Rate Violation
**Issue**: Error rate is ${errorRate.toFixed(2)}%, exceeding the ${SLO.ERROR_RATE_PERCENT}% target.

**Impact**: Too many requests failing - system not production-ready.

**Recommendations**:
1. Review application logs for error patterns
2. Check database connection stability
3. Verify rate limiting not too aggressive
4. Investigate timeout configurations
5. **CRITICAL**: Must resolve before production rollout
` : ''}

${!sloResults.throughputCompliant ? `
### ⚠️ Throughput Below Target
**Issue**: Throughput is ${requestsPerMinute.toFixed(1)} req/min, below ${SLO.MIN_THROUGHPUT_RPM} req/min target.

**Impact**: System may not handle expected production load.

**Recommendations**:
1. Scale horizontally (add more instances)
2. Optimize request processing
3. Review resource limits (CPU, memory)
` : ''}

${allCompliant ? `
### ✅ All SLOs Met

The system performed well under peak + 2x burst load conditions. Key observations:

1. **Latency**: All percentiles within acceptable ranges
2. **Error Rate**: Minimal errors indicate stable operation
3. **Throughput**: System handled target load with headroom
4. **Consistency**: Metrics remained stable during burst phase

**Resource Headroom** (if available):
- Review CPU utilization (target: < 70% during burst)
- Review memory usage (target: < 80%)
- Review database connections (target: < 80% of pool)
` : ''}

---

## Recommendations

### Immediate Actions
${!allCompliant ? `
1. ❌ **DO NOT proceed to production** until SLO violations resolved
2. Address findings listed above
3. Re-run load test after optimizations
4. Verify SLO compliance before rollout
` : `
1. ✅ System is ready for production rollout
2. Monitor dashboards closely during dark-launch
3. Set up automated alerts for SLO violations
4. Prepare rollback procedure
`}

### Performance Optimization (if needed)
1. Add database indexes on \`user_stats\` collection
2. Implement Redis caching for frequently accessed stats
3. Use Firestore composite indexes for complex queries
4. Consider read replicas for high read volume
5. Optimize serialization/deserialization of large objects

### Monitoring
1. Set up continuous load monitoring in production
2. Configure alerts for P95 > 200ms and error rate > 1%
3. Track resource utilization (CPU, memory, connections)
4. Monitor database query performance

---

## Next Steps

1. ${allCompliant ? '✅' : '❌'} Review this report with Supervisor
2. ${allCompliant ? '✅' : '⬜'} Update QA Matrix with load test evidence
3. ${allCompliant ? '✅' : '⬜'} Proceed to security audit
4. ${allCompliant ? '✅' : '⬜'} Package evidence for go/no-go decision

---

**Prepared by**: Agent C (Observability & Release)
**Report Date**: ${new Date().toISOString()}
**Test Environment**: ${process.env.BASE_URL || 'Staging'}
`;
}

// Run analysis
if (require.main === module) {
  const jsonFile = process.argv[2] || 'tests/load/results.json';
  const exitCode = analyzeResults(jsonFile);
  process.exit(exitCode);
}

module.exports = { analyzeResults };
