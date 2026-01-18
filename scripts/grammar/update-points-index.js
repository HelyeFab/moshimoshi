#!/usr/bin/env node
/**
 * Update points-index.json to add all N4 point IDs
 * This script:
 * 1. Reads the n4-index.json to get all N4 point IDs
 * 2. Updates points-index.json to add each N4 ID with value "n4"
 */

const fs = require('fs').promises;
const path = require('path');

const GRAMMAR_DIR = path.join(__dirname, '../../public/data/grammar');
const N4_INDEX_PATH = path.join(GRAMMAR_DIR, 'n4-index.json');
const POINTS_INDEX_PATH = path.join(GRAMMAR_DIR, 'points-index.json');

async function main() {
  console.log('📚 Updating points-index.json with N4 mappings...\n');

  // Step 1: Read N4 index to get all point IDs
  console.log('Step 1: Reading N4 point IDs from n4-index.json...');
  const n4IndexData = JSON.parse(await fs.readFile(N4_INDEX_PATH, 'utf-8'));
  const n4PointIds = n4IndexData.points.map(p => p.id);
  console.log(`  ✓ Found ${n4PointIds.length} N4 points\n`);

  // Step 2: Read current points-index.json
  console.log('Step 2: Reading current points-index.json...');
  const pointsIndexData = JSON.parse(await fs.readFile(POINTS_INDEX_PATH, 'utf-8'));
  const currentN5Count = Object.values(pointsIndexData.points).filter(v => v === 'n5').length;
  console.log(`  ✓ Current index has ${Object.keys(pointsIndexData.points).length} total points`);
  console.log(`  ✓ N5 points: ${currentN5Count}\n`);

  // Step 3: Add all N4 points
  console.log('Step 3: Adding N4 point mappings...');
  let addedCount = 0;
  let updatedCount = 0;

  for (const pointId of n4PointIds) {
    if (pointsIndexData.points[pointId]) {
      // Point already exists, update if needed
      if (pointsIndexData.points[pointId] !== 'n4') {
        pointsIndexData.points[pointId] = 'n4';
        updatedCount++;
      }
    } else {
      // Add new point
      pointsIndexData.points[pointId] = 'n4';
      addedCount++;
    }
  }

  console.log(`  ✓ Added ${addedCount} new N4 points`);
  console.log(`  ✓ Updated ${updatedCount} existing points\n`);

  // Step 4: Update metadata
  pointsIndexData.lastUpdated = new Date().toISOString().split('T')[0];

  // Step 5: Write updated index
  console.log('Step 4: Writing updated points-index.json...');
  await fs.writeFile(
    POINTS_INDEX_PATH,
    JSON.stringify(pointsIndexData, null, 2) + '\n',
    'utf-8'
  );

  const finalN5Count = Object.values(pointsIndexData.points).filter(v => v === 'n5').length;
  const finalN4Count = Object.values(pointsIndexData.points).filter(v => v === 'n4').length;

  console.log(`\n✅ Update complete!`);
  console.log(`  Total points: ${Object.keys(pointsIndexData.points).length}`);
  console.log(`  N5 points: ${finalN5Count}`);
  console.log(`  N4 points: ${finalN4Count}`);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
