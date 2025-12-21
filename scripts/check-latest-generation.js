/**
 * Check latest story generation status and integrity logs
 */
const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function check() {
  // Check ai_story_drafts for stalled/incomplete
  console.log('=== AI Story Drafts (last 7 days) ===');
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const drafts = await db.collection('ai_story_drafts')
    .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(weekAgo))
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  if (drafts.empty) {
    console.log('No drafts found in last 7 days');
  } else {
    drafts.forEach(doc => {
      const d = doc.data();
      const created = d.createdAt ? d.createdAt.toDate().toISOString().substring(0,16) : 'N/A';
      const pageCount = d.pages ? d.pages.length : 0;
      const pagesWithImages = d.pages ? d.pages.filter(p => p.imageUrl).length : 0;
      console.log(created, doc.id.substring(0,35), 'status:', d.status || 'unknown', 'pages:', pageCount, 'withImages:', pagesWithImages);
    });
  }

  // Check latest integrity log
  console.log('\n=== Latest Integrity Log ===');
  const logs = await db.collection('integrity_check_logs')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (logs.empty) {
    console.log('No integrity logs found');
  } else {
    const log = logs.docs[0].data();
    console.log('Timestamp:', log.timestamp || (log.createdAt ? log.createdAt.toDate().toISOString() : 'N/A'));
    console.log('Type:', log.type);
    console.log('Duration:', log.duration, 'ms');

    if (log.stories) {
      console.log('\nStories:');
      console.log('  Checked:', log.stories.checked);
      console.log('  Missing audio:', log.stories.missingAudio ? log.stories.missingAudio.length : 0);
      if (log.stories.missingAudio && log.stories.missingAudio.length > 0) {
        console.log('    IDs:', log.stories.missingAudio.slice(0, 5).join(', '));
      }
      console.log('  Missing images:', log.stories.missingImages ? log.stories.missingImages.length : 0);
      if (log.stories.missingImages && log.stories.missingImages.length > 0) {
        console.log('    IDs:', log.stories.missingImages.slice(0, 5).join(', '));
      }
      console.log('  Missing translations:', log.stories.missingTranslations ? log.stories.missingTranslations.length : 0);
      if (log.stories.missingTranslations && log.stories.missingTranslations.length > 0) {
        console.log('    IDs:', log.stories.missingTranslations.slice(0, 5).join(', '));
      }
      console.log('  Stalled drafts:', log.stories.stalledDrafts ? log.stories.stalledDrafts.length : 0);
      if (log.stories.stalledDrafts && log.stories.stalledDrafts.length > 0) {
        console.log('    IDs:', log.stories.stalledDrafts.slice(0, 5).join(', '));
      }
      console.log('  Repaired:', log.stories.repaired);
      console.log('  Repair failed:', log.stories.repairFailed);
    }
  }

  // Check the specific story if there's one with missing images
  console.log('\n=== Checking story with most recent missing images ===');
  const storiesQuery = await db.collection('stories')
    .where('status', '==', 'published')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  for (const doc of storiesQuery.docs) {
    const d = doc.data();
    const hasCover = !!d.coverImageUrl;
    const pages = d.pages || [];
    const missingPageImages = pages.filter(p => !p.imageUrl).length;

    if (!hasCover || missingPageImages > 0) {
      console.log('\nStory with missing images:', doc.id);
      console.log('  Title:', d.title);
      console.log('  Cover:', hasCover ? 'YES' : 'MISSING');
      console.log('  Pages missing images:', missingPageImages, '/', pages.length);
      pages.forEach((p, i) => {
        console.log('    Page', i+1, ':', p.imageUrl ? 'HAS IMAGE' : 'MISSING');
      });
    }
  }

  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
