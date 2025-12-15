#!/usr/bin/env node

/**
 * Update Launch Date Script
 *
 * Updates all hardcoded launch date strings across locale files
 * and the prelaunch config.
 *
 * Usage:
 *   node scripts/update-launch-date.js 2026-01-16
 *   node scripts/update-launch-date.js "January 16, 2026"
 *   node scripts/update-launch-date.js --help
 *
 * This will update:
 *   - src/lib/prelaunch/config.ts (DEFAULT_LAUNCH_DATE)
 *   - All locale files (en, it, ja, de, fr, es)
 */

const fs = require('fs');
const path = require('path');

// Locale file paths
const LOCALE_DIR = path.join(__dirname, '../src/i18n/locales');
const CONFIG_FILE = path.join(__dirname, '../src/lib/prelaunch/config.ts');

// Date formatters for each locale
const formatters = {
  en: {
    full: (d) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
    short: (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    withYear: (d) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
  },
  it: {
    full: (d) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }),
    short: (d) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }),
  },
  ja: {
    full: (d) => `${d.getMonth() + 1}月${d.getDate()}日`,
    short: (d) => `${d.getMonth() + 1}月${d.getDate()}日`,
  },
  de: {
    full: (d) => d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' }),
    short: (d) => d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }),
  },
  fr: {
    full: (d) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }),
    short: (d) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
  },
  es: {
    full: (d) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }),
    short: (d) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
  },
};

// String replacements for each locale
function getReplacements(date) {
  const f = formatters;

  return {
    en: [
      // waitlist.badge
      { pattern: /badge: 'Launching [^']+'/g, replacement: `badge: 'Launching ${f.en.full(date)}'` },
      // landing.hero.preLaunch.badge
      { pattern: /badge: '[A-Z][a-z]{2} \d{1,2}(st|nd|rd|th)'/g, replacement: `badge: '${f.en.short(date).replace(',', '')}'` },
      // landing.hero.preLaunch.badgeMobile
      { pattern: /badgeMobile: 'Launching [^']+'/g, replacement: `badgeMobile: 'Launching ${f.en.short(date).replace(',', '')}'` },
      // landing.hero.preLaunch.heroBadge
      { pattern: /heroBadge: 'Launching [^']+ - Get 25% Off!'/g, replacement: `heroBadge: 'Launching ${f.en.full(date)} - Get 25% Off!'` },
    ],
    it: [
      { pattern: /badge: 'Lancio il [^']+'/g, replacement: `badge: 'Lancio il ${f.it.full(date)}'` },
      { pattern: /badgeMobile: 'Lancio il [^']+'/g, replacement: `badgeMobile: 'Lancio il ${f.it.short(date)}'` },
      { pattern: /heroBadge: 'Lancio il [^']+ - 25% di sconto!'/g, replacement: `heroBadge: 'Lancio il ${f.it.full(date)} - 25% di sconto!'` },
    ],
    ja: [
      { pattern: /badge: '\d{1,2}月\d{1,2}日リリース'/g, replacement: `badge: '${f.ja.full(date)}リリース'` },
      { pattern: /badge: '\d{1,2}月\d{1,2}日'/g, replacement: `badge: '${f.ja.short(date)}'` },
      { pattern: /badgeMobile: '\d{1,2}月\d{1,2}日リリース'/g, replacement: `badgeMobile: '${f.ja.full(date)}リリース'` },
      { pattern: /heroBadge: '\d{1,2}月\d{1,2}日リリース - 25%オフ！'/g, replacement: `heroBadge: '${f.ja.full(date)}リリース - 25%オフ！'` },
    ],
    de: [
      { pattern: /badge: 'Start am [^']+'/g, replacement: `badge: 'Start am ${f.de.full(date)}'` },
      { pattern: /badgeMobile: 'Start am [^']+'/g, replacement: `badgeMobile: 'Start am ${f.de.full(date)}'` },
      { pattern: /heroBadge: 'Start am [^']+ - 25% Rabatt!'/g, replacement: `heroBadge: 'Start am ${f.de.full(date)} - 25% Rabatt!'` },
    ],
    fr: [
      { pattern: /badge: 'Lancement le [^']+'/g, replacement: `badge: 'Lancement le ${f.fr.full(date)}'` },
      { pattern: /badgeMobile: 'Lancement le [^']+'/g, replacement: `badgeMobile: 'Lancement le ${f.fr.short(date)}'` },
      { pattern: /heroBadge: 'Lancement le [^']+ - 25% de réduction !'/g, replacement: `heroBadge: 'Lancement le ${f.fr.full(date)} - 25% de réduction !'` },
    ],
    es: [
      { pattern: /badge: 'Lanzamiento el [^']+'/g, replacement: `badge: 'Lanzamiento el ${f.es.full(date)}'` },
      { pattern: /badgeMobile: 'Lanzamiento el [^']+'/g, replacement: `badgeMobile: 'Lanzamiento el ${f.es.short(date)}'` },
      { pattern: /heroBadge: 'Lanzamiento el [^']+ - ¡25% de descuento!'/g, replacement: `heroBadge: 'Lanzamiento el ${f.es.full(date)} - ¡25% de descuento!'` },
    ],
  };
}

function updateLocaleFile(locale, date) {
  const filePath = path.join(LOCALE_DIR, locale, 'strings.ts');

  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️  ${locale}: File not found, skipping`);
    return 0;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const replacements = getReplacements(date)[locale] || [];
  let changeCount = 0;

  for (const { pattern, replacement } of replacements) {
    const matches = content.match(pattern);
    if (matches) {
      content = content.replace(pattern, replacement);
      changeCount += matches.length;
    }
  }

  if (changeCount > 0) {
    fs.writeFileSync(filePath, content);
    console.log(`  ✅ ${locale}: Updated ${changeCount} string(s)`);
  } else {
    console.log(`  ℹ️  ${locale}: No matching strings found`);
  }

  return changeCount;
}

function updateConfigFile(date) {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.log('  ⚠️  Config file not found, skipping');
    return false;
  }

  let content = fs.readFileSync(CONFIG_FILE, 'utf8');
  const isoDate = date.toISOString().replace(/\.\d{3}Z$/, 'Z');

  // Update DEFAULT_LAUNCH_DATE
  const pattern = /const DEFAULT_LAUNCH_DATE = '[^']+'/;
  if (pattern.test(content)) {
    content = content.replace(pattern, `const DEFAULT_LAUNCH_DATE = '${isoDate}'`);
    fs.writeFileSync(CONFIG_FILE, content);
    console.log(`  ✅ config: Updated DEFAULT_LAUNCH_DATE to ${isoDate}`);
    return true;
  }

  console.log('  ⚠️  config: DEFAULT_LAUNCH_DATE not found');
  return false;
}

function parseDate(input) {
  // Try parsing various formats
  const date = new Date(input);

  if (isNaN(date.getTime())) {
    return null;
  }

  // Set to midnight UTC
  date.setUTCHours(0, 0, 0, 0);

  return date;
}

function showHelp() {
  console.log(`
Update Launch Date Script
=========================

Updates all hardcoded launch date strings across the codebase.

Usage:
  node scripts/update-launch-date.js <date>

Examples:
  node scripts/update-launch-date.js 2026-01-16
  node scripts/update-launch-date.js "January 16, 2026"
  node scripts/update-launch-date.js "2026-01-16T00:00:00Z"

This updates:
  • src/lib/prelaunch/config.ts (DEFAULT_LAUNCH_DATE)
  • src/i18n/locales/en/strings.ts
  • src/i18n/locales/it/strings.ts
  • src/i18n/locales/ja/strings.ts
  • src/i18n/locales/de/strings.ts
  • src/i18n/locales/fr/strings.ts
  • src/i18n/locales/es/strings.ts

Note: You should also set the environment variable for runtime:
  NEXT_PUBLIC_LAUNCH_DATE=2026-01-16T00:00:00Z
`);
}

// Main
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }

  const dateInput = args.join(' ');
  const date = parseDate(dateInput);

  if (!date) {
    console.error(`❌ Invalid date: "${dateInput}"`);
    console.error('   Try formats like: 2026-01-16, "January 16, 2026"');
    process.exit(1);
  }

  console.log(`\n🗓️  Updating launch date to: ${date.toDateString()}\n`);
  console.log('Updating files:');

  // Update config
  updateConfigFile(date);

  // Update all locale files
  const locales = ['en', 'it', 'ja', 'de', 'fr', 'es'];
  let totalChanges = 0;

  for (const locale of locales) {
    totalChanges += updateLocaleFile(locale, date);
  }

  console.log(`\n✨ Done! Updated ${totalChanges} strings across ${locales.length} locales.`);
  console.log(`\n💡 Remember to also set the environment variable:`);
  console.log(`   NEXT_PUBLIC_LAUNCH_DATE=${date.toISOString().replace(/\.\d{3}Z$/, 'Z')}`);
}

main();
