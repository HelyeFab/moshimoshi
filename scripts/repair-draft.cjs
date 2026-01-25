/**
 * Repair script for drafts with missing page data
 * This re-generates pages that are missing required fields (textWithFurigana, translation)
 */

const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const path = require('path');

const serviceAccount = JSON.parse(
  readFileSync(path.join(__dirname, '../moshimoshi-service-account.json'), 'utf8')
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

const DRAFT_ID = process.argv[2] || 'draft_1769299765109_scheduler-system';
const APP_URL = process.env.APP_URL || 'https://moshimoshi.day';
const ADMIN_KEY = process.env.STORY_SCHEDULER_ADMIN_KEY || 'story-scheduler-2025';

async function repairDraft() {
  console.log(`Repairing draft: ${DRAFT_ID}`);

  // Get draft
  const draftDoc = await db.collection('ai_story_drafts').doc(DRAFT_ID).get();
  if (!draftDoc.exists) {
    console.error('Draft not found');
    process.exit(1);
  }

  const draft = draftDoc.data();
  console.log('Draft status:', draft.status);
  console.log('JLPT Level:', draft.jlptLevel);
  console.log('Page count:', draft.pageCount);
  console.log('Theme:', draft.theme);

  // Check which pages need repair
  const pages = draft.pages || [];
  const pagesToRepair = [];

  for (let i = 0; i < draft.pageCount; i++) {
    const page = pages[i];
    if (!page || !page.textWithFurigana || !page.translation) {
      pagesToRepair.push(i + 1);
    }
  }

  if (pagesToRepair.length === 0) {
    console.log('All pages are complete! No repair needed.');
    return;
  }

  console.log(`Pages to repair: ${pagesToRepair.join(', ')}`);
  console.log('');

  // Re-generate each damaged page
  for (const pageNum of pagesToRepair) {
    console.log(`Regenerating page ${pageNum}...`);

    try {
      const response = await fetch(`${APP_URL}/api/admin/generate-story`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': ADMIN_KEY,
        },
        body: JSON.stringify({
          step: 'generate_page',
          jlptLevel: draft.jlptLevel,
          pageNumber: pageNum,
          draftId: DRAFT_ID,
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log(`  ✅ Page ${pageNum} regenerated successfully`);
        console.log(`     - text: ${result.data.text?.substring(0, 40)}...`);
        console.log(`     - translation: ${result.data.translation?.substring(0, 40)}...`);
        console.log(`     - textWithFurigana: ${result.data.textWithFurigana ? 'Present' : 'MISSING'}`);
      } else {
        console.error(`  ❌ Page ${pageNum} failed:`, result.error);
      }
    } catch (error) {
      console.error(`  ❌ Page ${pageNum} error:`, error.message);
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('');
  console.log('Repair complete. Verifying...');

  // Verify repair
  const verifyDoc = await db.collection('ai_story_drafts').doc(DRAFT_ID).get();
  const verifyData = verifyDoc.data();
  const verifyPages = verifyData.pages || [];

  let allGood = true;
  for (let i = 0; i < draft.pageCount; i++) {
    const page = verifyPages[i];
    const hasRequired = page && page.textWithFurigana && page.translation;
    console.log(`Page ${i + 1}: ${hasRequired ? '✅' : '❌'} textWithFurigana=${!!page?.textWithFurigana}, translation=${!!page?.translation}`);
    if (!hasRequired) allGood = false;
  }

  if (allGood) {
    console.log('');
    console.log('✅ All pages repaired! You can now try publishing the draft.');
  } else {
    console.log('');
    console.log('⚠️ Some pages still need repair. Check logs above.');
  }
}

repairDraft().catch(e => {
  console.error('Repair failed:', e);
  process.exit(1);
});
