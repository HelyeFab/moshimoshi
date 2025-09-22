#!/usr/bin/env node

/**
 * Performance Baseline Script - Week 2 Day 1
 * Agent 3: Performance Optimization Lead
 * 
 * This script establishes baseline performance metrics for:
 * - API response times
 * - Bundle sizes
 * - Memory usage
 * - Database query performance
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class PerformanceProfiler {
  constructor() {
    this.metrics = {
      timestamp: new Date().toISOString(),
      bundleSize: {},
      apiEndpoints: {},
      memoryUsage: {},
      buildTime: null,
      dependencies: {}
    };
  }

  // Analyze bundle size
  analyzeBundleSize() {
    console.log('📊 Analyzing bundle sizes...');
    
    try {
      // Check if .next directory exists
      if (!fs.existsSync('.next')) {
        console.log('⚠️  No .next directory found. Running build...');
        const startTime = Date.now();
        execSync('npm run build', { stdio: 'inherit' });
        this.metrics.buildTime = Date.now() - startTime;
      }

      // Get size of .next directory
      const nextSize = execSync('du -sh .next', { encoding: 'utf-8' });
      this.metrics.bundleSize.total = nextSize.trim().split('\t')[0];

      // Check static files
      if (fs.existsSync('.next/static')) {
        const staticSize = execSync('du -sh .next/static', { encoding: 'utf-8' });
        this.metrics.bundleSize.static = staticSize.trim().split('\t')[0];
      }

      // Check server files
      if (fs.existsSync('.next/server')) {
        const serverSize = execSync('du -sh .next/server', { encoding: 'utf-8' });
        this.metrics.bundleSize.server = serverSize.trim().split('\t')[0];
      }

      // Analyze chunk sizes
      const chunks = execSync('find .next/static/chunks -name "*.js" -exec ls -lh {} \\; 2>/dev/null || true', { encoding: 'utf-8' });
      const chunkLines = chunks.split('\n').filter(line => line.includes('.js'));
      
      this.metrics.bundleSize.chunks = chunkLines.slice(0, 10).map(line => {
        const parts = line.split(/\s+/);
        if (parts.length >= 9) {
          return {
            file: path.basename(parts[8]),
            size: parts[4]
          };
        }
        return null;
      }).filter(Boolean);

    } catch (error) {
      console.error('❌ Bundle analysis failed:', error.message);
      this.metrics.bundleSize.error = error.message;
    }
  }

  // Profile API endpoints
  async profileAPIEndpoints() {
    console.log('🔍 Profiling API endpoints...');
    
    const apiRoutes = [
      '/api/auth/refresh',
      '/api/user/profile',
      '/api/admin/stats',
      '/api/lessons/progress',
      '/api/review/session',
      '/api/review/queue'
    ];

    // Note: This is a placeholder. In production, we'd actually test these endpoints
    apiRoutes.forEach(route => {
      this.metrics.apiEndpoints[route] = {
        status: 'not_tested',
        note: 'Requires running server for actual profiling'
      };
    });
  }

  // Check memory usage
  checkMemoryUsage() {
    console.log('💾 Checking memory usage...');
    
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage = {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
    };
  }

  // Analyze dependencies
  analyzeDependencies() {
    console.log('📦 Analyzing dependencies...');
    
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
      
      this.metrics.dependencies = {
        production: Object.keys(packageJson.dependencies || {}).length,
        development: Object.keys(packageJson.devDependencies || {}).length,
        total: Object.keys({...packageJson.dependencies, ...packageJson.devDependencies}).length
      };

      // Check for large dependencies
      const largeDeps = [
        'firebase', 'firebase-admin', '@stripe/stripe-js', 
        'next', 'react', 'react-dom', '@mui/material'
      ];

      this.metrics.dependencies.large = largeDeps.filter(dep => 
        packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep]
      );

    } catch (error) {
      console.error('❌ Dependency analysis failed:', error.message);
      this.metrics.dependencies.error = error.message;
    }
  }

  // Identify potential bottlenecks
  identifyBottlenecks() {
    console.log('🔥 Identifying potential bottlenecks...');
    
    this.metrics.bottlenecks = [];

    // Check for large bundle size
    if (this.metrics.bundleSize.total && 
        parseInt(this.metrics.bundleSize.total) > 50) {
      this.metrics.bottlenecks.push({
        type: 'bundle_size',
        severity: 'high',
        description: `Total bundle size is ${this.metrics.bundleSize.total}, target is <50MB`
      });
    }

    // Check for too many dependencies
    if (this.metrics.dependencies.total > 100) {
      this.metrics.bottlenecks.push({
        type: 'dependencies',
        severity: 'medium',
        description: `${this.metrics.dependencies.total} total dependencies, consider reducing`
      });
    }

    // Check build time
    if (this.metrics.buildTime && this.metrics.buildTime > 60000) {
      this.metrics.bottlenecks.push({
        type: 'build_time',
        severity: 'medium',
        description: `Build time is ${Math.round(this.metrics.buildTime / 1000)}s, target is <60s`
      });
    }

    // Scan for potential N+1 query patterns
    this.scanForN1Queries();
  }

  // Scan for N+1 query patterns
  scanForN1Queries() {
    console.log('🔍 Scanning for N+1 query patterns...');
    
    const patterns = [
      /\.map\([^)]*\)\s*\.\s*(?:then|await)/g,
      /for\s*\([^)]*\)\s*{[^}]*await/g,
      /forEach\([^)]*\)\s*{[^}]*await/g
    ];

    const suspiciousFiles = [];

    try {
      const files = execSync('find src -name "*.ts" -o -name "*.tsx" 2>/dev/null', { encoding: 'utf-8' })
        .split('\n')
        .filter(Boolean);

      files.forEach(file => {
        try {
          const content = fs.readFileSync(file, 'utf-8');
          patterns.forEach(pattern => {
            if (pattern.test(content)) {
              suspiciousFiles.push(file);
            }
          });
        } catch (e) {
          // Skip files that can't be read
        }
      });

      if (suspiciousFiles.length > 0) {
        this.metrics.bottlenecks.push({
          type: 'n_plus_1_queries',
          severity: 'high',
          description: `Potential N+1 queries found in ${suspiciousFiles.length} files`,
          files: suspiciousFiles.slice(0, 5)
        });
      }

    } catch (error) {
      console.error('❌ N+1 query scan failed:', error.message);
    }
  }

  // Generate performance budget
  generatePerformanceBudget() {
    console.log('💰 Generating performance budget...');
    
    this.metrics.performanceBudget = {
      targets: {
        api_response_p95: '100ms',
        queue_generation: '50ms',
        session_creation: '200ms',
        bundle_size_gzipped: '200KB',
        memory_per_session: '100MB',
        build_time: '60s',
        first_contentful_paint: '1.5s',
        time_to_interactive: '3s',
        cumulative_layout_shift: 0.1,
        largest_contentful_paint: '2.5s'
      },
      current: {
        bundle_size_total: this.metrics.bundleSize.total,
        memory_used: this.metrics.memoryUsage.heapUsed,
        build_time: this.metrics.buildTime ? `${Math.round(this.metrics.buildTime / 1000)}s` : 'not measured',
        dependencies: this.metrics.dependencies.total
      }
    };
  }

  // Save report
  saveReport() {
    const reportDir = 'performance-reports';
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(reportDir, `baseline-${timestamp}.json`);
    
    fs.writeFileSync(reportFile, JSON.stringify(this.metrics, null, 2));
    console.log(`\n✅ Performance baseline saved to: ${reportFile}`);

    // Also save as latest
    fs.writeFileSync(path.join(reportDir, 'latest-baseline.json'), JSON.stringify(this.metrics, null, 2));

    // Generate summary
    this.printSummary();
  }

  // Print summary
  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 PERFORMANCE BASELINE SUMMARY');
    console.log('='.repeat(60));
    
    console.log('\n📦 Bundle Size:');
    console.log(`  Total: ${this.metrics.bundleSize.total || 'N/A'}`);
    console.log(`  Static: ${this.metrics.bundleSize.static || 'N/A'}`);
    console.log(`  Server: ${this.metrics.bundleSize.server || 'N/A'}`);
    
    console.log('\n💾 Memory Usage:');
    console.log(`  Heap Used: ${this.metrics.memoryUsage.heapUsed}`);
    console.log(`  RSS: ${this.metrics.memoryUsage.rss}`);
    
    console.log('\n📦 Dependencies:');
    console.log(`  Production: ${this.metrics.dependencies.production}`);
    console.log(`  Development: ${this.metrics.dependencies.development}`);
    console.log(`  Total: ${this.metrics.dependencies.total}`);
    
    if (this.metrics.bottlenecks && this.metrics.bottlenecks.length > 0) {
      console.log('\n🔥 Identified Bottlenecks:');
      this.metrics.bottlenecks.forEach(b => {
        console.log(`  [${b.severity.toUpperCase()}] ${b.type}: ${b.description}`);
      });
    }

    console.log('\n🎯 Performance Targets:');
    console.log('  API Response (p95): <100ms');
    console.log('  Bundle Size (gzipped): <200KB');
    console.log('  Memory per Session: <100MB');
    console.log('  Build Time: <60s');
    
    console.log('\n' + '='.repeat(60));
  }

  // Run all profiling
  async run() {
    console.log('🚀 Starting Performance Baseline Analysis...\n');
    
    this.analyzeBundleSize();
    await this.profileAPIEndpoints();
    this.checkMemoryUsage();
    this.analyzeDependencies();
    this.identifyBottlenecks();
    this.generatePerformanceBudget();
    this.saveReport();
    
    console.log('\n✨ Performance baseline analysis complete!');
  }
}

// Run the profiler
const profiler = new PerformanceProfiler();
profiler.run().catch(console.error);