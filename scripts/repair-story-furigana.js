const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Convert parenthetical furigana 陸（りく） to ruby tags <ruby>陸<rt>りく</rt></ruby>
function convertParentheticalToRuby(text) {
  if (!text) return text;

  // Pattern: kanji（furigana）
  const pattern = /([一-龯々〆ヵヶ]+)（([ぁ-んァ-ヶー]+)）/g;

  return text.replace(pattern, '<ruby>$1<rt>$2</rt></ruby>');
}

// Check if text uses parenthetical format
function hasParentheticalFurigana(text) {
  if (!text) return false;
  return /[一-龯々〆ヵヶ]+（[ぁ-んァ-ヶー]+）/.test(text);
}

// Check if text already has ruby tags
function hasRubyTags(text) {
  if (!text) return false;
  return /<ruby>.*?<rt>.*?<\/rt><\/ruby>/.test(text);
}

// Remove parenthetical furigana to get plain text
function removeParentheticalFurigana(text) {
  if (!text) return text;

  // Remove （furigana）, keep only the kanji
  const pattern = /([一-龯々〆ヵヶ]+)（[ぁ-んァ-ヶー]+）/g;

  return text.replace(pattern, '$1');
}

async function analyzeStory(storyId, storyData) {
  const issues = [];
  const pages = storyData.pages || [];

  if (pages.length === 0) {
    issues.push('No pages found');
    return { storyId, issues, pages: [], needsRepair: false };
  }

  const pageIssues = pages.map((page, index) => {
    const pageNumber = index + 1;
    const pageProblems = [];

    // Check if textWithFurigana is missing
    if (!page.textWithFurigana) {
      pageProblems.push('Missing textWithFurigana field');
    }

    // Check if text has parenthetical format (should be plain)
    if (hasParentheticalFurigana(page.text)) {
      pageProblems.push('text field has parenthetical furigana (should be plain)');
    }

    // Check if textWithFurigana has parenthetical format (should be ruby tags)
    if (page.textWithFurigana && hasParentheticalFurigana(page.textWithFurigana)) {
      pageProblems.push('textWithFurigana has parenthetical format (should be ruby tags)');
    }

    // Check if textWithFurigana lacks ruby tags but should have them
    if (page.textWithFurigana && !hasRubyTags(page.textWithFurigana) && page.textWithFurigana !== page.text) {
      pageProblems.push('textWithFurigana missing ruby tags');
    }

    return {
      pageNumber,
      text: page.text,
      textWithFurigana: page.textWithFurigana,
      issues: pageProblems,
    };
  });

  const pagesWithIssues = pageIssues.filter(p => p.issues.length > 0);

  if (pagesWithIssues.length > 0) {
    issues.push(`${pagesWithIssues.length} pages with furigana issues`);
  }

  return {
    storyId,
    title: storyData.title,
    titleJa: storyData.titleJa,
    jlptLevel: storyData.jlptLevel,
    publishedAt: storyData.publishedAt?.toDate?.().toISOString(),
    issues,
    pages: pagesWithIssues,
    needsRepair: pagesWithIssues.length > 0,
  };
}

async function repairStory(storyId, storyData, dryRun = true) {
  const pages = storyData.pages || [];
  let repairedCount = 0;

  const repairedPages = pages.map((page, index) => {
    const pageNumber = index + 1;
    let repaired = false;
    const changes = [];

    // Create a copy to modify
    const repairedPage = { ...page };

    // Issue 1: text has parenthetical furigana - remove it to get plain text
    if (hasParentheticalFurigana(page.text)) {
      repairedPage.text = removeParentheticalFurigana(page.text);
      changes.push('Removed parenthetical furigana from text field');
      repaired = true;
    }

    // Issue 2: textWithFurigana is missing - generate from original text with parentheses
    if (!page.textWithFurigana) {
      // Use the original page.text (which likely has parenthetical) to generate ruby tags
      const sourceText = page.text; // This has parenthetical format
      repairedPage.textWithFurigana = convertParentheticalToRuby(sourceText);
      changes.push('Generated textWithFurigana with ruby tags from parenthetical format');
      repaired = true;
    }
    // Issue 3: textWithFurigana has parenthetical format - convert to ruby tags
    else if (hasParentheticalFurigana(page.textWithFurigana)) {
      repairedPage.textWithFurigana = convertParentheticalToRuby(page.textWithFurigana);
      changes.push('Converted textWithFurigana from parenthetical to ruby tags');
      repaired = true;
    }

    if (repaired) {
      repairedCount++;
      console.log(`  Page ${pageNumber}:`);
      changes.forEach(c => console.log(`    - ${c}`));
      console.log(`    Original text: ${page.text?.substring(0, 60)}...`);
      console.log(`    Repaired text: ${repairedPage.text?.substring(0, 60)}...`);
      console.log(`    Repaired textWithFurigana: ${repairedPage.textWithFurigana?.substring(0, 80)}...`);
    }

    return repairedPage;
  });

  if (repairedCount === 0) {
    return { repaired: false, count: 0 };
  }

  if (!dryRun) {
    // Update the story in Firestore
    await db.collection('stories').doc(storyId).update({
      pages: repairedPages,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`✅ Updated story ${storyId} in Firestore`);
  } else {
    console.log(`🔍 DRY RUN: Would update ${repairedCount} pages in story ${storyId}`);
  }

  return { repaired: true, count: repairedCount };
}

async function scanAllStories(dryRun = true) {
  console.log('=== Scanning All Stories for Furigana Issues ===\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'REPAIR MODE (will update stories)'}\n`);

  const storiesSnapshot = await db.collection('stories')
    .orderBy('publishedAt', 'desc')
    .get();

  console.log(`Found ${storiesSnapshot.size} total stories\n`);

  const results = {
    total: storiesSnapshot.size,
    withIssues: 0,
    repaired: 0,
    failed: 0,
    stories: [],
  };

  for (const doc of storiesSnapshot.docs) {
    const storyData = doc.data();
    const analysis = await analyzeStory(doc.id, storyData);

    if (analysis.needsRepair) {
      results.withIssues++;
      results.stories.push(analysis);

      console.log(`\n📖 Story: ${analysis.title} (${analysis.titleJa})`);
      console.log(`   ID: ${analysis.storyId}`);
      console.log(`   JLPT: ${analysis.jlptLevel}`);
      console.log(`   Published: ${analysis.publishedAt}`);
      console.log(`   Issues:`);
      analysis.issues.forEach(issue => console.log(`     - ${issue}`));

      if (analysis.pages.length > 0) {
        console.log(`   Affected pages:`);
        analysis.pages.forEach(page => {
          console.log(`     Page ${page.pageNumber}:`);
          page.issues.forEach(issue => console.log(`       - ${issue}`));
        });
      }

      // Attempt repair
      try {
        const repairResult = await repairStory(doc.id, storyData, dryRun);
        if (repairResult.repaired) {
          results.repaired++;
        }
      } catch (error) {
        console.error(`   ❌ Failed to repair: ${error.message}`);
        results.failed++;
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total stories scanned: ${results.total}`);
  console.log(`Stories with issues: ${results.withIssues}`);
  console.log(`Stories repaired: ${results.repaired}`);
  console.log(`Repair failures: ${results.failed}`);

  if (dryRun) {
    console.log('\n⚠️  This was a DRY RUN. No changes were made.');
    console.log('To actually repair the stories, run with --repair flag:');
    console.log('  node scripts/repair-story-furigana.js --repair');
  } else {
    console.log('\n✅ Repair completed!');
  }

  return results;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--repair');

  if (args.includes('--help')) {
    console.log(`
Story Furigana Repair Script

Usage:
  node scripts/repair-story-furigana.js [options]

Options:
  --repair    Actually repair the stories (default is dry-run)
  --help      Show this help message

Examples:
  # Dry run (analyze only, no changes)
  node scripts/repair-story-furigana.js

  # Actually repair all stories with issues
  node scripts/repair-story-furigana.js --repair
    `);
    process.exit(0);
  }

  try {
    await scanAllStories(dryRun);
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
