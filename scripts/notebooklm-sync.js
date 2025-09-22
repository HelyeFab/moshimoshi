#!/usr/bin/env node

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const DocsAggregator = require('./docs-aggregator');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * NotebookLM Sync Manager
 * 
 * This enhanced version of the docs aggregator includes:
 * - Smart change detection using checksums
 * - Incremental updates to avoid re-uploading everything
 * - Google Drive integration support
 * - Automatic versioning and backup
 */
class NotebookLMSync {
  constructor(config = {}) {
    this.aggregator = new DocsAggregator({
      ...config,
      outputFile: config.outputFile || './notebooklm-docs.md'
    });
    
    this.stateFile = config.stateFile || './.notebooklm-sync-state.json';
    this.backupDir = config.backupDir || './notebooklm-backups';
    this.maxBackups = config.maxBackups || 5;
    this.state = null;
  }

  async loadState() {
    try {
      const data = await fs.readFile(this.stateFile, 'utf-8');
      this.state = JSON.parse(data);
    } catch (error) {
      // Initialize new state if file doesn't exist
      this.state = {
        lastSync: null,
        files: {},
        outputChecksum: null,
        syncCount: 0
      };
    }
    return this.state;
  }

  async saveState() {
    await fs.writeFile(this.stateFile, JSON.stringify(this.state, null, 2));
  }

  async getFileChecksum(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return crypto.createHash('md5').update(content).digest('hex');
    } catch (error) {
      return null;
    }
  }

  async detectChanges() {
    const currentFiles = {};
    const changes = {
      added: [],
      modified: [],
      deleted: [],
      unchanged: []
    };

    // Find all current documentation files
    const filePaths = await this.aggregator.findDocFiles();
    
    // Check each file for changes
    for (const filePath of filePaths) {
      const fullPath = path.join(this.aggregator.sourceDir, filePath);
      const checksum = await this.getFileChecksum(fullPath);
      currentFiles[filePath] = checksum;

      if (!this.state.files[filePath]) {
        changes.added.push(filePath);
      } else if (this.state.files[filePath] !== checksum) {
        changes.modified.push(filePath);
      } else {
        changes.unchanged.push(filePath);
      }
    }

    // Check for deleted files
    for (const filePath in this.state.files) {
      if (!currentFiles[filePath]) {
        changes.deleted.push(filePath);
      }
    }

    return { changes, currentFiles };
  }

  async createBackup() {
    if (!this.aggregator.outputFile || !await this.fileExists(this.aggregator.outputFile)) {
      return null;
    }

    // Create backup directory if it doesn't exist
    await fs.mkdir(this.backupDir, { recursive: true });

    // Generate backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(this.backupDir, `backup-${timestamp}.md`);

    // Copy current output to backup
    const content = await fs.readFile(this.aggregator.outputFile, 'utf-8');
    await fs.writeFile(backupFile, content);

    // Clean up old backups
    await this.cleanupBackups();

    return backupFile;
  }

  async cleanupBackups() {
    const files = await fs.readdir(this.backupDir);
    const backupFiles = files
      .filter(f => f.startsWith('backup-') && f.endsWith('.md'))
      .sort()
      .reverse();

    // Delete old backups beyond max limit
    for (let i = this.maxBackups; i < backupFiles.length; i++) {
      await fs.unlink(path.join(this.backupDir, backupFiles[i]));
    }
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async generateChangeLog(changes) {
    let changeLog = '# 📋 Change Summary\n\n';
    changeLog += `**Sync Time:** ${new Date().toISOString()}\n\n`;

    if (changes.added.length > 0) {
      changeLog += `## ➕ Added Files (${changes.added.length})\n`;
      changes.added.forEach(file => {
        changeLog += `- ${file}\n`;
      });
      changeLog += '\n';
    }

    if (changes.modified.length > 0) {
      changeLog += `## 📝 Modified Files (${changes.modified.length})\n`;
      changes.modified.forEach(file => {
        changeLog += `- ${file}\n`;
      });
      changeLog += '\n';
    }

    if (changes.deleted.length > 0) {
      changeLog += `## 🗑️ Deleted Files (${changes.deleted.length})\n`;
      changes.deleted.forEach(file => {
        changeLog += `- ${file}\n`;
      });
      changeLog += '\n';
    }

    changeLog += `## 📊 Statistics\n`;
    changeLog += `- Total files: ${changes.added.length + changes.modified.length + changes.unchanged.length}\n`;
    changeLog += `- Unchanged files: ${changes.unchanged.length}\n`;
    changeLog += `- Total changes: ${changes.added.length + changes.modified.length + changes.deleted.length}\n`;

    return changeLog;
  }

  async sync() {
    await this.loadState();

    console.log('🔄 Starting NotebookLM sync...');

    // Detect changes
    const { changes, currentFiles } = await this.detectChanges();
    
    const totalChanges = changes.added.length + changes.modified.length + changes.deleted.length;

    if (totalChanges === 0 && this.state.lastSync) {
      console.log('✅ No changes detected since last sync');
      return { status: 'no-changes', changes };
    }

    // Create backup if output exists
    const backupFile = await this.createBackup();
    if (backupFile) {
      console.log(`💾 Backup created: ${backupFile}`);
    }

    // Generate new aggregated file
    console.log(`🔄 Processing ${totalChanges} changes...`);
    await this.aggregator.aggregate();

    // Generate and append change log
    const changeLog = await this.generateChangeLog(changes);
    const currentContent = await fs.readFile(this.aggregator.outputFile, 'utf-8');
    const updatedContent = currentContent + '\n\n---\n\n' + changeLog;
    await fs.writeFile(this.aggregator.outputFile, updatedContent);

    // Calculate checksum of output
    const outputChecksum = await this.getFileChecksum(this.aggregator.outputFile);

    // Update state
    this.state.files = currentFiles;
    this.state.lastSync = new Date().toISOString();
    this.state.outputChecksum = outputChecksum;
    this.state.syncCount++;
    await this.saveState();

    console.log('\n📊 Sync Summary:');
    console.log(`  ➕ Added: ${changes.added.length} files`);
    console.log(`  📝 Modified: ${changes.modified.length} files`);
    console.log(`  🗑️ Deleted: ${changes.deleted.length} files`);
    console.log(`  ✅ Unchanged: ${changes.unchanged.length} files`);
    console.log(`\n✨ Sync completed! Output: ${this.aggregator.outputFile}`);
    
    // Provide upload instructions
    if (totalChanges > 0) {
      console.log('\n📚 Next Steps for NotebookLM:');
      console.log('  1. Open NotebookLM (notebooklm.google.com)');
      console.log('  2. Create or open your notebook');
      console.log('  3. Click "+" to add a source');
      console.log(`  4. Upload: ${path.resolve(this.aggregator.outputFile)}`);
      console.log('  5. NotebookLM will process and index the documentation');
    }

    return { status: 'synced', changes, outputChecksum };
  }

  async watch() {
    // Initial sync
    await this.sync();

    console.log('\n👀 Watching for changes...');
    
    // Use the aggregator's watch functionality with our sync
    const originalAggregate = this.aggregator.aggregate.bind(this.aggregator);
    this.aggregator.aggregate = async () => {
      await this.sync();
    };

    await this.aggregator.watch();
  }

  async run() {
    if (this.aggregator.watchMode) {
      await this.watch();
    } else {
      await this.sync();
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  // Use environment variable for output path with fallback
  const defaultOutputPath = process.env.NOTEBOOKLM_OUTPUT_PATH || './notebooklm-docs.md';

  const config = {
    sourceDir: './docs',
    outputFile: defaultOutputPath,
    watch: false,
    metadata: true,
    toc: true,
    stateFile: './.notebooklm-sync-state.json',
    backupDir: './notebooklm-backups',
    maxBackups: 5
  };

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--watch':
      case '-w':
        config.watch = true;
        break;
      case '--source':
      case '-s':
        config.sourceDir = args[++i];
        break;
      case '--output':
      case '-o':
        config.outputFile = args[++i];
        break;
      case '--state-file':
        config.stateFile = args[++i];
        break;
      case '--backup-dir':
        config.backupDir = args[++i];
        break;
      case '--max-backups':
        config.maxBackups = parseInt(args[++i]);
        break;
      case '--no-metadata':
        config.metadata = false;
        break;
      case '--no-toc':
        config.toc = false;
        break;
      case '--clean':
        // Clean mode - remove state and start fresh
        const fs = require('fs');
        try {
          fs.unlinkSync(config.stateFile);
          console.log('✅ State file cleaned');
        } catch (error) {
          console.log('No state file to clean');
        }
        process.exit(0);
      case '--help':
      case '-h':
        console.log(`
📚 NotebookLM Sync Manager

Advanced documentation sync tool with change detection and versioning.

Usage: node scripts/notebooklm-sync.js [options]

Options:
  -w, --watch              Watch for changes and auto-sync
  -s, --source <dir>       Source directory (default: ./docs)
  -o, --output <file>      Output file (default: ./notebooklm-docs.md)
  --state-file <file>      State file for tracking (default: ./.notebooklm-sync-state.json)
  --backup-dir <dir>       Backup directory (default: ./notebooklm-backups)
  --max-backups <num>      Maximum backups to keep (default: 5)
  --no-metadata           Don't add file metadata
  --no-toc                Don't add table of contents
  --clean                 Remove state file and start fresh
  -h, --help              Show this help message

Features:
  ✨ Smart change detection using checksums
  💾 Automatic backups before updates
  📊 Detailed change logs
  🔄 Incremental sync tracking
  👀 Real-time file watching

Examples:
  # One-time sync with change detection
  node scripts/notebooklm-sync.js
  
  # Watch mode with auto-sync on changes
  node scripts/notebooklm-sync.js --watch
  
  # Clean sync (reset tracking)
  node scripts/notebooklm-sync.js --clean
  node scripts/notebooklm-sync.js
  
  # Custom configuration
  node scripts/notebooklm-sync.js -s ./documentation -o ./gdrive/notebook.md

Workflow:
  1. Run the sync to create aggregated file
  2. Upload to NotebookLM (or save to Google Drive)
  3. Use watch mode for continuous updates
  4. Re-upload when significant changes accumulate
`);
        process.exit(0);
    }
  }

  const sync = new NotebookLMSync(config);
  sync.run().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = NotebookLMSync;