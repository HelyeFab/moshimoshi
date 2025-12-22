/**
 * Compare draft data vs published story data
 */

const admin = require('firebase-admin')
const serviceAccount = require('../moshimoshi-service-account.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

async function compareDraftVsPublished() {
  const storyId = 'story_1766396144811_scheduler-system'
  const draftId = 'draft_1766396144811_scheduler-system'

  console.log('🔍 Comparing Draft vs Published Story')
  console.log('═'.repeat(80))
  console.log()

  // Get published story
  const storyDoc = await db.collection('stories').doc(storyId).get()
  const story = storyDoc.data()

  // Get draft (if it still exists)
  const draftDoc = await db.collection('ai_story_drafts').doc(draftId).get()

  if (!draftDoc.exists) {
    console.log('❌ Draft was deleted after publish')
    console.log('   Cannot compare - draft no longer exists')
    console.log()

    // Just show what the published story has
    console.log('PUBLISHED STORY FIELDS:')
    console.log('  modelSheetUrl:', story.modelSheetUrl || 'MISSING')
    console.log('  audioUrl:', story.audioUrl || 'MISSING')
    console.log('  fullAudioUrl:', story.fullAudioUrl || 'MISSING')
    console.log('  coverImageUrl:', story.coverImageUrl ? '✓' : 'MISSING')
    console.log('  pages[0].audioUrl:', story.pages?.[0]?.audioUrl || 'MISSING')

    // Check an older story with its draft
    console.log()
    console.log('Let me check the Hana story draft instead...')
    console.log()

    // Find the most recent draft that's still pending or complete
    const draftsSnapshot = await db
      .collection('ai_story_drafts')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get()

    if (!draftsSnapshot.empty) {
      console.log(`Found ${draftsSnapshot.size} recent drafts:`)
      console.log()

      draftsSnapshot.forEach(doc => {
        const data = doc.data()
        console.log(`Draft: ${doc.id}`)
        console.log(`  Status: ${data.status}`)
        console.log(`  modelSheet:`, data.modelSheet ? '✓' : 'MISSING')
        console.log(`  modelSheetUrl:`, data.modelSheetUrl || data.modelSheet?.imageUrl || 'MISSING')
        console.log(`  audioUrl:`, data.audioUrl || 'MISSING')
        console.log(`  fullAudioUrl:`, data.fullAudioUrl || 'MISSING')
        console.log(`  pages[0].audioUrl:`, data.pages?.[0]?.audioUrl || 'MISSING')
        console.log()
      })
    }

    process.exit(0)
  }

  const draft = draftDoc.data()

  console.log('DRAFT DATA (before publish):')
  console.log('  modelSheet:', draft.modelSheet ? '✓' : 'MISSING')
  console.log('  modelSheet.imageUrl:', draft.modelSheet?.imageUrl || 'MISSING')
  console.log('  modelSheetUrl:', draft.modelSheetUrl || 'MISSING')
  console.log('  audioUrl:', draft.audioUrl || 'MISSING')
  console.log('  fullAudioUrl:', draft.fullAudioUrl || 'MISSING')
  console.log('  pages[0].audioUrl:', draft.pages?.[0]?.audioUrl || 'MISSING')
  console.log()

  console.log('PUBLISHED STORY DATA:')
  console.log('  modelSheetUrl:', story.modelSheetUrl || 'MISSING')
  console.log('  audioUrl:', story.audioUrl || 'MISSING')
  console.log('  fullAudioUrl:', story.fullAudioUrl || 'MISSING')
  console.log('  coverImageUrl:', story.coverImageUrl ? '✓' : 'MISSING')
  console.log('  pages[0].audioUrl:', story.pages?.[0]?.audioUrl || 'MISSING')
  console.log()

  console.log('═'.repeat(80))
  console.log('WHAT GOT LOST IN PUBLISH:')
  console.log('═'.repeat(80))
  console.log()

  const lost = []

  if (draft.modelSheet?.imageUrl && !story.modelSheetUrl) {
    lost.push('modelSheetUrl (draft has it, story missing it)')
  }
  if (draft.fullAudioUrl && !story.audioUrl && !story.fullAudioUrl) {
    lost.push('fullAudioUrl (draft has it, story missing it)')
  }
  if (draft.pages?.[0]?.audioUrl && !story.pages?.[0]?.audioUrl) {
    lost.push('page audio URLs (draft has them, story missing them)')
  }

  if (lost.length > 0) {
    console.log('❌ Fields lost during publish:')
    lost.forEach(item => console.log(`   - ${item}`))
  } else {
    console.log('✅ No fields lost')
  }

  process.exit(0)
}

compareDraftVsPublished().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
