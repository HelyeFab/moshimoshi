#!/usr/bin/env node
/**
 * Extract Missing Translation Keys
 *
 * This script compares the English strings.ts (reference) with other locale files
 * and outputs a JSON file containing all missing keys for each locale.
 *
 * Usage: node scripts/i18n/extract-missing-keys.js
 * Output: scripts/i18n/missing-translations.json
 */

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '../../src/i18n/locales');
const OUTPUT_FILE = path.join(__dirname, 'missing-translations.json');

// Supported locales (excluding English which is the reference)
const TARGET_LOCALES = ['ja', 'de', 'es', 'fr', 'it'];

/**
 * Parse a TypeScript strings file and extract the strings object
 * This handles the `export const strings = { ... }` format
 */
function parseStringsFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Remove the export statement and get the object
  // We'll evaluate it in a safe way by extracting the object literal
  const match = content.match(/export\s+const\s+strings\s*=\s*(\{[\s\S]*\});?\s*$/);

  if (!match) {
    throw new Error(`Could not parse strings file: ${filePath}`);
  }

  // Use Function constructor to safely evaluate the object
  // This is safer than eval() but still handles the object literal
  try {
    const objectStr = match[1];
    const fn = new Function(`return ${objectStr}`);
    return fn();
  } catch (e) {
    throw new Error(`Failed to evaluate strings object in ${filePath}: ${e.message}`);
  }
}

/**
 * Get all keys from a nested object as dot-notation paths
 */
function getAllKeys(obj, prefix = '') {
  const keys = [];

  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // Recurse into nested objects
      keys.push(...getAllKeys(value, fullKey));
    } else {
      // This is a leaf value (string, number, array, etc.)
      keys.push(fullKey);
    }
  }

  return keys;
}

/**
 * Get value at a dot-notation path from an object
 */
function getValueAtPath(obj, path) {
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === undefined || current === null) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

/**
 * Check if a key exists in an object (using dot notation path)
 */
function hasKey(obj, path) {
  return getValueAtPath(obj, path) !== undefined;
}

/**
 * Main extraction function
 */
function extractMissingKeys() {
  console.log('Extracting missing translation keys...\n');

  // Load English strings as reference
  const enPath = path.join(LOCALES_DIR, 'en', 'strings.ts');
  console.log(`Loading reference: ${enPath}`);
  const enStrings = parseStringsFile(enPath);
  const allEnKeys = getAllKeys(enStrings);
  console.log(`Found ${allEnKeys.length} keys in English reference\n`);

  const result = {
    generated: new Date().toISOString(),
    referenceLocale: 'en',
    totalReferenceKeys: allEnKeys.length,
    locales: {}
  };

  // Process each target locale
  for (const locale of TARGET_LOCALES) {
    const localePath = path.join(LOCALES_DIR, locale, 'strings.ts');

    if (!fs.existsSync(localePath)) {
      console.log(`Warning: Locale file not found: ${localePath}`);
      continue;
    }

    console.log(`Processing locale: ${locale}`);

    try {
      const localeStrings = parseStringsFile(localePath);
      const localeKeys = getAllKeys(localeStrings);

      // Find missing keys
      const missingKeys = allEnKeys.filter(key => !hasKey(localeStrings, key));

      // Build missing translations with English values
      const missingTranslations = {};
      for (const key of missingKeys) {
        missingTranslations[key] = getValueAtPath(enStrings, key);
      }

      // Group missing keys by top-level section for easier review
      const groupedMissing = {};
      for (const key of missingKeys) {
        const section = key.split('.')[0];
        if (!groupedMissing[section]) {
          groupedMissing[section] = [];
        }
        groupedMissing[section].push(key);
      }

      result.locales[locale] = {
        existingKeys: localeKeys.length,
        missingCount: missingKeys.length,
        completionPercentage: ((localeKeys.length / allEnKeys.length) * 100).toFixed(1),
        missingBySection: groupedMissing,
        missingKeys: missingKeys,
        missingTranslations: missingTranslations
      };

      console.log(`  - Existing keys: ${localeKeys.length}`);
      console.log(`  - Missing keys: ${missingKeys.length}`);
      console.log(`  - Completion: ${result.locales[locale].completionPercentage}%`);

      // Show breakdown by section
      console.log('  - Missing by section:');
      for (const [section, keys] of Object.entries(groupedMissing)) {
        console.log(`    - ${section}: ${keys.length} keys`);
      }
      console.log('');

    } catch (e) {
      console.error(`Error processing ${locale}: ${e.message}`);
      result.locales[locale] = { error: e.message };
    }
  }

  // Write output file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
  console.log(`\nOutput written to: ${OUTPUT_FILE}`);

  return result;
}

// Run if called directly
if (require.main === module) {
  extractMissingKeys();
}

module.exports = { extractMissingKeys, parseStringsFile, getAllKeys, getValueAtPath };
