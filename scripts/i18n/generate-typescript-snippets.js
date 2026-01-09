#!/usr/bin/env node

/**
 * Generate clean TypeScript snippets for each section
 */

const fs = require('fs');
const path = require('path');

function escapeString(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function generateSnippet(sectionName, translations, indent = 2) {
  const indentStr = '  '.repeat(indent);
  const baseIndent = '  '.repeat(indent - 1);

  const lines = [`${baseIndent}${sectionName}: {`];

  for (const [fullKey, value] of Object.entries(translations)) {
    // Extract the key parts after the section name
    const keyParts = fullKey.replace(`${sectionName}.`, '').split('.');

    if (keyParts.length === 1) {
      // Simple key
      lines.push(`${indentStr}${keyParts[0]}: '${escapeString(value.translated)}',`);
    } else {
      // Nested key - we'll handle this later
      // For now, just use the full path
      const nestedKey = keyParts.join('.');
      lines.push(`${indentStr}// TODO: Nested - ${nestedKey}: '${escapeString(value.translated)}',`);
    }
  }

  lines.push(`${baseIndent}},`);
  return lines.join('\n');
}

function processLocale(locale) {
  const translatedFile = path.join(__dirname, 'translated-output', `${locale}-translated.json`);
  const data = JSON.parse(fs.readFileSync(translatedFile, 'utf8'));

  const outputDir = path.join(__dirname, 'typescript-snippets', locale);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`\nGenerating snippets for ${locale.toUpperCase()}...`);

  const sections = Object.keys(data.translations).sort((a, b) => {
    const aCount = Object.keys(data.translations[a]).length;
    const bCount = Object.keys(data.translations[b]).length;
    return aCount - bCount;
  });

  for (const section of sections) {
    const translations = data.translations[section];
    const count = Object.keys(translations).length;

    const snippet = generateSnippet(section, translations);
    const outputFile = path.join(outputDir, `${section}.ts`);

    fs.writeFileSync(outputFile, snippet);
    console.log(`  ✓ ${section}: ${count} keys → ${outputFile}`);
  }

  // Generate summary file
  const summaryLines = ['// Translation Snippets Summary', `// Locale: ${locale}`, ''];
  for (const section of sections) {
    const count = Object.keys(data.translations[section]).length;
    summaryLines.push(`// ${section}: ${count} keys`);
  }

  const summaryFile = path.join(outputDir, '_SUMMARY.txt');
  fs.writeFileSync(summaryFile, summaryLines.join('\n'));

  console.log(`  ✓ Summary: ${summaryFile}`);
}

console.log('Generating TypeScript Snippets...\n');
const locales = ['it', 'ja', 'de', 'es', 'fr'];

for (const locale of locales) {
  processLocale(locale);
}

console.log('\n✓ All snippets generated in scripts/i18n/typescript-snippets/');
