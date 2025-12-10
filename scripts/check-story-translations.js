const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkStory() {
  // Search for the story by slug
  const snapshot = await db.collection('stories')
    .where('slug', '==', 'yuki-s-sports-day-miz8x4up')
    .limit(1)
    .get();

  if (snapshot.empty) {
    console.log('Story not found by slug, trying all stories...');
    const allStories = await db.collection('stories').limit(5).get();
    allStories.forEach(doc => {
      console.log('Found story:', doc.id, doc.data().slug);
    });
    return;
  }

  const doc = snapshot.docs[0];
  const data = doc.data();

  console.log('=== STORY FOUND ===');
  console.log('ID:', doc.id);
  console.log('Title:', data.title);
  console.log('TitleJa:', data.titleJa);
  console.log('Pages count:', data.pages?.length);
  console.log('');
  console.log('=== PAGE STRUCTURE ===');
  if (data.pages && data.pages.length > 0) {
    data.pages.forEach((page, i) => {
      console.log(`Page ${i + 1}:`);
      console.log('  - Fields:', Object.keys(page).join(', '));
      console.log('  - Has text:', !!page.text);
      console.log('  - Has textJa:', !!page.textJa);
      console.log('  - Has translation:', !!page.translation);
      console.log('  - Has textEn:', !!page.textEn);
      console.log('  - text preview:', (page.text || page.textJa || '').substring(0, 50));
      console.log('  - translation preview:', (page.translation || page.textEn || 'NONE').substring(0, 50));
    });
  }
}

async function checkDrafts() {
  console.log('\n=== CHECKING DRAFTS ===');
  const draftsSnapshot = await db.collection('ai_story_drafts').limit(3).get();

  if (draftsSnapshot.empty) {
    console.log('No drafts found');
    return;
  }

  draftsSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`\nDraft: ${doc.id}`);
    console.log('  Status:', data.status);
    console.log('  Theme:', data.theme);
    console.log('  Pages count:', data.pages?.length);

    if (data.pages && data.pages.length > 0) {
      console.log('  First page fields:', Object.keys(data.pages[0]).join(', '));
      console.log('  First page has translation:', !!data.pages[0].translation);
      if (data.pages[0].translation) {
        console.log('  Translation preview:', data.pages[0].translation.substring(0, 80));
      }
    }
  });
}

async function checkRecentStories() {
  console.log('\n=== CHECKING RECENT STORIES ===');
  const storiesSnapshot = await db.collection('stories')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  storiesSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`\nStory: ${doc.id}`);
    console.log('  Title:', data.title);
    console.log('  Created:', data.createdAt?.toDate?.()?.toISOString());
    console.log('  Pages count:', data.pages?.length);

    if (data.pages && data.pages.length > 0) {
      const hasTranslation = data.pages.some(p => p.translation && p.translation.length > 0);
      console.log('  Has any translations:', hasTranslation);
      if (hasTranslation) {
        console.log('  First translation:', data.pages[0].translation?.substring(0, 80));
      }
    }
  });
}

async function main() {
  await checkStory();
  await checkDrafts();
  await checkRecentStories();
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
