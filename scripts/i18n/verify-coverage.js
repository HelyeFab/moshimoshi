#!/usr/bin/env node

/**
 * Verify translation coverage by directly requiring the TypeScript files
 */

const path = require('path');

function countKeys(obj, prefix = '') {
  let count = 0;
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      count++;
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      count += countKeys(value, fullKey);
    }
  }
  return count;
}

function getMissingKeys(reference, target, prefix = '') {
  const missing = [];

  for (const [key, value] of Object.entries(reference)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (!(key in target)) {
      missing.push(fullKey);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if (typeof target[key] === 'object' && target[key] !== null) {
        missing.push(...getMissingKeys(value, target[key], fullKey));
      } else {
        missing.push(fullKey);
      }
    }
  }

  return missing;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Translation Coverage Verification                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const locales = ['ja', 'de', 'es', 'fr', 'it'];
  const localesDir = path.join(__dirname, '../../src/i18n/locales');

  // Load English reference
  console.log('Loading English reference...');
  const { strings: enStrings } = require(path.join(localesDir, 'en', 'strings.ts'));
  const totalEnKeys = countKeys(enStrings);
  console.log(`✓ English has ${totalEnKeys} keys\n`);

  const results = [];

  for (const locale of locales) {
    console.log(`Checking ${locale.toUpperCase()}...`);

    try {
      const { strings } = require(path.join(localesDir, locale, 'strings.ts'));
      const keyCount = countKeys(strings);
      const missing = getMissingKeys(enStrings, strings);
      const coverage = ((keyCount / totalEnKeys) * 100).toFixed(1);

      console.log(`  Keys: ${keyCount}/${totalEnKeys}`);
      console.log(`  Coverage: ${coverage}%`);
      console.log(`  Missing: ${missing.length} keys`);

      if (missing.length > 0 && missing.length <= 10) {
        console.log(`  Missing keys:`);
        missing.forEach(key => console.log(`    - ${key}`));
      }

      results.push({
        locale,
        keyCount,
        missing: missing.length,
        coverage: parseFloat(coverage),
        complete: missing.length === 0
      });

      console.log(missing.length === 0 ? '  ✓ COMPLETE\n' : '  ⚠ INCOMPLETE\n');
    } catch (error) {
      console.log(`  ✗ Error: ${error.message}\n`);
      results.push({
        locale,
        keyCount: 0,
        missing: totalEnKeys,
        coverage: 0,
        complete: false,
        error: error.message
      });
    }
  }

  // Summary
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  for (const result of results) {
    const status = result.complete ? '✓' : '⚠';
    console.log(`${status} ${result.locale.toUpperCase()}: ${result.keyCount}/${totalEnKeys} keys (${result.coverage}%)`);
  }

  console.log('='.repeat(60));

  const allComplete = results.every(r => r.complete);
  if (allComplete) {
    console.log('\n🎉 100% TRANSLATION COVERAGE ACHIEVED! 🎉\n');
  } else {
    const incomplete = results.filter(r => !r.complete);
    console.log(`\n⚠ ${incomplete.length} locale(s) incomplete\n`);
  }

  process.exit(allComplete ? 0 : 1);
}

main().catch(error => {
  console.error('\n✗ Fatal error:', error);
  process.exit(1);
});
