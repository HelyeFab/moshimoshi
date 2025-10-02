#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

/**
 * Merge Recent Documentation Script
 *
 * Merges all markdown files modified in the last N days into a single document
 */
class RecentDocsMerger {
  constructor(config = {}) {
    this.sourceDir = config.sourceDir || './docs';
    this.outputFile = config.outputFile || './recent-docs-merged.md';
    this.days = config.days || 7;
  }

  async getRecentFiles() {
    // Use find command to get files modified in the last N days
    const command = `find ${this.sourceDir} -name "*.md" -type f -mtime -${this.days}`;

    try {
      const output = execSync(command, { encoding: 'utf-8' });
      const files = output.trim().split('\n').filter(f => f);

      // Sort files by modification time (newest first)
      const filesWithStats = await Promise.all(
        files.map(async (file) => {
          const stats = await fs.stat(file);
          return { file, mtime: stats.mtime };
        })
      );

      filesWithStats.sort((a, b) => b.mtime - a.mtime);

      return filesWithStats.map(f => f.file);
    } catch (error) {
      console.error('Error finding files:', error.message);
      return [];
    }
  }

  async readFileContent(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);

      return {
        path: filePath,
        relativePath: path.relative(this.sourceDir, filePath),
        content,
        mtime: stats.mtime.toISOString(),
        size: stats.size
      };
    } catch (error) {
      console.error(`Error reading ${filePath}:`, error.message);
      return null;
    }
  }

  formatDocument(fileData) {
    const separator = '='.repeat(80);
    const relativePath = fileData.relativePath;
    const lastModified = new Date(fileData.mtime).toLocaleString();

    return `
${separator}
FILE: ${relativePath}
MODIFIED: ${lastModified}
SIZE: ${(fileData.size / 1024).toFixed(2)} KB
${separator}

${fileData.content}

`;
  }

  async merge() {
    console.log(`🔍 Finding markdown files modified in the last ${this.days} days...`);

    const recentFiles = await this.getRecentFiles();

    if (recentFiles.length === 0) {
      console.log('❌ No files found');
      return;
    }

    console.log(`📚 Found ${recentFiles.length} files`);
    console.log('📖 Reading and merging files...');

    // Read all files
    const fileDataArray = await Promise.all(
      recentFiles.map(file => this.readFileContent(file))
    );

    // Filter out any failed reads
    const validFiles = fileDataArray.filter(data => data !== null);

    // Generate header
    const now = new Date().toISOString();
    const header = `# Recent Documentation (Last ${this.days} Days)

**Generated:** ${now}
**Total Files:** ${validFiles.length}
**Total Size:** ${(validFiles.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(2)} KB

---

## Table of Contents

${validFiles.map((file, index) =>
  `${index + 1}. [${file.relativePath}](#${this.createAnchor(file.relativePath)}) - _Modified: ${new Date(file.mtime).toLocaleDateString()}_`
).join('\n')}

---

`;

    // Merge all content
    const mergedContent = header + validFiles.map(file => this.formatDocument(file)).join('\n');

    // Write to output file
    await fs.writeFile(this.outputFile, mergedContent);

    console.log('\n✨ Merge complete!');
    console.log(`📄 Output: ${path.resolve(this.outputFile)}`);
    console.log(`📊 Statistics:`);
    console.log(`   - Files merged: ${validFiles.length}`);
    console.log(`   - Total size: ${(validFiles.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(2)} KB`);
    console.log(`   - Date range: Last ${this.days} days`);

    // Show file list
    console.log('\n📋 Files included:');
    validFiles.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file.relativePath}`);
    });

    return {
      outputFile: this.outputFile,
      filesCount: validFiles.length,
      totalSize: validFiles.reduce((sum, f) => sum + f.size, 0)
    };
  }

  createAnchor(text) {
    // Create GitHub-style anchor link
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-');
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);

  const config = {
    sourceDir: './docs',
    outputFile: './recent-docs-merged.md',
    days: 7
  };

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--source':
      case '-s':
        config.sourceDir = args[++i];
        break;
      case '--output':
      case '-o':
        config.outputFile = args[++i];
        break;
      case '--days':
      case '-d':
        config.days = parseInt(args[++i]);
        break;
      case '--help':
      case '-h':
        console.log(`
📚 Recent Documentation Merger

Merges all markdown files modified in the last N days into a single document.

Usage: node scripts/merge-recent-docs.js [options]

Options:
  -s, --source <dir>       Source directory (default: ./docs)
  -o, --output <file>      Output file (default: ./recent-docs-merged.md)
  -d, --days <number>      Number of days to look back (default: 7)
  -h, --help              Show this help message

Examples:
  # Merge last 7 days of docs
  node scripts/merge-recent-docs.js

  # Merge last 30 days
  node scripts/merge-recent-docs.js --days 30

  # Custom output location
  node scripts/merge-recent-docs.js -o ./exports/weekly-docs.md

  # Custom source directory
  node scripts/merge-recent-docs.js -s ./documentation -d 14
`);
        process.exit(0);
    }
  }

  const merger = new RecentDocsMerger(config);
  merger.merge().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = RecentDocsMerger;
