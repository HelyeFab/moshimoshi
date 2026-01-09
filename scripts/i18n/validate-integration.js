#!/usr/bin/env node

/**
 * Validation Script - Check that existing translations weren't corrupted
 * Compares a sample of existing translations between original and integrated files
 */

const fs = require('fs');
const path = require('path');

function parseStringsFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const exportMatch = content.match(/export\s+const\s+strings\s*=\s*\{/);
  if (!exportMatch) {
    throw new Error('Could not find export const strings pattern');
  }
  const startIndex = exportMatch.index + exportMatch[0].length - 1;
  const objContent = content.substring(startIndex);
  const evalCode = `(${objContent.trimEnd().replace(/;\s*$/, '')})`;
  return eval(evalCode);
}

function getValueByPath(obj, path) {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return current;
}

function sampleKeys(obj, prefix = '', samples = [], maxSamples = 20) {
  if (samples.length >= maxSamples) return samples;

  for (const [key, value] of Object.entries(obj)) {
    if (samples.length >= maxSamples) break;

    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      samples.push(fullKey);
    } else if (typeof value === 'object' && value !== null) {
      sampleKeys(value, fullKey, samples, maxSamples);
    }
  }

  return samples;
}

function validateLocale(locale) {
  console.log(`\nValidating ${locale.toUpperCase()}...`);

  const originalFile = path.join(__dirname, '../../src/i18n/locales', locale, 'strings.ts');
  const integratedFile = path.join(__dirname, '../../src/i18n/locales', locale, 'strings.integrated.ts');

  if (!fs.existsSync(originalFile)) {
    console.log(`  ✗ Original file not found`);
    return { locale, valid: false, errors: ['Original file not found'] };
  }

  if (!fs.existsSync(integratedFile)) {
    console.log(`  ✗ Integrated file not found`);
    return { locale, valid: false, errors: ['Integrated file not found'] };
  }

  console.log(`  Parsing files...`);
  let originalStrings, integratedStrings;

  try {
    originalStrings = parseStringsFile(originalFile);
    integratedStrings = parseStringsFile(integratedFile);
  } catch (error) {
    console.log(`  ✗ Parse error: ${error.message}`);
    return { locale, valid: false, errors: [error.message] };
  }

  // Sample 20 existing keys
  console.log(`  Sampling existing translations...`);
  const samplePaths = sampleKeys(originalStrings, '', [], 20);
  console.log(`  Comparing ${samplePaths.length} sample keys...`);

  const errors = [];
  const warnings = [];
  let matchCount = 0;

  for (const keyPath of samplePaths) {
    const originalValue = getValueByPath(originalStrings, keyPath);
    const integratedValue = getValueByPath(integratedStrings, keyPath);

    if (originalValue === undefined) {
      warnings.push(`Key ${keyPath}: Missing in original (unexpected)`);
    } else if (integratedValue === undefined) {
      errors.push(`Key ${keyPath}: MISSING in integrated file!`);
    } else if (originalValue !== integratedValue) {
      errors.push(`Key ${keyPath}: VALUE CHANGED!\n    Original: "${originalValue}"\n    Integrated: "${integratedValue}"`);
    } else {
      matchCount++;
    }
  }

  console.log(`  ✓ Matched: ${matchCount}/${samplePaths.length} keys`);

  if (errors.length > 0) {
    console.log(`  ✗ ERRORS FOUND:`);
    errors.forEach(err => console.log(`    - ${err}`));
  }

  if (warnings.length > 0) {
    console.log(`  ⚠ Warnings:`);
    warnings.forEach(warn => console.log(`    - ${warn}`));
  }

  const valid = errors.length === 0;
  console.log(valid ? `  ✓ Validation PASSED` : `  ✗ Validation FAILED`);

  return { locale, valid, matchCount, sampleSize: samplePaths.length, errors, warnings };
}

function main() {
  const locale = process.argv[2] || 'it';

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Translation Integration Validator                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const result = validateLocale(locale);

  console.log('\n' + '='.repeat(60));
  if (result.valid) {
    console.log('✓ VALIDATION PASSED - Safe to replace original file');
  } else {
    console.log('✗ VALIDATION FAILED - DO NOT replace original file');
    console.log('\nErrors encountered:');
    result.errors.forEach(err => console.log(`  - ${err}`));
  }
  console.log('='.repeat(60));

  process.exit(result.valid ? 0 : 1);
}

main();
