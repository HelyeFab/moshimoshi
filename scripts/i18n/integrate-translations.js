#!/usr/bin/env node

/**
 * Integration Script - Merge translations into locale files
 * This script reads translated JSON files and merges them into TypeScript locale files
 */

const fs = require('fs');
const path = require('path');

const TRANSLATED_DIR = path.join(__dirname, 'translated-output');
const LOCALES_DIR = path.join(__dirname, '../../src/i18n/locales');

/**
 * Parse TypeScript strings file to extract the object
 * This is a simple parser that handles the export const strings = {...} pattern
 */
function parseStringsFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  // Find the start of the object
  const exportMatch = content.match(/export\s+const\s+strings\s*=\s*\{/);
  if (!exportMatch) {
    throw new Error('Could not find export const strings pattern');
  }

  // Extract just the object part (everything after the opening brace)
  const startIndex = exportMatch.index + exportMatch[0].length - 1;

  // We need to manually evaluate the TypeScript to get the object
  // For safety, we'll use a Function constructor approach
  try {
    const objContent = content.substring(startIndex);
    const evalCode = `(${objContent.trimEnd().replace(/;\s*$/, '')})`;
    const stringsObj = eval(evalCode);
    return stringsObj;
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error.message);
    throw error;
  }
}

/**
 * Deep merge translations into existing object
 */
function deepMerge(target, source) {
  const result = { ...target };

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
        result[key] = deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }

  return result;
}

/**
 * Convert dot notation key to nested object
 * e.g., "landing.hero.title" -> { landing: { hero: { title: value } } }
 */
function keyToNested(key, value) {
  const parts = key.split('.');
  const result = {};
  let current = result;

  for (let i = 0; i < parts.length - 1; i++) {
    current[parts[i]] = {};
    current = current[parts[i]];
  }

  current[parts[parts.length - 1]] = value;
  return result;
}

/**
 * Format object as TypeScript with proper indentation
 */
function formatAsTypeScript(obj, indent = 1) {
  const indentStr = '  '.repeat(indent);
  const lines = [];

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      lines.push(`${indentStr}${key}: {`);
      lines.push(formatAsTypeScript(value, indent + 1));
      lines.push(`${indentStr}},`);
    } else if (typeof value === 'string') {
      // Escape special characters
      const escaped = value
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
      lines.push(`${indentStr}${key}: '${escaped}',`);
    } else {
      lines.push(`${indentStr}${key}: ${JSON.stringify(value)},`);
    }
  }

  return lines.join('\n');
}

/**
 * Process a single locale
 */
function processLocale(locale) {
  console.log(`\nProcessing ${locale.toUpperCase()}...`);

  const translatedFile = path.join(TRANSLATED_DIR, `${locale}-translated.json`);
  const localeFile = path.join(LOCALES_DIR, locale, 'strings.ts');

  if (!fs.existsSync(translatedFile)) {
    console.log(`  ✗ Translated file not found: ${translatedFile}`);
    return { locale, success: false };
  }

  if (!fs.existsSync(localeFile)) {
    console.log(`  ✗ Locale file not found: ${localeFile}`);
    return { locale, success: false };
  }

  // Read translated data
  const translatedData = JSON.parse(fs.readFileSync(translatedFile, 'utf8'));

  // Convert translations to nested object structure
  console.log(`  Converting ${translatedData.totalKeys} translations to nested structure...`);
  let translationsObj = {};

  for (const section of Object.keys(translatedData.translations)) {
    for (const [key, value] of Object.entries(translatedData.translations[section])) {
      if (value.translated && value.translated !== '') {
        const nested = keyToNested(key, value.translated);
        translationsObj = deepMerge(translationsObj, nested);
      }
    }
  }

  // Read existing locale file and parse it
  console.log(`  Parsing existing locale file...`);
  let existingStrings;
  try {
    existingStrings = parseStringsFile(localeFile);
  } catch (error) {
    console.log(`  ✗ Failed to parse locale file: ${error.message}`);
    return { locale, success: false };
  }

  // Merge translations into existing strings
  console.log(`  Merging translations...`);
  const mergedStrings = deepMerge(existingStrings, translationsObj);

  // Format as TypeScript
  console.log(`  Formatting as TypeScript...`);
  const formattedContent = `export const strings = {\n${formatAsTypeScript(mergedStrings, 1)}\n};\n`;

  // Write to output file (backup first)
  const outputFile = path.join(LOCALES_DIR, locale, 'strings.integrated.ts');
  console.log(`  Writing integrated file: ${outputFile}`);
  fs.writeFileSync(outputFile, formattedContent);

  console.log(`  ✓ Successfully created integrated file`);
  console.log(`  → Review: ${outputFile}`);

  return { locale, success: true, outputFile };
}

/**
 * Main execution
 */
function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Translation Integration Script                          ║');
  console.log('║   Merges translated JSON into TypeScript locale files     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const locales = ['ja', 'de', 'es', 'fr', 'it'];
  const results = [];

  for (const locale of locales) {
    const result = processLocale(locale);
    results.push(result);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('INTEGRATION SUMMARY');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✓ Successfully integrated: ${successful.length}/${locales.length} locales`);

  if (failed.length > 0) {
    console.log(`✗ Failed: ${failed.map(r => r.locale).join(', ')}`);
  }

  console.log('='.repeat(60));

  console.log('\nNext steps:');
  console.log('1. Review the generated .integrated.ts files');
  console.log('2. Compare with original files to verify correctness');
  console.log('3. If satisfied, replace the original strings.ts files');
  console.log('4. Run extract-missing-keys.js to verify 100% coverage');
}

main();
