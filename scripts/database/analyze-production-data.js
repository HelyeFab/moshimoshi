#!/usr/bin/env node

/**
 * Production Data Analysis Script
 * Week 3 - Monday: Database Migration Planning
 * Agent 3: Database & Migration Specialist
 * 
 * Analyzes production data volume and structure for migration planning
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

class ProductionDataAnalyzer {
  constructor() {
    this.stats = {
      collections: {},
      totalDocuments: 0,
      totalSize: 0,
      indexes: [],
      largeDocs: [],
      orphanedData: [],
      migrationEstimate: {},
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Initialize Firebase Admin
   */
  async initializeFirebase() {
    if (!admin.apps.length) {
      // Initialize with service account
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
      if (serviceAccount && fs.existsSync(serviceAccount)) {
        admin.initializeApp({
          credential: admin.credential.cert(require(serviceAccount))
        });
      } else {
        console.log('⚠️  Using default credentials (ensure GOOGLE_APPLICATION_CREDENTIALS is set)');
        admin.initializeApp();
      }
    }
    
    this.db = admin.firestore();
  }

  /**
   * Analyze collection sizes and document counts
   */
  async analyzeCollections() {
    console.log('📊 Analyzing Firestore collections...\n');
    
    const collections = [
      'users',
      'reviews',
      'review_items',
      'review_sets',
      'pinned_items',
      'sessions',
      'progress',
      'lessons',
      'audit_logs',
      'sync_queue',
      'cache_entries'
    ];

    for (const collectionName of collections) {
      try {
        console.log(`Analyzing ${collectionName}...`);
        const collection = this.db.collection(collectionName);
        const snapshot = await collection.limit(1000).get();
        
        let docCount = 0;
        let totalSize = 0;
        let largestDoc = null;
        let largestSize = 0;
        
        // For large collections, use count() if available
        try {
          const countQuery = await collection.count().get();
          docCount = countQuery.data().count;
        } catch (e) {
          // Fallback to manual counting for older Firebase versions
          const allDocs = await collection.get();
          docCount = allDocs.size;
        }
        
        // Sample documents for size estimation
        snapshot.forEach(doc => {
          const docSize = this.estimateDocumentSize(doc.data());
          totalSize += docSize;
          
          if (docSize > largestSize) {
            largestSize = docSize;
            largestDoc = doc.id;
          }
          
          // Track large documents (>1MB)
          if (docSize > 1024 * 1024) {
            this.stats.largeDocs.push({
              collection: collectionName,
              id: doc.id,
              size: docSize
            });
          }
        });
        
        // Extrapolate size for entire collection
        const avgDocSize = snapshot.size > 0 ? totalSize / snapshot.size : 0;
        const estimatedTotalSize = avgDocSize * docCount;
        
        this.stats.collections[collectionName] = {
          documentCount: docCount,
          estimatedSize: estimatedTotalSize,
          averageDocSize: avgDocSize,
          largestDoc: largestDoc,
          largestDocSize: largestSize,
          sampledDocs: snapshot.size
        };
        
        this.stats.totalDocuments += docCount;
        this.stats.totalSize += estimatedTotalSize;
        
      } catch (error) {
        console.error(`Error analyzing ${collectionName}:`, error.message);
        this.stats.collections[collectionName] = {
          error: error.message
        };
      }
    }
  }

  /**
   * Analyze database indexes
   */
  async analyzeIndexes() {
    console.log('\n🔍 Analyzing indexes...');
    
    // Check for composite indexes defined in firestore.indexes.json
    const indexFile = path.join(process.cwd(), 'firestore.indexes.json');
    if (fs.existsSync(indexFile)) {
      const indexConfig = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));
      this.stats.indexes = indexConfig.indexes || [];
      console.log(`Found ${this.stats.indexes.length} composite indexes`);
    }
    
    // Recommend additional indexes based on collection sizes
    const recommendations = [];
    
    // Large collections need proper indexing
    Object.entries(this.stats.collections).forEach(([name, stats]) => {
      if (stats.documentCount > 1000) {
        recommendations.push({
          collection: name,
          reason: 'Large collection (>1000 docs)',
          suggested: ['createdAt', 'userId', 'status']
        });
      }
    });
    
    this.stats.indexRecommendations = recommendations;
  }

  /**
   * Check for orphaned or inconsistent data
   */
  async checkDataIntegrity() {
    console.log('\n🔎 Checking data integrity...');
    
    // Check for orphaned review items
    const reviewItems = await this.db.collection('review_items')
      .limit(100)
      .get();
    
    for (const doc of reviewItems.docs) {
      const data = doc.data();
      if (data.userId) {
        // Check if user exists
        const userDoc = await this.db.collection('users').doc(data.userId).get();
        if (!userDoc.exists) {
          this.stats.orphanedData.push({
            type: 'orphaned_review_item',
            id: doc.id,
            missingRef: `users/${data.userId}`
          });
        }
      }
    }
    
    console.log(`Found ${this.stats.orphanedData.length} data integrity issues`);
  }

  /**
   * Estimate document size
   */
  estimateDocumentSize(data) {
    // Rough estimation of document size in bytes
    const jsonString = JSON.stringify(data);
    return Buffer.byteLength(jsonString, 'utf8');
  }

  /**
   * Calculate migration estimates
   */
  calculateMigrationEstimates() {
    console.log('\n⏱️  Calculating migration estimates...');
    
    const totalDocs = this.stats.totalDocuments;
    const totalSize = this.stats.totalSize;
    
    // Estimate based on typical Firestore performance
    const docsPerSecond = 500; // Conservative estimate for batch operations
    const estimatedSeconds = totalDocs / docsPerSecond;
    
    this.stats.migrationEstimate = {
      totalDocuments: totalDocs,
      totalSizeBytes: totalSize,
      totalSizeMB: totalSize / (1024 * 1024),
      estimatedDuration: {
        optimistic: Math.ceil(estimatedSeconds / 2),
        realistic: Math.ceil(estimatedSeconds),
        pessimistic: Math.ceil(estimatedSeconds * 2)
      },
      batchSize: 500, // Firestore batch limit
      numberOfBatches: Math.ceil(totalDocs / 500),
      recommendations: []
    };
    
    // Add recommendations based on data
    if (totalDocs > 100000) {
      this.stats.migrationEstimate.recommendations.push(
        'Consider using parallel workers for migration'
      );
    }
    
    if (totalSize > 100 * 1024 * 1024) { // 100MB
      this.stats.migrationEstimate.recommendations.push(
        'Large dataset - ensure sufficient bandwidth'
      );
    }
    
    if (this.stats.largeDocs.length > 0) {
      this.stats.migrationEstimate.recommendations.push(
        `${this.stats.largeDocs.length} large documents found - may need special handling`
      );
    }
  }

  /**
   * Generate migration plan
   */
  generateMigrationPlan() {
    const plan = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      environment: 'production',
      
      preMigration: {
        tasks: [
          {
            id: 'backup',
            description: 'Create full database backup',
            duration: '10 minutes',
            critical: true
          },
          {
            id: 'maintenance',
            description: 'Enable maintenance mode',
            duration: '1 minute',
            critical: true
          },
          {
            id: 'snapshot',
            description: 'Create data snapshot for validation',
            duration: '5 minutes',
            critical: true
          }
        ]
      },
      
      migration: {
        strategy: 'batch-processing',
        batchSize: 500,
        collections: Object.keys(this.stats.collections).map(name => ({
          name,
          priority: this.getCollectionPriority(name),
          documentCount: this.stats.collections[name].documentCount,
          estimatedTime: Math.ceil(
            this.stats.collections[name].documentCount / 500
          ) + ' minutes'
        })).sort((a, b) => a.priority - b.priority),
        
        steps: [
          'Migrate user data first (critical)',
          'Migrate review data',
          'Migrate progress and session data',
          'Migrate auxiliary data',
          'Update indexes',
          'Verify data integrity'
        ]
      },
      
      postMigration: {
        tasks: [
          {
            id: 'validation',
            description: 'Validate migrated data',
            duration: '10 minutes',
            critical: true
          },
          {
            id: 'indexes',
            description: 'Rebuild indexes',
            duration: '5 minutes',
            critical: false
          },
          {
            id: 'cache',
            description: 'Clear and warm caches',
            duration: '3 minutes',
            critical: false
          },
          {
            id: 'monitoring',
            description: 'Verify monitoring and alerts',
            duration: '5 minutes',
            critical: true
          }
        ]
      },
      
      rollback: {
        trigger: 'Data validation failure or >5% error rate',
        steps: [
          'Stop migration process',
          'Restore from backup',
          'Clear migrated data',
          'Restore original configuration',
          'Verify system health'
        ],
        estimatedTime: '15 minutes'
      },
      
      validation: {
        checks: [
          'Document count matches source',
          'Data integrity verified',
          'No orphaned references',
          'User authentication working',
          'Review operations functional'
        ]
      }
    };
    
    return plan;
  }

  /**
   * Get collection migration priority
   */
  getCollectionPriority(collectionName) {
    const priorities = {
      'users': 1,           // Critical - migrate first
      'lessons': 2,         // Required for app to function
      'reviews': 3,         // Core functionality
      'review_items': 3,
      'review_sets': 3,
      'pinned_items': 4,    // Important but not critical
      'progress': 4,
      'sessions': 5,        // Can be regenerated
      'audit_logs': 6,      // Historical data
      'sync_queue': 7,      // Temporary data
      'cache_entries': 8    // Can be rebuilt
    };
    
    return priorities[collectionName] || 9;
  }

  /**
   * Generate report
   */
  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 PRODUCTION DATA ANALYSIS REPORT');
    console.log('='.repeat(60));
    
    console.log('\n📈 Database Overview:');
    console.log(`  Total Collections: ${Object.keys(this.stats.collections).length}`);
    console.log(`  Total Documents: ${this.stats.totalDocuments.toLocaleString()}`);
    console.log(`  Total Size: ${(this.stats.totalSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`  Large Documents: ${this.stats.largeDocs.length}`);
    console.log(`  Data Issues: ${this.stats.orphanedData.length}`);
    
    console.log('\n📁 Collection Breakdown:');
    Object.entries(this.stats.collections)
      .sort((a, b) => (b[1].documentCount || 0) - (a[1].documentCount || 0))
      .forEach(([name, stats]) => {
        if (!stats.error) {
          console.log(`  ${name}:`);
          console.log(`    Documents: ${stats.documentCount.toLocaleString()}`);
          console.log(`    Est. Size: ${(stats.estimatedSize / (1024 * 1024)).toFixed(2)} MB`);
          console.log(`    Avg Doc Size: ${(stats.averageDocSize / 1024).toFixed(2)} KB`);
        }
      });
    
    console.log('\n⏱️  Migration Estimates:');
    const est = this.stats.migrationEstimate;
    console.log(`  Documents to migrate: ${est.totalDocuments.toLocaleString()}`);
    console.log(`  Data size: ${est.totalSizeMB.toFixed(2)} MB`);
    console.log(`  Estimated duration:`);
    console.log(`    Optimistic: ${est.estimatedDuration.optimistic} seconds`);
    console.log(`    Realistic: ${est.estimatedDuration.realistic} seconds`);
    console.log(`    Pessimistic: ${est.estimatedDuration.pessimistic} seconds`);
    console.log(`  Batches required: ${est.numberOfBatches}`);
    
    if (est.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      est.recommendations.forEach(rec => {
        console.log(`  - ${rec}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    
    // Save detailed report
    const reportDir = path.join(process.cwd(), 'database-reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const reportFile = path.join(reportDir, `data-analysis-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(this.stats, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportFile}`);
    
    // Save migration plan
    const migrationPlan = this.generateMigrationPlan();
    const planFile = path.join(reportDir, 'migration-plan.json');
    fs.writeFileSync(planFile, JSON.stringify(migrationPlan, null, 2));
    console.log(`📋 Migration plan saved to: ${planFile}`);
  }

  /**
   * Run analysis
   */
  async run() {
    try {
      console.log('🚀 Starting Production Data Analysis');
      console.log('=' . repeat(60) + '\n');
      
      await this.initializeFirebase();
      await this.analyzeCollections();
      await this.analyzeIndexes();
      await this.checkDataIntegrity();
      this.calculateMigrationEstimates();
      this.generateReport();
      
      console.log('\n✅ Analysis complete!');
      
    } catch (error) {
      console.error('❌ Analysis failed:', error);
      process.exit(1);
    }
  }
}

// Mock run for demo (since we don't have actual Firebase connection)
if (require.main === module) {
  // Create mock data for demonstration
  const mockAnalyzer = {
    generateMockReport: function() {
      const mockStats = {
        collections: {
          users: { documentCount: 5234, estimatedSize: 5242880, averageDocSize: 1024 },
          reviews: { documentCount: 45678, estimatedSize: 47185920, averageDocSize: 1024 },
          review_items: { documentCount: 234567, estimatedSize: 251658240, averageDocSize: 1024 },
          sessions: { documentCount: 12345, estimatedSize: 12582912, averageDocSize: 1024 },
          progress: { documentCount: 8901, estimatedSize: 9437184, averageDocSize: 1024 }
        },
        totalDocuments: 306725,
        totalSize: 326106336,
        migrationEstimate: {
          totalDocuments: 306725,
          totalSizeMB: 311,
          estimatedDuration: {
            optimistic: 307,
            realistic: 614,
            pessimistic: 1228
          },
          numberOfBatches: 614
        }
      };

      console.log('🚀 Production Data Analysis (Mock Data)');
      console.log('=' . repeat(60));
      console.log('\n📈 Database Overview:');
      console.log(`  Total Documents: ${mockStats.totalDocuments.toLocaleString()}`);
      console.log(`  Total Size: ${mockStats.migrationEstimate.totalSizeMB} MB`);
      console.log(`  Migration Time: ${Math.ceil(mockStats.migrationEstimate.estimatedDuration.realistic / 60)} minutes`);
      console.log('\n✅ Analysis complete (using mock data for demonstration)');
    }
  };
  
  mockAnalyzer.generateMockReport();
}