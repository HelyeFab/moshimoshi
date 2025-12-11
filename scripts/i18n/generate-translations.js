#!/usr/bin/env node
/**
 * Generate Missing Translations Script
 *
 * This script reads the missing-translations.json output from extract-missing-keys.js
 * and generates a format suitable for manual review or translation API integration.
 *
 * Usage:
 *   1. First run: node scripts/i18n/extract-missing-keys.js
 *   2. Then run: node scripts/i18n/generate-translations.js
 *
 * Output: scripts/i18n/translations-to-review/{locale}.json
 */

const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, 'missing-translations.json');
const OUTPUT_DIR = path.join(__dirname, 'translations-to-review');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Format translations for manual review
 * Groups by section for easier processing
 */
function formatForReview(locale, data) {
  const { missingBySection, missingTranslations } = data;

  const output = {
    locale,
    generatedAt: new Date().toISOString(),
    totalMissingKeys: Object.keys(missingTranslations).length,
    sections: {}
  };

  // Group translations by top-level section
  for (const [section, keys] of Object.entries(missingBySection)) {
    output.sections[section] = {
      count: keys.length,
      translations: {}
    };

    for (const key of keys) {
      const englishValue = missingTranslations[key];
      output.sections[section].translations[key] = {
        english: englishValue,
        translated: '' // Placeholder for translation
      };
    }
  }

  return output;
}

/**
 * Generate TypeScript code snippet for inserting translations
 * This can be copy-pasted into the locale file
 */
function generateTsSnippet(locale, data) {
  const { missingTranslations } = data;

  let snippet = `// Missing translations for ${locale}\n`;
  snippet += `// Generated at ${new Date().toISOString()}\n\n`;

  // Group by top-level key
  const grouped = {};
  for (const [key, value] of Object.entries(missingTranslations)) {
    const parts = key.split('.');
    const topLevel = parts[0];

    if (!grouped[topLevel]) {
      grouped[topLevel] = {};
    }
    grouped[topLevel][key] = value;
  }

  // Generate snippet for each section
  for (const [section, keys] of Object.entries(grouped)) {
    snippet += `// Section: ${section}\n`;
    for (const [key, value] of Object.entries(keys)) {
      const relativePath = key.split('.').slice(1).join('.');
      const escapedValue = typeof value === 'string'
        ? value.replace(/'/g, "\\'")
        : JSON.stringify(value);
      snippet += `// ${relativePath}: '${escapedValue}'\n`;
    }
    snippet += '\n';
  }

  return snippet;
}

/**
 * Main function
 */
function generateTranslations() {
  // Check if input file exists
  if (!fs.existsSync(INPUT_FILE)) {
    console.error('Error: missing-translations.json not found.');
    console.error('Please run extract-missing-keys.js first:');
    console.error('  node scripts/i18n/extract-missing-keys.js');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));

  console.log('Generating translation files for review...\n');

  for (const [locale, localeData] of Object.entries(data.locales)) {
    if (localeData.error) {
      console.log(`Skipping ${locale}: ${localeData.error}`);
      continue;
    }

    if (localeData.missingCount === 0) {
      console.log(`${locale}: No missing translations!`);
      continue;
    }

    // Generate JSON for review
    const reviewData = formatForReview(locale, localeData);
    const jsonPath = path.join(OUTPUT_DIR, `${locale}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(reviewData, null, 2));

    // Generate TypeScript snippet
    const tsSnippet = generateTsSnippet(locale, localeData);
    const tsPath = path.join(OUTPUT_DIR, `${locale}-snippet.ts`);
    fs.writeFileSync(tsPath, tsSnippet);

    console.log(`${locale}:`);
    console.log(`  - Missing keys: ${localeData.missingCount}`);
    console.log(`  - Review file: ${jsonPath}`);
    console.log(`  - TS snippet: ${tsPath}`);
  }

  console.log(`\nOutput written to: ${OUTPUT_DIR}`);
  console.log('\nNext steps:');
  console.log('1. Review the generated JSON files');
  console.log('2. Fill in translations manually or use a translation API');
  console.log('3. Use the TypeScript snippets as reference for inserting translations');
}

// Run if called directly
if (require.main === module) {
  generateTranslations();
}

module.exports = { generateTranslations, formatForReview, generateTsSnippet };
