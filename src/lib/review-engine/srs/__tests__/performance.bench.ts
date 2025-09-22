/**
 * Performance benchmarks for SRS system
 * Ensures all operations meet < 10ms requirement
 */

import { SRSAlgorithm } from '../algorithm'
import { SRSStateManager } from '../state-manager'
import { DifficultyCalculator } from '../difficulty'
import { SRSIntegration } from '../integration'
import { ReviewableContentWithSRS } from '../../core/interfaces'
import { reviewLogger } from '@/lib/monitoring/logger';

/**
 * Benchmark result interface
 */
interface BenchmarkResult {
  name: string
  iterations: number
  totalTime: number
  avgTime: number
  minTime: number
  maxTime: number
  p95Time: number
  p99Time: number
  passed: boolean
}

/**
 * Run a benchmark test
 */
function benchmark(
  name: string,
  fn: () => void,
  iterations: number = 1000,
  targetMs: number = 10
): BenchmarkResult {
  const times: number[] = []
  
  // Warm up
  for (let i = 0; i < 10; i++) {
    fn()
  }
  
  // Run benchmark
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    fn()
    const end = performance.now()
    times.push(end - start)
  }
  
  // Calculate statistics
  times.sort((a, b) => a - b)
  const totalTime = times.reduce((sum, t) => sum + t, 0)
  const avgTime = totalTime / iterations
  const minTime = times[0]
  const maxTime = times[times.length - 1]
  const p95Time = times[Math.floor(iterations * 0.95)]
  const p99Time = times[Math.floor(iterations * 0.99)]
  
  return {
    name,
    iterations,
    totalTime,
    avgTime,
    minTime,
    maxTime,
    p95Time,
    p99Time,
    passed: p95Time < targetMs
  }
}

/**
 * Create mock items for testing
 */
function createMockItems(count: number): ReviewableContentWithSRS[] {
  const items: ReviewableContentWithSRS[] = []
  
  for (let i = 0; i < count; i++) {
    items.push({
      id: `item-${i}`,
      contentType: ['kana', 'kanji', 'vocabulary'][i % 3] as any,
      primaryDisplay: `content-${i}`,
      primaryAnswer: `answer-${i}`,
      difficulty: Math.random(),
      tags: [`tag-${i % 5}`, `level-${i % 3}`],
      supportedModes: ['recognition', 'recall'],
      srsData: i % 4 === 0 ? undefined : {
        interval: Math.random() * 30,
        easeFactor: 1.3 + Math.random() * 1.2,
        repetitions: Math.floor(Math.random() * 10),
        lastReviewedAt: new Date(Date.now() - Math.random() * 86400000 * 30),
        nextReviewAt: new Date(Date.now() + Math.random() * 86400000 * 7),
        status: ['new', 'learning', 'review', 'mastered'][i % 4] as any,
        reviewCount: Math.floor(Math.random() * 20),
        correctCount: Math.floor(Math.random() * 18),
        streak: Math.floor(Math.random() * 10),
        bestStreak: Math.floor(Math.random() * 15)
      }
    })
  }
  
  return items
}

/**
 * Run all performance benchmarks
 */
export function runBenchmarks(): void {
  reviewLogger.info('🚀 Running SRS Performance Benchmarks...\n')
  
  const results: BenchmarkResult[] = []
  
  // Setup
  const algorithm = new SRSAlgorithm()
  const stateManager = new SRSStateManager(algorithm)
  const difficultyCalculator = new DifficultyCalculator()
  const integration = new SRSIntegration(algorithm, stateManager, difficultyCalculator)
  
  const mockItems = createMockItems(1000)
  const singleItem = mockItems[0]
  
  // Benchmark 1: Calculate next review
  results.push(
    benchmark('Calculate Next Review', () => {
      algorithm.calculateNextReview(singleItem, {
        correct: true,
        responseTime: 3000,
        confidence: 4
      })
    })
  )
  
  // Benchmark 2: Calculate ease factor
  results.push(
    benchmark('Calculate Ease Factor', () => {
      algorithm.calculateEaseFactor(2.5, Math.floor(Math.random() * 6))
    })
  )
  
  // Benchmark 3: Get quality from result
  results.push(
    benchmark('Get Quality from Result', () => {
      algorithm.getQualityFromResult({
        correct: true,
        responseTime: Math.random() * 10000,
        confidence: (Math.floor(Math.random() * 5) + 1) as any,
        hintsUsed: Math.floor(Math.random() * 3)
      })
    })
  )
  
  // Benchmark 4: Check if due
  results.push(
    benchmark('Check If Due', () => {
      algorithm.isDue(mockItems[Math.floor(Math.random() * mockItems.length)])
    })
  )
  
  // Benchmark 5: Sort by priority (100 items)
  const itemsToSort = mockItems.slice(0, 100)
  results.push(
    benchmark('Sort 100 Items by Priority', () => {
      algorithm.sortByPriority([...itemsToSort])
    }, 100)
  )
  
  // Benchmark 6: Update item state
  results.push(
    benchmark('Update Item State', () => {
      stateManager.updateItemState(singleItem, {
        correct: Math.random() > 0.3,
        responseTime: Math.random() * 5000
      })
    })
  )
  
  // Benchmark 7: Get collection stats (100 items)
  const statsItems = mockItems.slice(0, 100)
  results.push(
    benchmark('Get Collection Stats (100 items)', () => {
      stateManager.getCollectionStats(statsItems)
    }, 100)
  )
  
  // Benchmark 8: Filter by state
  results.push(
    benchmark('Filter by State', () => {
      stateManager.filterByState(mockItems, ['learning', 'review'])
    }, 100)
  )
  
  // Benchmark 9: Get due items
  results.push(
    benchmark('Get Due Items', () => {
      stateManager.getDueItems(mockItems)
    }, 100)
  )
  
  // Benchmark 10: Calculate initial difficulty
  results.push(
    benchmark('Calculate Initial Difficulty', () => {
      difficultyCalculator.calculateInitialDifficulty(singleItem, {
        length: singleItem.primaryDisplay.length,
        strokeCount: Math.floor(Math.random() * 20),
        jlptLevel: Math.floor(Math.random() * 5) + 1,
        frequencyRank: Math.floor(Math.random() * 5000)
      })
    })
  )
  
  // Benchmark 11: Adjust difficulty
  const performanceHistory = Array(5).fill(null).map(() => ({
    correct: Math.random() > 0.3,
    responseTime: Math.random() * 5000
  }))
  
  results.push(
    benchmark('Adjust Difficulty', () => {
      difficultyCalculator.adjustDifficulty(0.5, performanceHistory)
    })
  )
  
  // Benchmark 12: Group by difficulty
  results.push(
    benchmark('Group by Difficulty', () => {
      difficultyCalculator.groupByDifficulty(mockItems)
    }, 100)
  )
  
  // Benchmark 13: Balance by difficulty
  results.push(
    benchmark('Balance by Difficulty', () => {
      difficultyCalculator.balanceByDifficulty(mockItems, 20)
    }, 100)
  )
  
  // Benchmark 14: Calculate progress
  results.push(
    benchmark('Calculate Progress', () => {
      integration.calculateProgress(singleItem)
    })
  )
  
  // Benchmark 15: Get review queue
  results.push(
    benchmark('Get Review Queue', () => {
      integration.getReviewQueue(mockItems, 20)
    }, 100)
  )
  
  // Benchmark 16: Get forecast
  results.push(
    benchmark('Get 7-Day Forecast', () => {
      integration.getForecast(mockItems, 7)
    }, 100)
  )
  
  // Print results
  reviewLogger.info('📊 Benchmark Results:\n')
  reviewLogger.info('Target: < 10ms for p95 latency\n')
  
  const table: any[] = []
  let allPassed = true
  
  for (const result of results) {
    table.push({
      'Test': result.name,
      'Avg (ms)': result.avgTime.toFixed(3),
      'Min (ms)': result.minTime.toFixed(3),
      'Max (ms)': result.maxTime.toFixed(3),
      'P95 (ms)': result.p95Time.toFixed(3),
      'P99 (ms)': result.p99Time.toFixed(3),
      'Status': result.passed ? '✅ PASS' : '❌ FAIL'
    })
    
    if (!result.passed) {
      allPassed = false
    }
  }
  
  // Using console.table for test output - provides clear tabular display
  console.table(table)
  
  // Summary
  reviewLogger.info('\n📈 Summary:')
  const passedCount = results.filter(r => r.passed).length
  reviewLogger.info(`  Passed: ${passedCount}/${results.length} tests`)
  
  const avgP95 = results.reduce((sum, r) => sum + r.p95Time, 0) / results.length
  reviewLogger.info(`  Average P95: ${avgP95.toFixed(3)}ms`)
  
  const maxP95 = Math.max(...results.map(r => r.p95Time))
  reviewLogger.info(`  Max P95: ${maxP95.toFixed(3)}ms`)
  
  if (allPassed) {
    reviewLogger.info('\n✨ All benchmarks passed! Performance requirements met.')
  } else {
    reviewLogger.info('\n⚠️  Some benchmarks failed. Optimization needed.')
    reviewLogger.info('\nFailed tests:')
    results
      .filter(r => !r.passed)
      .forEach(r => {
        reviewLogger.info(`  - ${r.name}: P95 = ${r.p95Time.toFixed(3)}ms (target: < 10ms)`)
      })
  }
}

/**
 * Run stress test with large dataset
 */
export function runStressTest(): void {
  reviewLogger.info('\n🔥 Running Stress Test...\n')
  
  const algorithm = new SRSAlgorithm()
  const stateManager = new SRSStateManager(algorithm)
  const integration = new SRSIntegration(algorithm, stateManager)
  
  // Test with increasing item counts
  const itemCounts = [100, 500, 1000, 5000, 10000]
  
  for (const count of itemCounts) {
    const items = createMockItems(count)
    
    const start = performance.now()
    const queue = integration.getReviewQueue(items, 50)
    const stats = stateManager.getCollectionStats(items)
    const forecast = integration.getForecast(items, 30)
    const end = performance.now()
    
    const totalTime = end - start
    reviewLogger.info(`${count} items: ${totalTime.toFixed(2)}ms`)
    reviewLogger.info(`  - Queue size: ${queue.length}`)
    reviewLogger.info(`  - Due items: ${stats.due}`)
    reviewLogger.info(`  - Forecast days: ${forecast.size}`)
  }
}

/**
 * Run memory usage test
 */
export function runMemoryTest(): void {
  reviewLogger.info('\n💾 Running Memory Test...\n')
  
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const initialMemory = process.memoryUsage()
    
    // Create large dataset
    const items = createMockItems(10000)
    const algorithm = new SRSAlgorithm()
    const stateManager = new SRSStateManager(algorithm)
    
    // Process all items
    for (const item of items) {
      stateManager.updateItemState(item, {
        correct: Math.random() > 0.3,
        responseTime: Math.random() * 5000
      })
    }
    
    const finalMemory = process.memoryUsage()
    
    reviewLogger.info('Memory Usage:')
    reviewLogger.info(`  Heap Used: ${((finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024).toFixed(2)} MB`)
    reviewLogger.info(`  RSS: ${((finalMemory.rss - initialMemory.rss) / 1024 / 1024).toFixed(2)} MB`)
    reviewLogger.info(`  Items per MB: ${(10000 / ((finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024)).toFixed(0)}`)
  } else {
    reviewLogger.info('Memory testing not available in browser environment')
  }
}

// Run benchmarks if this file is executed directly
if (require.main === module) {
  runBenchmarks()
  runStressTest()
  runMemoryTest()
}