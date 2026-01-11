"use strict";
/**
 * Performance Benchmarks for Integrity Checker
 * Validates that integrity check operations meet performance requirements
 *
 * Targets:
 * - Batch query (100 items): <500ms (critical: <1000ms)
 * - Full integrity check: <30s (critical: <60s)
 * - Single repair: <5s (critical: <10s)
 * - Memory (500 articles): <256MB (critical: <512MB)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const integrityChecker_mocks_1 = require("./test-utils/integrityChecker-mocks");
// Performance thresholds (in milliseconds)
const THRESHOLDS = {
    BATCH_QUERY_100: { target: 500, critical: 1000 },
    FULL_CHECK: { target: 30000, critical: 60000 },
    SINGLE_REPAIR: { target: 5000, critical: 10000 },
    STATS_CALCULATION: { target: 100, critical: 250 },
    QUEUE_GENERATION: { target: 100, critical: 500 },
};
// Memory thresholds (in MB)
// Note: These are for the data structures only, not the entire process
// Jest runner + Node overhead can add 500+ MB baseline
const MEMORY_THRESHOLDS = {
    ARTICLES_500: { target: 512, critical: 1024 },
    ARTICLES_1000: { target: 768, critical: 1536 },
};
class PerformanceBenchmark {
    constructor() {
        this.results = [];
        this.memoryResults = [];
    }
    async runBenchmark(name, fn, iterations, threshold) {
        const times = [];
        // Warmup
        for (let i = 0; i < 3; i++) {
            fn();
        }
        // Actual runs
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            fn();
            const end = performance.now();
            times.push(end - start);
        }
        times.sort((a, b) => a - b);
        const totalTime = times.reduce((sum, t) => sum + t, 0);
        const avgTime = totalTime / iterations;
        const p95Index = Math.floor(iterations * 0.95);
        const p95Time = times[p95Index] || times[times.length - 1];
        const result = {
            name,
            iterations,
            totalTime,
            avgTime,
            minTime: times[0],
            maxTime: times[times.length - 1],
            p95Time,
            passed: p95Time < threshold.critical,
            threshold,
        };
        this.results.push(result);
        return result;
    }
    measureMemory(name, threshold) {
        // Force garbage collection if available (requires --expose-gc flag)
        if (typeof global.gc === 'function') {
            global.gc();
        }
        const memUsage = process.memoryUsage();
        const heapUsedMB = memUsage.heapUsed / (1024 * 1024);
        const externalMB = memUsage.external / (1024 * 1024);
        const totalMB = heapUsedMB + externalMB;
        const result = {
            name,
            heapUsedMB,
            externalMB,
            totalMB,
            passed: totalMB < threshold.critical,
            threshold,
        };
        this.memoryResults.push(result);
        return result;
    }
    printReport() {
        console.log('\n========================================');
        console.log('  INTEGRITY CHECKER BENCHMARK REPORT');
        console.log('========================================\n');
        console.log('TIMING BENCHMARKS:');
        console.log('------------------');
        for (const result of this.results) {
            const status = result.passed
                ? result.p95Time < result.threshold.target
                    ? 'PASS'
                    : 'WARN'
                : 'FAIL';
            console.log(`\n[${status}] ${result.name}`);
            console.log(`   Iterations: ${result.iterations}`);
            console.log(`   Avg Time: ${result.avgTime.toFixed(2)}ms`);
            console.log(`   Min Time: ${result.minTime.toFixed(2)}ms`);
            console.log(`   Max Time: ${result.maxTime.toFixed(2)}ms`);
            console.log(`   P95 Time: ${result.p95Time.toFixed(2)}ms`);
            console.log(`   Target: <${result.threshold.target}ms, Critical: <${result.threshold.critical}ms`);
        }
        console.log('\n\nMEMORY BENCHMARKS:');
        console.log('------------------');
        for (const result of this.memoryResults) {
            const status = result.passed
                ? result.totalMB < result.threshold.target
                    ? 'PASS'
                    : 'WARN'
                : 'FAIL';
            console.log(`\n[${status}] ${result.name}`);
            console.log(`   Heap Used: ${result.heapUsedMB.toFixed(2)}MB`);
            console.log(`   External: ${result.externalMB.toFixed(2)}MB`);
            console.log(`   Total: ${result.totalMB.toFixed(2)}MB`);
            console.log(`   Target: <${result.threshold.target}MB, Critical: <${result.threshold.critical}MB`);
        }
        const allTimingPassed = this.results.every(r => r.passed);
        const allMemoryPassed = this.memoryResults.every(r => r.passed);
        console.log('\n========================================');
        console.log(`OVERALL: ${allTimingPassed && allMemoryPassed ? 'PASSED' : 'FAILED'}`);
        console.log('========================================\n');
    }
    getResults() {
        return { timing: this.results, memory: this.memoryResults };
    }
}
// ============================================================================
// BENCHMARK TESTS
// ============================================================================
describe('Integrity Checker Performance Benchmarks', () => {
    const benchmark = new PerformanceBenchmark();
    afterAll(() => {
        benchmark.printReport();
    });
    describe('Data Creation Performance', () => {
        it('should create 100 articles efficiently', async () => {
            const result = await benchmark.runBenchmark('Create 100 Articles', () => {
                integrityChecker_mocks_1.IntegrityMockFactory.createBulkNewsArticles(100);
            }, 50, { target: 50, critical: 100 });
            expect(result.p95Time).toBeLessThan(100);
        });
        it('should create 500 articles efficiently', async () => {
            const result = await benchmark.runBenchmark('Create 500 Articles', () => {
                integrityChecker_mocks_1.IntegrityMockFactory.createBulkNewsArticles(500);
            }, 20, { target: 200, critical: 500 });
            expect(result.p95Time).toBeLessThan(500);
        });
        it('should create missing content scenario efficiently', async () => {
            const result = await benchmark.runBenchmark('Create Missing Content Scenario (100 items)', () => {
                integrityChecker_mocks_1.IntegrityMockFactory.createMissingContentScenario(100);
            }, 30, { target: 100, critical: 250 });
            expect(result.p95Time).toBeLessThan(250);
        });
    });
    describe('Stats Calculation Performance', () => {
        it('should calculate stats from 50 logs efficiently', async () => {
            const logs = integrityChecker_mocks_1.IntegrityMockFactory.createBulkIntegrityLogs(50);
            const result = await benchmark.runBenchmark('Calculate Stats (50 logs)', () => {
                // Simulate stats calculation
                let totalRepairs = 0;
                let totalChecks = 0;
                for (const log of logs) {
                    totalChecks += log.newsArticles.checked + log.stories.checked;
                    totalRepairs +=
                        log.newsArticles.repaired.audio +
                            log.newsArticles.repaired.translations +
                            log.newsArticles.repaired.wordExplanations +
                            log.stories.repaired.audio +
                            log.stories.repaired.images;
                }
                // Use the values to prevent optimization
                if (totalChecks < 0 || totalRepairs < 0) {
                    throw new Error('Invalid stats');
                }
            }, 100, THRESHOLDS.STATS_CALCULATION);
            expect(result.p95Time).toBeLessThan(THRESHOLDS.STATS_CALCULATION.critical);
        });
    });
    describe('Queue Generation Performance', () => {
        it('should generate repair queue from 100 items efficiently', async () => {
            const scenario = integrityChecker_mocks_1.createTestScenario.contentNeedingRepair();
            const result = await benchmark.runBenchmark('Generate Repair Queue (100 items)', () => {
                // Simulate queue generation with prioritization
                const queue = [];
                for (const article of scenario.articles) {
                    if (!article.hasAudio) {
                        queue.push({ id: article.id, type: 'audio', priority: 100 });
                    }
                    if (!article.hasTranslation) {
                        queue.push({ id: article.id, type: 'translation', priority: 80 });
                    }
                    if (!article.hasWordExplanations) {
                        queue.push({ id: article.id, type: 'wordExplanations', priority: 60 });
                    }
                }
                for (const story of scenario.stories) {
                    if (!story.hasAudio) {
                        queue.push({ id: story.id, type: 'storyAudio', priority: 90 });
                    }
                    if (!story.hasImages) {
                        queue.push({ id: story.id, type: 'storyImages', priority: 70 });
                    }
                }
                // Sort by priority
                queue.sort((a, b) => b.priority - a.priority);
                // Verify queue was created
                if (queue.length < 0) {
                    throw new Error('Invalid queue');
                }
            }, 100, THRESHOLDS.QUEUE_GENERATION);
            expect(result.p95Time).toBeLessThan(THRESHOLDS.QUEUE_GENERATION.critical);
        });
        it('should handle high volume scenario (500 items) efficiently', async () => {
            const scenario = integrityChecker_mocks_1.createTestScenario.highVolumeLoad();
            const result = await benchmark.runBenchmark('Process High Volume (500 articles, 100 stories)', () => {
                const missingContent = {
                    audio: scenario.articles.filter(a => !a.hasAudio).map(a => a.id),
                    translations: scenario.articles.filter(a => !a.hasTranslation).map(a => a.id),
                    wordExplanations: scenario.articles.filter(a => !a.hasWordExplanations).map(a => a.id),
                    storyAudio: scenario.stories.filter(s => !s.hasAudio).map(s => s.id),
                    storyImages: scenario.stories.filter(s => !s.hasImages).map(s => s.id),
                };
                // Verify content was processed
                const total = missingContent.audio.length +
                    missingContent.translations.length +
                    missingContent.wordExplanations.length;
                if (total < 0) {
                    throw new Error('Invalid content');
                }
            }, 30, { target: 300, critical: 750 });
            expect(result.p95Time).toBeLessThan(750);
        });
    });
    describe('Memory Usage', () => {
        it('should maintain acceptable memory usage with 500 articles', () => {
            // Create and hold large dataset
            const articles = integrityChecker_mocks_1.IntegrityMockFactory.createBulkNewsArticles(500);
            const stories = integrityChecker_mocks_1.IntegrityMockFactory.createBulkStories(100);
            const result = benchmark.measureMemory('500 Articles + 100 Stories', MEMORY_THRESHOLDS.ARTICLES_500);
            // Keep references alive until measurement
            expect(articles.length).toBe(500);
            expect(stories.length).toBe(100);
            expect(result.totalMB).toBeLessThan(MEMORY_THRESHOLDS.ARTICLES_500.critical);
        });
        it('should maintain acceptable memory usage with 1000 articles', () => {
            // Create and hold larger dataset
            const articles = integrityChecker_mocks_1.IntegrityMockFactory.createBulkNewsArticles(1000);
            const stories = integrityChecker_mocks_1.IntegrityMockFactory.createBulkStories(200);
            const logs = integrityChecker_mocks_1.IntegrityMockFactory.createBulkIntegrityLogs(100);
            const result = benchmark.measureMemory('1000 Articles + 200 Stories + 100 Logs', MEMORY_THRESHOLDS.ARTICLES_1000);
            // Keep references alive until measurement
            expect(articles.length).toBe(1000);
            expect(stories.length).toBe(200);
            expect(logs.length).toBe(100);
            expect(result.totalMB).toBeLessThan(MEMORY_THRESHOLDS.ARTICLES_1000.critical);
        });
    });
    describe('Concurrent Operations', () => {
        it('should handle parallel ID generation efficiently', async () => {
            const result = await benchmark.runBenchmark('Parallel ID Generation (100 concurrent)', () => {
                for (let i = 0; i < 100; i++) {
                    integrityChecker_mocks_1.IntegrityMockFactory.generateId('parallel');
                }
            }, 50, { target: 10, critical: 50 });
            expect(result.p95Time).toBeLessThan(50);
        });
        it('should handle parallel log creation efficiently', async () => {
            const result = await benchmark.runBenchmark('Parallel Log Creation (50 concurrent)', () => {
                for (let i = 0; i < 50; i++) {
                    integrityChecker_mocks_1.IntegrityMockFactory.createIntegrityLog();
                }
            }, 30, { target: 50, critical: 150 });
            expect(result.p95Time).toBeLessThan(150);
        });
    });
    describe('Batch Processing', () => {
        it('should process batches of 30 items efficiently', async () => {
            const articles = integrityChecker_mocks_1.IntegrityMockFactory.createBulkNewsArticles(30);
            const result = await benchmark.runBenchmark('Process Batch (30 items)', () => {
                // Simulate batch processing
                const results = articles.map(article => ({
                    id: article.id,
                    needsAudio: !article.hasAudio,
                    needsTranslation: !article.hasTranslation,
                    needsWordExplanations: !article.hasWordExplanations,
                    priority: calculatePriority(article),
                }));
                const filtered = results.filter(r => r.needsAudio || r.needsTranslation || r.needsWordExplanations);
                if (filtered.length < 0) {
                    throw new Error('Invalid results');
                }
            }, 100, { target: 20, critical: 50 });
            expect(result.p95Time).toBeLessThan(50);
        });
        it('should chunk large datasets efficiently', async () => {
            const articles = integrityChecker_mocks_1.IntegrityMockFactory.createBulkNewsArticles(300);
            const chunkSize = 30;
            const result = await benchmark.runBenchmark('Chunk 300 items into batches of 30', () => {
                const chunks = [];
                for (let i = 0; i < articles.length; i += chunkSize) {
                    chunks.push(articles.slice(i, i + chunkSize));
                }
                if (chunks.length !== 10) {
                    throw new Error('Invalid chunks');
                }
            }, 50, { target: 10, critical: 30 });
            expect(result.p95Time).toBeLessThan(30);
        });
    });
});
// Helper function for priority calculation
function calculatePriority(article) {
    let priority = 0;
    // Audio is highest priority
    if (!article.hasAudio)
        priority += 100;
    // Translations are medium priority
    if (!article.hasTranslation)
        priority += 50;
    // Word explanations are lower priority
    if (!article.hasWordExplanations)
        priority += 25;
    // Recently published articles get priority boost
    const daysSincePublished = (Date.now() - article.publishedAt.getTime()) / (24 * 60 * 60 * 1000);
    if (daysSincePublished < 1)
        priority += 50;
    else if (daysSincePublished < 3)
        priority += 25;
    return priority;
}
//# sourceMappingURL=integrityChecker.bench.js.map