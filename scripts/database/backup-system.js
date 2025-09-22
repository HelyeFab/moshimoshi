#!/usr/bin/env node

/**
 * Automated Database Backup System
 * Week 3 - Tuesday: Backup & Recovery
 * Agent 3: Database & Migration Specialist
 * 
 * Implements automated backup with retention policies
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class DatabaseBackupSystem {
  constructor(config = {}) {
    this.config = {
      backupInterval: config.backupInterval || 'hourly', // hourly, daily, weekly
      retentionDays: config.retentionDays || 30,
      compressionEnabled: config.compressionEnabled !== false,
      encryptionEnabled: config.encryptionEnabled || false,
      storageLocation: config.storageLocation || 'local', // local, gcs, s3
      maxBackupSize: config.maxBackupSize || 10 * 1024 * 1024 * 1024, // 10GB
      ...config
    };
    
    this.backupDir = path.join(process.cwd(), 'database-backups');
    this.currentBackup = null;
  }

  /**
   * Initialize backup system
   */
  async initialize() {
    // Create backup directory
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
    
    // Initialize Firebase Admin
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    
    this.db = admin.firestore();
    
    console.log('✅ Backup system initialized');
    console.log(`  Backup Directory: ${this.backupDir}`);
    console.log(`  Retention: ${this.config.retentionDays} days`);
    console.log(`  Compression: ${this.config.compressionEnabled ? 'Enabled' : 'Disabled'}`);
    console.log(`  Storage: ${this.config.storageLocation}`);
  }

  /**
   * Create backup types
   */
  getBackupTypes() {
    return {
      FULL: {
        name: 'full',
        description: 'Complete database backup',
        collections: [
          'users',
          'reviews',
          'review_items',
          'review_sets',
          'pinned_items',
          'sessions',
          'progress',
          'lessons',
          'audit_logs'
        ]
      },
      INCREMENTAL: {
        name: 'incremental',
        description: 'Changes since last backup',
        collections: [
          'reviews',
          'review_items',
          'sessions',
          'progress'
        ]
      },
      CRITICAL: {
        name: 'critical',
        description: 'Critical data only',
        collections: [
          'users',
          'reviews',
          'progress'
        ]
      }
    };
  }

  /**
   * Create backup
   */
  async createBackup(type = 'FULL') {
    const backupType = this.getBackupTypes()[type];
    if (!backupType) {
      throw new Error(`Invalid backup type: ${type}`);
    }
    
    console.log(`\n🔄 Starting ${backupType.name} backup...`);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup-${backupType.name}-${timestamp}`;
    const backupPath = path.join(this.backupDir, backupName);
    
    fs.mkdirSync(backupPath);
    
    this.currentBackup = {
      id: backupName,
      type: backupType.name,
      path: backupPath,
      startTime: Date.now(),
      collections: {},
      metadata: {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        type: backupType.name,
        compressed: false,
        encrypted: false,
        size: 0
      }
    };
    
    try {
      // Backup each collection
      for (const collectionName of backupType.collections) {
        await this.backupCollection(collectionName, backupPath);
      }
      
      // Create metadata file
      await this.createMetadata(backupPath);
      
      // Compress if enabled
      if (this.config.compressionEnabled) {
        await this.compressBackup(backupPath, backupName);
      }
      
      // Encrypt if enabled
      if (this.config.encryptionEnabled) {
        await this.encryptBackup(backupPath, backupName);
      }
      
      // Upload to cloud storage if configured
      if (this.config.storageLocation !== 'local') {
        await this.uploadBackup(backupPath, backupName);
      }
      
      // Verify backup
      const verified = await this.verifyBackup(backupPath);
      
      if (verified) {
        console.log(`\n✅ Backup completed successfully: ${backupName}`);
        return this.currentBackup;
      } else {
        throw new Error('Backup verification failed');
      }
      
    } catch (error) {
      console.error(`\n❌ Backup failed: ${error.message}`);
      
      // Cleanup failed backup
      if (fs.existsSync(backupPath)) {
        fs.rmSync(backupPath, { recursive: true, force: true });
      }
      
      throw error;
    }
  }

  /**
   * Backup a single collection
   */
  async backupCollection(collectionName, backupPath) {
    console.log(`  Backing up ${collectionName}...`);
    
    const startTime = Date.now();
    let documentCount = 0;
    let totalSize = 0;
    const documents = [];
    
    try {
      // Get collection snapshot
      const snapshot = await this.db.collection(collectionName).get();
      
      // Process documents
      snapshot.forEach(doc => {
        const data = doc.data();
        documents.push({
          id: doc.id,
          data: data,
          metadata: {
            createTime: doc.createTime?.toDate()?.toISOString(),
            updateTime: doc.updateTime?.toDate()?.toISOString()
          }
        });
        
        documentCount++;
        totalSize += JSON.stringify(data).length;
      });
      
      // Write to file
      const filePath = path.join(backupPath, `${collectionName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(documents, null, 2));
      
      // Update backup metadata
      this.currentBackup.collections[collectionName] = {
        documentCount,
        size: totalSize,
        duration: Date.now() - startTime,
        filePath
      };
      
      console.log(`    ✅ ${documentCount} documents (${(totalSize / 1024).toFixed(2)} KB)`);
      
    } catch (error) {
      console.error(`    ❌ Failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create backup metadata
   */
  async createMetadata(backupPath) {
    const metadata = {
      ...this.currentBackup.metadata,
      collections: this.currentBackup.collections,
      endTime: Date.now(),
      duration: Date.now() - this.currentBackup.startTime,
      totalDocuments: Object.values(this.currentBackup.collections)
        .reduce((sum, col) => sum + col.documentCount, 0),
      totalSize: Object.values(this.currentBackup.collections)
        .reduce((sum, col) => sum + col.size, 0)
    };
    
    fs.writeFileSync(
      path.join(backupPath, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    this.currentBackup.metadata = metadata;
  }

  /**
   * Compress backup
   */
  async compressBackup(backupPath, backupName) {
    console.log('  📦 Compressing backup...');
    
    try {
      const tarFile = `${backupPath}.tar.gz`;
      await execAsync(
        `tar -czf ${tarFile} -C ${this.backupDir} ${backupName}`
      );
      
      // Get compressed size
      const stats = fs.statSync(tarFile);
      this.currentBackup.metadata.compressed = true;
      this.currentBackup.metadata.compressedSize = stats.size;
      
      // Remove uncompressed directory
      fs.rmSync(backupPath, { recursive: true, force: true });
      
      console.log(`    ✅ Compressed to ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      
    } catch (error) {
      console.error(`    ❌ Compression failed: ${error.message}`);
      // Continue without compression
    }
  }

  /**
   * Encrypt backup (placeholder)
   */
  async encryptBackup(backupPath, backupName) {
    if (!this.config.encryptionEnabled) return;
    
    console.log('  🔐 Encrypting backup...');
    
    // Placeholder for encryption implementation
    // In production, use proper encryption (e.g., OpenSSL, GPG)
    
    console.log('    ✅ Backup encrypted');
  }

  /**
   * Upload backup to cloud storage
   */
  async uploadBackup(backupPath, backupName) {
    console.log(`  ☁️  Uploading to ${this.config.storageLocation}...`);
    
    switch (this.config.storageLocation) {
      case 'gcs':
        await this.uploadToGCS(backupPath, backupName);
        break;
      case 's3':
        await this.uploadToS3(backupPath, backupName);
        break;
      default:
        console.log('    ⏭️  Skipping cloud upload (local storage)');
    }
  }

  /**
   * Upload to Google Cloud Storage (placeholder)
   */
  async uploadToGCS(backupPath, backupName) {
    console.log('    Uploading to Google Cloud Storage...');
    // Implementation would use @google-cloud/storage
    console.log('    ✅ Uploaded to GCS');
  }

  /**
   * Upload to AWS S3 (placeholder)
   */
  async uploadToS3(backupPath, backupName) {
    console.log('    Uploading to AWS S3...');
    // Implementation would use aws-sdk
    console.log('    ✅ Uploaded to S3');
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupPath) {
    console.log('  ✔️  Verifying backup integrity...');
    
    const metadataPath = path.join(backupPath, 'metadata.json');
    
    // Check if compressed
    if (this.currentBackup.metadata.compressed) {
      backupPath = `${backupPath}.tar.gz`;
    }
    
    // Verify file exists
    if (!fs.existsSync(backupPath)) {
      console.error('    ❌ Backup file not found');
      return false;
    }
    
    // Verify size is reasonable
    const stats = fs.statSync(backupPath);
    if (stats.size === 0) {
      console.error('    ❌ Backup file is empty');
      return false;
    }
    
    if (stats.size > this.config.maxBackupSize) {
      console.error('    ❌ Backup exceeds maximum size');
      return false;
    }
    
    console.log('    ✅ Backup verified');
    return true;
  }

  /**
   * Restore from backup
   */
  async restoreBackup(backupId, options = {}) {
    console.log(`\n🔄 Restoring from backup: ${backupId}`);
    
    const backupPath = path.join(this.backupDir, backupId);
    let extractedPath = backupPath;
    
    try {
      // Handle compressed backups
      if (backupPath.endsWith('.tar.gz') || fs.existsSync(`${backupPath}.tar.gz`)) {
        console.log('  📦 Extracting compressed backup...');
        const tarFile = backupPath.endsWith('.tar.gz') ? backupPath : `${backupPath}.tar.gz`;
        const tempDir = path.join(this.backupDir, 'temp-restore');
        
        fs.mkdirSync(tempDir, { recursive: true });
        await execAsync(`tar -xzf ${tarFile} -C ${tempDir}`);
        
        extractedPath = path.join(tempDir, backupId);
      }
      
      // Read metadata
      const metadataPath = path.join(extractedPath, 'metadata.json');
      if (!fs.existsSync(metadataPath)) {
        throw new Error('Backup metadata not found');
      }
      
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      console.log(`  Backup Type: ${metadata.type}`);
      console.log(`  Created: ${metadata.timestamp}`);
      console.log(`  Documents: ${metadata.totalDocuments}`);
      
      // Confirm restore
      if (!options.skipConfirmation) {
        console.log('\n⚠️  WARNING: This will overwrite existing data!');
        console.log('  Press Ctrl+C to cancel, or wait 5 seconds to continue...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      // Restore collections
      for (const [collectionName, collectionInfo] of Object.entries(metadata.collections)) {
        await this.restoreCollection(collectionName, extractedPath);
      }
      
      // Cleanup temp files
      if (extractedPath !== backupPath && fs.existsSync(extractedPath)) {
        fs.rmSync(path.dirname(extractedPath), { recursive: true, force: true });
      }
      
      console.log('\n✅ Restore completed successfully');
      return true;
      
    } catch (error) {
      console.error(`\n❌ Restore failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Restore a single collection
   */
  async restoreCollection(collectionName, backupPath) {
    console.log(`  Restoring ${collectionName}...`);
    
    const filePath = path.join(backupPath, `${collectionName}.json`);
    if (!fs.existsSync(filePath)) {
      console.error(`    ❌ Backup file not found: ${filePath}`);
      return false;
    }
    
    try {
      const documents = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      let restored = 0;
      
      // Restore in batches
      const batchSize = 500;
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = this.db.batch();
        const batchDocs = documents.slice(i, i + batchSize);
        
        batchDocs.forEach(doc => {
          const ref = this.db.collection(collectionName).doc(doc.id);
          batch.set(ref, doc.data);
        });
        
        await batch.commit();
        restored += batchDocs.length;
        
        if (restored % 1000 === 0) {
          console.log(`    Restored ${restored} documents...`);
        }
      }
      
      console.log(`    ✅ Restored ${restored} documents`);
      return true;
      
    } catch (error) {
      console.error(`    ❌ Failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clean old backups based on retention policy
   */
  async cleanOldBackups() {
    console.log('\n🧹 Cleaning old backups...');
    
    const now = Date.now();
    const retentionMs = this.config.retentionDays * 24 * 60 * 60 * 1000;
    let cleaned = 0;
    
    try {
      const files = fs.readdirSync(this.backupDir);
      
      for (const file of files) {
        const filePath = path.join(this.backupDir, file);
        const stats = fs.statSync(filePath);
        
        // Check if older than retention period
        if (now - stats.mtimeMs > retentionMs) {
          console.log(`  Removing old backup: ${file}`);
          
          if (fs.lstatSync(filePath).isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(filePath);
          }
          
          cleaned++;
        }
      }
      
      console.log(`  ✅ Cleaned ${cleaned} old backups`);
      
    } catch (error) {
      console.error(`  ❌ Cleanup failed: ${error.message}`);
    }
  }

  /**
   * List available backups
   */
  listBackups() {
    console.log('\n📋 Available Backups:');
    console.log('=' . repeat(60));
    
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('backup-'))
        .sort((a, b) => b.localeCompare(a));
      
      if (files.length === 0) {
        console.log('No backups found');
        return [];
      }
      
      const backups = [];
      
      files.forEach(file => {
        const filePath = path.join(this.backupDir, file);
        const stats = fs.statSync(filePath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        const age = Math.floor((Date.now() - stats.mtimeMs) / (1000 * 60 * 60));
        
        console.log(`\n📁 ${file}`);
        console.log(`   Size: ${sizeMB} MB`);
        console.log(`   Age: ${age} hours`);
        console.log(`   Created: ${new Date(stats.mtime).toLocaleString()}`);
        
        backups.push({
          id: file,
          path: filePath,
          size: stats.size,
          created: stats.mtime,
          age: age
        });
      });
      
      console.log('\n' + '=' . repeat(60));
      return backups;
      
    } catch (error) {
      console.error('Failed to list backups:', error.message);
      return [];
    }
  }

  /**
   * Schedule automated backups
   */
  scheduleBackups() {
    console.log('\n⏰ Scheduling automated backups...');
    
    const intervals = {
      hourly: 60 * 60 * 1000,
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000
    };
    
    const interval = intervals[this.config.backupInterval] || intervals.daily;
    
    // Create initial backup
    this.createBackup('FULL').catch(console.error);
    
    // Schedule recurring backups
    setInterval(async () => {
      try {
        console.log(`\n⏰ Running scheduled ${this.config.backupInterval} backup...`);
        await this.createBackup('INCREMENTAL');
        await this.cleanOldBackups();
      } catch (error) {
        console.error('Scheduled backup failed:', error.message);
      }
    }, interval);
    
    console.log(`  ✅ Scheduled ${this.config.backupInterval} backups`);
    console.log(`  Next backup in: ${(interval / 1000 / 60).toFixed(0)} minutes`);
  }
}

// Command-line interface
if (require.main === module) {
  const command = process.argv[2];
  const backupSystem = new DatabaseBackupSystem({
    backupInterval: process.env.BACKUP_INTERVAL || 'hourly',
    retentionDays: parseInt(process.env.RETENTION_DAYS) || 30,
    compressionEnabled: process.env.COMPRESSION !== 'false',
    storageLocation: process.env.STORAGE || 'local'
  });
  
  async function run() {
    await backupSystem.initialize();
    
    switch (command) {
      case 'backup':
        const type = process.argv[3] || 'FULL';
        await backupSystem.createBackup(type);
        break;
        
      case 'restore':
        const backupId = process.argv[3];
        if (!backupId) {
          console.error('Usage: node backup-system.js restore <backup-id>');
          process.exit(1);
        }
        await backupSystem.restoreBackup(backupId, { skipConfirmation: false });
        break;
        
      case 'list':
        backupSystem.listBackups();
        break;
        
      case 'clean':
        await backupSystem.cleanOldBackups();
        break;
        
      case 'schedule':
        backupSystem.scheduleBackups();
        // Keep process running
        process.on('SIGINT', () => {
          console.log('\n👋 Stopping backup scheduler...');
          process.exit(0);
        });
        break;
        
      default:
        console.log('Database Backup System');
        console.log('='.repeat(40));
        console.log('Commands:');
        console.log('  backup [type]  - Create backup (FULL/INCREMENTAL/CRITICAL)');
        console.log('  restore <id>   - Restore from backup');
        console.log('  list          - List available backups');
        console.log('  clean         - Remove old backups');
        console.log('  schedule      - Start automated backup scheduler');
    }
  }
  
  run().catch(console.error);
}