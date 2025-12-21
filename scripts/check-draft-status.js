/**
 * Check the status of AI story drafts
 * Shows pending drafts that need completion and their checkpoint status
 */
const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function checkDraftStatus() {
  console.log('=== AI Story Draft Status ===\n');

  // Get drafts from last 7 days
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const drafts = await db.collection('ai_story_drafts')
    .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(weekAgo))
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();

  if (drafts.empty) {
    console.log('No drafts found in the last 7 days');
    process.exit(0);
  }

  console.log(`Found ${drafts.size} drafts in the last 7 days:\n`);

  // Group by status
  const byStatus = {};

  drafts.forEach(doc => {
    const d = doc.data();
    const status = d.status || 'unknown';
    if (!byStatus[status]) byStatus[status] = [];
    byStatus[status].push({ id: doc.id, data: d });
  });

  // Show summary
  console.log('--- Status Summary ---');
  for (const [status, items] of Object.entries(byStatus)) {
    const icon = status === 'published' ? '✅' :
                 status.startsWith('pending_') ? '⏳' :
                 status === 'failed' ? '❌' : '📝';
    console.log(`${icon} ${status}: ${items.length}`);
  }

  // Show details for pending and failed drafts
  console.log('\n--- Pending/Failed Drafts (need attention) ---');

  let hasPending = false;
  for (const doc of drafts.docs) {
    const d = doc.data();
    const status = d.status || 'unknown';

    if (status.startsWith('pending_') || status === 'failed') {
      hasPending = true;
      const created = d.createdAt ? d.createdAt.toDate().toISOString().substring(0, 16) : 'N/A';
      const checkpoint = d.checkpoint || {};

      console.log(`\nDraft: ${doc.id}`);
      console.log(`  Status: ${status}`);
      console.log(`  Created: ${created}`);
      console.log(`  Theme: ${d.theme || 'N/A'}`);
      console.log(`  JLPT Level: ${d.jlptLevel || 'N/A'}`);
      console.log(`  Page Count: ${d.pageCount || (d.pages ? d.pages.length : 'N/A')}`);

      if (checkpoint.lastCompletedStep) {
        console.log(`  Checkpoint:`);
        console.log(`    Last Step: ${checkpoint.lastCompletedStep}`);
        console.log(`    Last Index: ${checkpoint.lastCompletedIndex || 'N/A'}`);
        console.log(`    Failed Attempts: ${checkpoint.failedAttempts || 0}`);
        if (checkpoint.lastError) {
          console.log(`    Last Error: ${checkpoint.lastError.substring(0, 100)}`);
        }
      }

      // Check images
      const pages = d.pages || [];
      const pagesWithImages = pages.filter(p => p.imageUrl).length;
      console.log(`  Images: ${pagesWithImages}/${pages.length} pages have images`);
    }
  }

  if (!hasPending) {
    console.log('No pending or failed drafts - all drafts are published or in progress!');
  }

  // Show most recent drafts
  console.log('\n--- Recent Drafts (last 5) ---');
  drafts.docs.slice(0, 5).forEach(doc => {
    const d = doc.data();
    const created = d.createdAt ? d.createdAt.toDate().toISOString().substring(0, 16) : 'N/A';
    const status = d.status || 'unknown';
    const icon = status === 'published' ? '✅' :
                 status.startsWith('pending_') ? '⏳' :
                 status === 'failed' ? '❌' : '📝';
    console.log(`${icon} ${created} | ${doc.id.substring(0, 35)} | ${status}`);
  });

  process.exit(0);
}

checkDraftStatus().catch(e => { console.error(e); process.exit(1); });
