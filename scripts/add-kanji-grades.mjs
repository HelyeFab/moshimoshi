#!/usr/bin/env node
/**
 * Script to add grade data to JLPT kanji JSON files
 * Uses KANJIDIC2 data for official Japanese school grade assignments
 *
 * Grade meanings:
 * - 1-6: Elementary school grades (教育漢字)
 * - "S": Secondary school (中学校) - includes KANJIDIC grades 8, 9, 10 and ungraded kanji
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import zlib from 'zlib';
import { XMLParser } from 'fast-xml-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KANJIDIC_URL = 'https://www.edrdg.org/kanjidic/kanjidic2.xml.gz';
const JLPT_DIR = path.join(__dirname, '../public/data/kanji');
const CACHE_FILE = path.join(__dirname, '../.cache/kanjidic-grades.json');

/**
 * Download and decompress KANJIDIC2 XML
 */
async function fetchKanjidic() {
  return new Promise((resolve, reject) => {
    console.log('Fetching KANJIDIC2 from', KANJIDIC_URL);

    https.get(KANJIDIC_URL, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const chunks = [];
      const gunzip = zlib.createGunzip();

      response.pipe(gunzip);

      gunzip.on('data', (chunk) => chunks.push(chunk));
      gunzip.on('end', () => {
        const xml = Buffer.concat(chunks).toString('utf8');
        console.log(`Downloaded ${(xml.length / 1024 / 1024).toFixed(2)} MB of XML`);
        resolve(xml);
      });
      gunzip.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Parse KANJIDIC2 XML and extract grade mappings
 */
function parseKanjidicGrades(xml) {
  console.log('Parsing KANJIDIC2 XML...');

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });

  const data = parser.parse(xml);
  const characters = data.kanjidic2.character;

  const gradeMap = {};
  let graded = 0;
  let ungraded = 0;

  for (const char of characters) {
    const kanji = char.literal;
    const misc = char.misc;

    if (misc && misc.grade) {
      const grade = parseInt(misc.grade, 10);
      // Grades 1-6 are elementary school
      // Grade 8 is secondary school (常用漢字 taught in middle school)
      // Grade 9 is Jinmeiyō kanji (name kanji)
      // Grade 10 is variant of Jōyō kanji
      if (grade >= 1 && grade <= 6) {
        gradeMap[kanji] = grade;
      } else {
        gradeMap[kanji] = 'S'; // Secondary school or special
      }
      graded++;
    } else {
      gradeMap[kanji] = 'S'; // No official grade = secondary/advanced
      ungraded++;
    }
  }

  console.log(`Parsed ${characters.length} kanji: ${graded} with official grades, ${ungraded} defaulting to "S"`);
  return gradeMap;
}

/**
 * Cache the grade map to avoid re-downloading
 */
function cacheGrades(gradeMap) {
  const cacheDir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  fs.writeFileSync(CACHE_FILE, JSON.stringify(gradeMap, null, 2));
  console.log(`Cached grade map to ${CACHE_FILE}`);
}

/**
 * Load cached grades if available
 */
function loadCachedGrades() {
  if (fs.existsSync(CACHE_FILE)) {
    console.log('Loading cached grade map...');
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  }
  return null;
}

/**
 * Update JLPT JSON files with grade data
 */
function updateJlptFiles(gradeMap) {
  const jlptFiles = fs.readdirSync(JLPT_DIR).filter(f => f.startsWith('jlpt_') && f.endsWith('.json'));

  const stats = {
    total: 0,
    byGrade: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, S: 0 },
    missing: []
  };

  for (const file of jlptFiles) {
    const filePath = path.join(JLPT_DIR, file);
    const kanjiList = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    console.log(`\nProcessing ${file} (${kanjiList.length} kanji)...`);

    let updated = 0;
    for (const entry of kanjiList) {
      const grade = gradeMap[entry.kanji];
      if (grade !== undefined) {
        entry.grade = grade;
        stats.byGrade[grade]++;
        updated++;
      } else {
        // Kanji not in KANJIDIC - mark as secondary
        entry.grade = 'S';
        stats.byGrade['S']++;
        stats.missing.push(entry.kanji);
      }
      stats.total++;
    }

    // Write updated JSON
    fs.writeFileSync(filePath, JSON.stringify(kanjiList, null, 2));
    console.log(`  Updated ${updated}/${kanjiList.length} kanji with grades`);
  }

  return stats;
}

/**
 * Main execution
 */
async function main() {
  console.log('=== Adding Grade Data to JLPT Kanji Files ===\n');

  // Try to load from cache first
  let gradeMap = loadCachedGrades();

  if (!gradeMap) {
    // Download and parse KANJIDIC
    const xml = await fetchKanjidic();
    gradeMap = parseKanjidicGrades(xml);
    cacheGrades(gradeMap);
  }

  // Update JLPT files
  const stats = updateJlptFiles(gradeMap);

  // Print summary
  console.log('\n=== Summary ===');
  console.log(`Total kanji processed: ${stats.total}`);
  console.log('By grade:');
  for (const [grade, count] of Object.entries(stats.byGrade)) {
    if (count > 0) {
      const label = grade === 'S' ? 'Secondary (S)' : `Grade ${grade}`;
      console.log(`  ${label}: ${count}`);
    }
  }

  if (stats.missing.length > 0) {
    console.log(`\nKanji not found in KANJIDIC (marked as "S"): ${stats.missing.length}`);
    if (stats.missing.length <= 20) {
      console.log(`  ${stats.missing.join(', ')}`);
    }
  }

  console.log('\nDone!');
}

main().catch(console.error);
