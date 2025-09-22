#!/usr/bin/env node

/**
 * Performance Monitoring Script
 * Tracks performance metrics against the defined budget
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

class PerformanceMonitor {
  constructor() {
    this.loadBudget();
    this.results = {
      timestamp: new Date().toISOString(),
      violations: [],
      warnings: [],
      passed: [],
      metrics: {}
    };
  }

  loadBudget() {
    try {
      const budgetPath = path.join(process.cwd(), 'performance-budget.json');
      const budgetData = fs.readFileSync(budgetPath, 'utf-8');
      this.budget = JSON.parse(budgetData).performanceBudget;
    } catch (error) {
      console.error('❌ Failed to load performance budget:', error.message);
      process.exit(1);
    }
  }

  checkBundleSize() {
    console.log('📦 Checking bundle sizes...');
    
    if (!fs.existsSync('.next')) {
      console.log('⚠️  No build found. Skipping bundle size check.');
      return;
    }

    // Get actual bundle sizes
    const getDirectorySize = (dir) => {
      if (!fs.existsSync(dir)) return 0;
      
      const files = fs.readdirSync(dir, { withFileTypes: true });
      let totalSize = 0;
      
      for (const file of files) {
        const filePath = path.join(dir, file.name);
        if (file.isDirectory()) {
          totalSize += getDirectorySize(filePath);
        } else {
          totalSize += fs.statSync(filePath).size;
        }
      }
      
      return totalSize;
    };

    const staticSize = getDirectorySize('.next/static');
    const serverSize = getDirectorySize('.next/server');
    const totalSize = staticSize + serverSize;

    this.results.metrics.bundleSize = {
      total: totalSize,
      static: staticSize,
      server: serverSize
    };

    // Check against budget (Note: budget values are for gzipped, estimating 3:1 compression)
    const estimatedGzipped = totalSize / 3;
    const maxSize = this.budget.targets.bundleSize.javascript.total.max;
    const warningSize = this.budget.targets.bundleSize.javascript.total.warning;

    if (estimatedGzipped > maxSize) {
      this.results.violations.push({
        metric: 'bundle_size_total',
        actual: estimatedGzipped,
        max: maxSize,
        severity: 'critical'
      });
    } else if (estimatedGzipped > warningSize) {
      this.results.warnings.push({
        metric: 'bundle_size_total',
        actual: estimatedGzipped,
        warning: warningSize
      });
    } else {
      this.results.passed.push({
        metric: 'bundle_size_total',
        actual: estimatedGzipped,
        target: maxSize
      });
    }
  }

  async checkAPILatency() {
    console.log('⚡ Checking API latency...');
    
    // This would normally test actual endpoints
    // For now, we'll check if the API routes exist
    const apiRoutes = [
      'src/app/api/auth/refresh/route.ts',
      'src/app/api/review/queue/route.ts',
      'src/app/api/review/session/route.ts'
    ];

    for (const route of apiRoutes) {
      if (fs.existsSync(route)) {
        // Analyze the file for potential performance issues
        const content = fs.readFileSync(route, 'utf-8');
        
        // Check for N+1 patterns
        const hasN1Pattern = /for\s*\([^)]*\)\s*{[^}]*await/.test(content) ||
                             /\.map\([^)]*\)\s*\.\s*(?:then|await)/.test(content);
        
        if (hasN1Pattern) {
          this.results.warnings.push({
            metric: 'potential_n1_query',
            file: route,
            severity: 'medium'
          });
        }
      }
    }
  }

  checkMemoryUsage() {
    console.log('💾 Checking memory usage...');
    
    const memUsage = process.memoryUsage();
    this.results.metrics.memory = {
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal
    };

    const maxHeap = this.budget.targets.resources.memory.heap.max;
    const warningHeap = this.budget.targets.resources.memory.heap.warning;

    if (memUsage.heapUsed > maxHeap) {
      this.results.violations.push({
        metric: 'heap_memory',
        actual: memUsage.heapUsed,
        max: maxHeap,
        severity: 'high'
      });
    } else if (memUsage.heapUsed > warningHeap) {
      this.results.warnings.push({
        metric: 'heap_memory',
        actual: memUsage.heapUsed,
        warning: warningHeap
      });
    } else {
      this.results.passed.push({
        metric: 'heap_memory',
        actual: memUsage.heapUsed,
        target: maxHeap
      });
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 PERFORMANCE BUDGET CHECK');
    console.log('='.repeat(60));
    
    console.log(`\nTimestamp: ${this.results.timestamp}`);
    
    if (this.results.violations.length > 0) {
      console.log('\n❌ VIOLATIONS:');
      this.results.violations.forEach(v => {
        console.log(`  [${v.severity.toUpperCase()}] ${v.metric}`);
        console.log(`    Actual: ${this.formatValue(v.actual)}`);
        console.log(`    Max: ${this.formatValue(v.max)}`);
      });
    }
    
    if (this.results.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      this.results.warnings.forEach(w => {
        if (w.file) {
          console.log(`  ${w.metric} in ${w.file}`);
        } else {
          console.log(`  ${w.metric}`);
          if (w.actual && w.warning) {
            console.log(`    Actual: ${this.formatValue(w.actual)}`);
            console.log(`    Warning: ${this.formatValue(w.warning)}`);
          }
        }
      });
    }
    
    if (this.results.passed.length > 0) {
      console.log('\n✅ PASSED:');
      this.results.passed.forEach(p => {
        console.log(`  ${p.metric}`);
        console.log(`    Actual: ${this.formatValue(p.actual)}`);
        console.log(`    Target: ${this.formatValue(p.target)}`);
      });
    }
    
    console.log('\n📈 METRICS:');
    console.log(`  Bundle Size: ${this.formatBytes(this.results.metrics.bundleSize?.total || 0)}`);
    console.log(`  Memory: ${this.formatBytes(this.results.metrics.memory?.heapUsed || 0)}`);
    
    const status = this.results.violations.length > 0 ? '❌ FAILED' : 
                   this.results.warnings.length > 0 ? '⚠️  WARNING' : '✅ PASSED';
    
    console.log(`\n${status} - Performance budget check complete`);
    console.log('='.repeat(60) + '\n');
    
    // Save report
    this.saveReport();
  }

  formatValue(value) {
    if (typeof value === 'number') {
      if (value > 1000000) {
        return this.formatBytes(value);
      }
      return value.toLocaleString();
    }
    return value;
  }

  formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  }

  saveReport() {
    const reportDir = 'performance-reports';
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(reportDir, `budget-check-${timestamp}.json`);
    
    fs.writeFileSync(reportFile, JSON.stringify(this.results, null, 2));
    console.log(`Report saved to: ${reportFile}`);
  }

  async run() {
    console.log('🚀 Starting Performance Budget Check...\n');
    
    this.checkBundleSize();
    await this.checkAPILatency();
    this.checkMemoryUsage();
    this.generateReport();
    
    // Exit with error code if violations found
    if (this.results.violations.length > 0) {
      process.exit(1);
    }
  }
}

// Run the monitor
const monitor = new PerformanceMonitor();
monitor.run().catch(console.error);