#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

/**
 * Script to replace console.log statements with winston logger
 * Focuses on the review-engine directory and ensures proper imports
 */

class ConsoleReplacer {
  constructor() {
    this.replacements = 0;
    this.filesModified = 0;
    this.errors = [];
    
    // Define replacement mappings based on console method
    this.loggerMappings = {
      'console.error': 'reviewLogger.error',
      'console.warn': 'reviewLogger.warn', 
      'console.info': 'reviewLogger.info',
      'console.log': 'reviewLogger.info',
      'console.debug': 'reviewLogger.debug'
    };

    // Import statement to add
    this.loggerImport = "import { reviewLogger } from '@/lib/monitoring/logger';";
  }

  /**
   * Find all TypeScript files in the review-engine directory
   */
  async findFiles() {
    try {
      const { stdout } = await execAsync('find /home/beano/DevProjects/next_js/moshimoshi/src/lib/review-engine -name "*.ts" -not -path "*/node_modules/*" -not -name "*.d.ts"');
      return stdout.trim().split('\n').filter(Boolean);
    } catch (error) {
      console.error('Error finding files:', error);
      return [];
    }
  }

  /**
   * Check if file has console statements
   */
  async hasConsoleStatements(filePath) {
    try {
      const { stdout } = await execAsync(`grep -c "console\\." "${filePath}" || true`);
      return parseInt(stdout.trim()) > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if file already has logger import
   */
  hasLoggerImport(content) {
    return content.includes('reviewLogger') || 
           content.includes("from '@/lib/monitoring/logger'") ||
           content.includes("from '../monitoring/logger'") ||
           content.includes('import logger') ||
           content.includes('ComponentLogger');
  }

  /**
   * Add logger import to file
   */
  addLoggerImport(content) {
    // Find the position to insert the import
    const lines = content.split('\n');
    let insertIndex = 0;
    
    // Find the last import statement
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^import .+ from .+;?$/)) {
        insertIndex = i + 1;
      } else if (lines[i].trim() === '' && insertIndex > 0) {
        // Found empty line after imports
        break;
      } else if (!lines[i].match(/^\/\//) && !lines[i].match(/^\/\*/) && lines[i].trim() !== '' && insertIndex > 0) {
        // Found first non-comment, non-empty line after imports
        break;
      }
    }

    // Insert the import
    lines.splice(insertIndex, 0, this.loggerImport);
    return lines.join('\n');
  }

  /**
   * Replace console statements in content
   */
  replaceConsoleStatements(content) {
    let modifiedContent = content;
    let replacementsInFile = 0;

    // Replace each type of console statement
    Object.entries(this.loggerMappings).forEach(([consoleMethod, loggerMethod]) => {
      // Pattern to match console.method(...) calls
      const pattern = new RegExp(`\\b${consoleMethod.replace('.', '\\.')}\\s*\\(`, 'g');
      const matches = modifiedContent.match(pattern);
      
      if (matches) {
        replacementsInFile += matches.length;
        modifiedContent = modifiedContent.replace(pattern, `${loggerMethod}(`);
      }
    });

    return { content: modifiedContent, replacements: replacementsInFile };
  }

  /**
   * Process a single file
   */
  async processFile(filePath) {
    try {
      console.log(`Processing: ${filePath}`);
      
      // Check if file has console statements
      if (!await this.hasConsoleStatements(filePath)) {
        console.log(`  ↳ No console statements found, skipping`);
        return;
      }

      // Read file content
      const content = fs.readFileSync(filePath, 'utf8');
      let modifiedContent = content;

      // Add logger import if needed
      if (!this.hasLoggerImport(content)) {
        modifiedContent = this.addLoggerImport(modifiedContent);
        console.log(`  ↳ Added logger import`);
      }

      // Replace console statements
      const { content: newContent, replacements } = this.replaceConsoleStatements(modifiedContent);
      
      if (replacements > 0) {
        // Write the modified content back
        fs.writeFileSync(filePath, newContent);
        
        this.replacements += replacements;
        this.filesModified++;
        
        console.log(`  ↳ Replaced ${replacements} console statements`);
      } else {
        console.log(`  ↳ No console statements to replace`);
      }

    } catch (error) {
      this.errors.push({ file: filePath, error: error.message });
      console.error(`Error processing ${filePath}:`, error.message);
    }
  }

  /**
   * Verify replacements worked
   */
  async verifyReplacements() {
    try {
      const { stdout } = await execAsync('grep -r "console\\." /home/beano/DevProjects/next_js/moshimoshi/src/lib/review-engine --include="*.ts" || true');
      const remaining = stdout.trim();
      
      if (remaining) {
        console.log('\n⚠️  Remaining console statements:');
        console.log(remaining);
        return false;
      } else {
        console.log('\n✅ No console statements remaining in review-engine directory');
        return true;
      }
    } catch (error) {
      console.error('Error verifying replacements:', error);
      return false;
    }
  }

  /**
   * Run the replacement process
   */
  async run() {
    console.log('🔄 Starting console.log replacement process...\n');

    // Find all TypeScript files
    const files = await this.findFiles();
    console.log(`Found ${files.length} TypeScript files to process\n`);

    // Process each file
    for (const file of files) {
      await this.processFile(file);
    }

    // Print summary
    console.log('\n📊 Summary:');
    console.log(`  Files processed: ${files.length}`);
    console.log(`  Files modified: ${this.filesModified}`);
    console.log(`  Total replacements: ${this.replacements}`);
    
    if (this.errors.length > 0) {
      console.log(`  Errors encountered: ${this.errors.length}`);
      this.errors.forEach(({ file, error }) => {
        console.log(`    - ${file}: ${error}`);
      });
    }

    // Verify replacements
    await this.verifyReplacements();

    console.log('\n✨ Console log replacement complete!');
    
    return {
      filesProcessed: files.length,
      filesModified: this.filesModified,
      totalReplacements: this.replacements,
      errors: this.errors
    };
  }
}

// Run if called directly
if (require.main === module) {
  const replacer = new ConsoleReplacer();
  replacer.run().catch(console.error);
}

module.exports = ConsoleReplacer;