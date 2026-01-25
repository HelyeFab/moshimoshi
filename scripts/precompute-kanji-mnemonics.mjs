#!/usr/bin/env node
/**
 * Batch Precompute Kanji Mnemonics
 *
 * Generates mnemonic stories for all JLPT kanji characters.
 * Checks Firebase cache first to avoid regenerating existing mnemonics.
 *
 * Usage:
 *   node scripts/precompute-kanji-mnemonics.mjs --dry-run     # Preview what would be generated
 *   node scripts/precompute-kanji-mnemonics.mjs --level=N5    # Generate for specific JLPT level
 *   node scripts/precompute-kanji-mnemonics.mjs --all         # Generate for all levels (N5→N1)
 *   node scripts/precompute-kanji-mnemonics.mjs --resume      # Resume from last position
 *
 * Environment:
 *   Requires .env.local with Firebase and Ollama/OpenAI credentials
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local for local development
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: path.join(__dirname, '../.env.local') });

// Configuration
const JLPT_DIR = path.join(__dirname, '../public/data/kanji');
const PROGRESS_FILE = path.join(__dirname, '../.cache/mnemonic-progress.json');
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const ADMIN_KEY = process.env.ADMIN_API_KEY || process.env.CRON_SECRET || '';
const CONCURRENCY = parseInt(process.env.MNEMONIC_CONCURRENCY || '5', 10);
const DELAY_MS = parseInt(process.env.MNEMONIC_DELAY_MS || '1000', 10);

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isResume = args.includes('--resume');
const levelArg = args.find(arg => arg.startsWith('--level='));
const targetLevel = levelArg ? levelArg.split('=')[1] : null;
const isAll = args.includes('--all');

// JLPT levels in order of difficulty (easiest first)
const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

/**
 * Load kanji from JLPT JSON files
 */
function loadKanjiByLevel() {
  const kanjiByLevel = {};

  for (const level of JLPT_LEVELS) {
    const levelNum = level.replace('N', '');
    const filePath = path.join(JLPT_DIR, `jlpt_${levelNum}.json`);

    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      kanjiByLevel[level] = data.map(k => ({
        kanji: k.kanji,
        meaning: k.meaning,
        level
      }));
      console.log(`📚 Loaded ${data.length} kanji from ${level}`);
    }
  }

  return kanjiByLevel;
}

/**
 * Load progress from file
 */
function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  }
  return { completed: [], failed: [], lastLevel: null, lastIndex: 0 };
}

/**
 * Save progress to file
 */
function saveProgress(progress) {
  const cacheDir = path.dirname(PROGRESS_FILE);
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * Check if a kanji mnemonic exists (via API)
 */
async function checkMnemonicExists(kanji) {
  try {
    const url = `${API_BASE_URL}/api/kanji/mnemonic?kanji=${encodeURIComponent(kanji)}`;
    const response = await fetch(url);
    const data = await response.json();
    return data.success && data.mnemonic !== null;
  } catch (error) {
    console.error(`Error checking ${kanji}:`, error.message);
    return false;
  }
}

/**
 * Generate a mnemonic for a kanji (via API)
 */
async function generateMnemonic(kanji, meaning) {
  try {
    const url = `${API_BASE_URL}/api/kanji/mnemonic`;
    const headers = { 'Content-Type': 'application/json' };

    // Add admin key for batch operations
    if (ADMIN_KEY) {
      headers['x-admin-key'] = ADMIN_KEY;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ kanji, meaning })
    });

    const data = await response.json();

    if (data.success && data.mnemonic) {
      return { success: true, mnemonic: data.mnemonic };
    }

    return { success: false, error: data.error || data.details || 'Unknown error' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Delay helper
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Process a batch of kanji
 */
async function processBatch(kanjiList, progress, startIdx = 0) {
  const results = { generated: 0, skipped: 0, failed: 0 };

  for (let i = startIdx; i < kanjiList.length; i++) {
    const item = kanjiList[i];
    const { kanji, meaning, level } = item;

    // Skip if already completed
    if (progress.completed.includes(kanji)) {
      results.skipped++;
      continue;
    }

    console.log(`\n[${i + 1}/${kanjiList.length}] Processing: ${kanji} (${meaning}) - ${level}`);

    if (isDryRun) {
      console.log(`  ⏸️  DRY RUN: Would generate mnemonic`);
      results.skipped++;
      continue;
    }

    // Check if already exists
    const exists = await checkMnemonicExists(kanji);
    if (exists) {
      console.log(`  ✅ Already cached`);
      progress.completed.push(kanji);
      results.skipped++;
      continue;
    }

    // Generate mnemonic
    const result = await generateMnemonic(kanji, meaning);

    if (result.success) {
      console.log(`  ✨ Generated: ${result.mnemonic.mnemonic.substring(0, 60)}...`);
      progress.completed.push(kanji);
      results.generated++;
    } else {
      console.log(`  ❌ Failed: ${result.error}`);
      progress.failed.push({ kanji, error: result.error });
      results.failed++;
    }

    // Save progress
    progress.lastLevel = level;
    progress.lastIndex = i;
    saveProgress(progress);

    // Delay between requests
    if (i < kanjiList.length - 1) {
      await delay(DELAY_MS);
    }
  }

  return results;
}

/**
 * Main execution
 */
async function main() {
  console.log('=== Kanji Mnemonic Batch Generator ===\n');
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Admin Key: ${ADMIN_KEY ? '✓ configured' : '✗ NOT configured (will require user auth)'}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Delay: ${DELAY_MS}ms`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  if (!ADMIN_KEY && !isDryRun) {
    console.warn('⚠️  Warning: No ADMIN_API_KEY or CRON_SECRET configured in .env.local');
    console.warn('   Requests may fail with UNAUTHENTICATED error.');
    console.warn('   Add ADMIN_API_KEY=your-secret-key to .env.local\n');
  }

  // Load kanji data
  const kanjiByLevel = loadKanjiByLevel();

  // Determine which levels to process
  let levelsToProcess = [];
  if (targetLevel) {
    if (JLPT_LEVELS.includes(targetLevel)) {
      levelsToProcess = [targetLevel];
    } else {
      console.error(`Invalid level: ${targetLevel}`);
      process.exit(1);
    }
  } else if (isAll) {
    levelsToProcess = JLPT_LEVELS;
  } else {
    console.log('Please specify --level=N5 or --all');
    console.log('\nOptions:');
    console.log('  --dry-run     Preview what would be generated');
    console.log('  --level=N5    Generate for specific JLPT level');
    console.log('  --all         Generate for all levels (N5→N1)');
    console.log('  --resume      Resume from last position');
    process.exit(0);
  }

  // Build combined list
  let allKanji = [];
  for (const level of levelsToProcess) {
    if (kanjiByLevel[level]) {
      allKanji = allKanji.concat(kanjiByLevel[level]);
    }
  }

  console.log(`\nProcessing ${allKanji.length} kanji from levels: ${levelsToProcess.join(', ')}\n`);

  // Load progress
  const progress = isResume ? loadProgress() : { completed: [], failed: [], lastLevel: null, lastIndex: 0 };

  if (isResume && progress.completed.length > 0) {
    console.log(`Resuming from position ${progress.lastIndex} (${progress.completed.length} already completed)`);
  }

  // Process
  const startIdx = isResume ? progress.lastIndex : 0;
  const results = await processBatch(allKanji, progress, startIdx);

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Total kanji: ${allKanji.length}`);
  console.log(`Generated: ${results.generated}`);
  console.log(`Skipped (cached): ${results.skipped}`);
  console.log(`Failed: ${results.failed}`);

  if (progress.failed.length > 0) {
    console.log('\nFailed kanji:');
    progress.failed.slice(0, 10).forEach(f => console.log(`  - ${f.kanji}: ${f.error}`));
    if (progress.failed.length > 10) {
      console.log(`  ... and ${progress.failed.length - 10} more`);
    }
  }

  console.log(`\nProgress saved to: ${PROGRESS_FILE}`);
  console.log('Done!');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
