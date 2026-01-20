require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

const serviceAccount = require('../moshimoshi-service-account.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function checkFailedDraft() {
  const draftId = 'draft_1768935546232_scheduler-system';

  console.log('='.repeat(80));
  console.log('CHECKING FAILED DRAFT');
  console.log('='.repeat(80));

  const draftDoc = await db.collection('ai_story_drafts').doc(draftId).get();

  if (!draftDoc.exists) {
    console.log('❌ Draft not found!');
    return;
  }

  const draft = draftDoc.data();

  console.log('\nDraft ID:', draftId);
  console.log('Theme:', draft.theme);
  console.log('JLPT Level:', draft.jlptLevel);
  console.log('Status:', draft.status);
  console.log('Created At:', draft.createdAt?.toDate?.());
  console.log('Updated At:', draft.updatedAt?.toDate?.());

  console.log('\n' + '='.repeat(80));
  console.log('PAGES STRUCTURE');
  console.log('='.repeat(80));

  if (draft.pages && draft.pages.length > 0) {
    console.log('\nTotal pages:', draft.pages.length);

    draft.pages.forEach((page, idx) => {
      console.log(`\n--- Page ${idx + 1} ---`);
      console.log('Fields present:');
      Object.keys(page).forEach(key => {
        const value = page[key];
        const preview = typeof value === 'string'
          ? value.substring(0, 60) + '...'
          : typeof value === 'object'
          ? JSON.stringify(value).substring(0, 60) + '...'
          : value;
        console.log(`  ${key}: ${preview}`);
      });

      console.log('\nMissing fields:');
      if (!page.translation && !page.textEn) {
        console.log('  ❌ translation/textEn: MISSING');
      } else {
        console.log('  ✅ translation/textEn: PRESENT');
      }

      if (!page.textWithFurigana && !page.textJa) {
        console.log('  ⚠️  textWithFurigana/textJa: MISSING');
      } else {
        console.log('  ✅ textWithFurigana/textJa: PRESENT');
      }
    });
  } else {
    console.log('❌ No pages found!');
  }

  console.log('\n' + '='.repeat(80));
  console.log('DIAGNOSIS');
  console.log('='.repeat(80));

  const missingTranslations = draft.pages?.filter(p => !p.translation && !p.textEn) || [];
  if (missingTranslations.length > 0) {
    console.log('\n❌ Problem: Pages are missing translation/textEn field');
    console.log('   Affected pages:', missingTranslations.length, 'of', draft.pages?.length);
    console.log('\n💡 Solution: Story scheduler needs to generate pages with:');
    console.log('   - page.translation (English translation)');
    console.log('   OR');
    console.log('   - page.textEn (English translation)');
  }
}

checkFailedDraft()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
