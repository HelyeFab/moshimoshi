#!/usr/bin/env node
/**
 * Fix N4 relatedPoints to use IDs instead of titles
 * This script:
 * 1. Reads the n4-index.json to build a title -> ID mapping
 * 2. Updates all N4 point files to replace title-based relatedPoints with IDs
 */

const fs = require('fs').promises;
const path = require('path');

const GRAMMAR_DIR = path.join(__dirname, '../../public/data/grammar');
const N4_INDEX_PATH = path.join(GRAMMAR_DIR, 'n4-index.json');
const N4_POINTS_DIR = path.join(GRAMMAR_DIR, 'points/n4');

async function main() {
  console.log('📚 Starting N4 relatedPoints normalization...\n');

  // Step 1: Read the index and build title -> ID mapping
  console.log('Step 1: Building title → ID mapping from n4-index.json...');
  const indexData = JSON.parse(await fs.readFile(N4_INDEX_PATH, 'utf-8'));

  const titleToId = new Map();
  for (const point of indexData.points) {
    // Map Japanese title to ID
    if (point.title?.ja) {
      titleToId.set(point.title.ja, point.id);
    }
    // Also map English and romaji titles as fallback
    if (point.title?.en) {
      titleToId.set(point.title.en, point.id);
    }
    if (point.title?.romaji) {
      titleToId.set(point.title.romaji, point.id);
    }
  }

  console.log(`  ✓ Built mapping for ${titleToId.size} title variations → ${indexData.points.length} IDs\n`);

  // Step 2: Process all N4 point files
  console.log('Step 2: Processing N4 point files...');
  const files = await fs.readdir(N4_POINTS_DIR);
  const jsonFiles = files.filter(f => f.endsWith('.json'));

  let filesUpdated = 0;
  let totalRelatedPointsFixed = 0;
  const unmappedReferences = new Set();

  for (const file of jsonFiles) {
    const filePath = path.join(N4_POINTS_DIR, file);
    const pointData = JSON.parse(await fs.readFile(filePath, 'utf-8'));

    if (!pointData.relatedPoints || pointData.relatedPoints.length === 0) {
      continue;
    }

    const originalRelatedPoints = [...pointData.relatedPoints];
    const newRelatedPoints = [];

    for (const relatedRef of originalRelatedPoints) {
      // Check if it's already an ID (matches pattern: NNN-n4-point-N or similar)
      if (/^\d{3}-n4-point-\d+$/.test(relatedRef)) {
        newRelatedPoints.push(relatedRef);
        continue;
      }

      // Try to map title to ID
      const mappedId = titleToId.get(relatedRef);
      if (mappedId) {
        newRelatedPoints.push(mappedId);
        totalRelatedPointsFixed++;
      } else {
        // Record unmapped reference for reporting
        unmappedReferences.add(relatedRef);
        console.log(`  ⚠️  Unmapped reference in ${file}: "${relatedRef}"`);
      }
    }

    // Only update if we made changes
    if (JSON.stringify(originalRelatedPoints) !== JSON.stringify(newRelatedPoints)) {
      pointData.relatedPoints = newRelatedPoints;
      await fs.writeFile(filePath, JSON.stringify(pointData, null, 2) + '\n', 'utf-8');
      filesUpdated++;
    }
  }

  console.log(`\n✅ Normalization complete!`);
  console.log(`  Files processed: ${jsonFiles.length}`);
  console.log(`  Files updated: ${filesUpdated}`);
  console.log(`  Related points fixed: ${totalRelatedPointsFixed}`);

  if (unmappedReferences.size > 0) {
    console.log(`\n⚠️  Unmapped references (${unmappedReferences.size}):`);
    for (const ref of unmappedReferences) {
      console.log(`    - "${ref}"`);
    }
  } else {
    console.log(`\n🎉 All relatedPoints successfully mapped!`);
  }
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
