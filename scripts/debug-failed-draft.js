/**
 * Debug failed draft generation
 */

const admin = require('firebase-admin')
const serviceAccount = require('../moshimoshi-service-account.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

async function debugDraft() {
  const draftId = 'draft_1766396144811_scheduler-system'

  console.log('🔍 Debugging Failed Draft Generation')
  console.log('═'.repeat(80))
  console.log()
  console.log('Draft ID:', draftId)
  console.log()

  const doc = await db.collection('ai_story_drafts').doc(draftId).get()

  if (!doc.exists) {
    console.log('❌ Draft not found')
    process.exit(1)
  }

  const data = doc.data()

  console.log('Status:', data.status)
  console.log('Theme:', data.theme)
  console.log('JLPT:', data.jlptLevel)
  console.log()

  console.log('Checkpoint:')
  console.log('  Last Completed Step:', data.checkpoint?.lastCompletedStep || 'none')
  console.log('  Last Completed Index:', data.checkpoint?.lastCompletedIndex)
  console.log('  Failed Attempts:', data.checkpoint?.failedAttempts || 0)
  console.log('  Last Error:', data.checkpoint?.lastError || 'none')
  console.log()

  console.log('Character Sheet:', data.characterSheet ? '✓' : '✗')
  console.log('Outline:', data.outline ? '✓' : '✗')
  console.log('Quiz:', data.quiz ? '✓' : '✗')
  console.log()

  console.log('Assets:')
  console.log('  Model Sheet URL:', data.modelSheetUrl ? '✓' : '✗ MISSING')
  console.log('  Story Audio URL:', data.audioUrl ? '✓' : '✗ MISSING')
  console.log()

  console.log('Pages:', data.pages?.length || 0)
  if (data.pages) {
    data.pages.forEach((page, i) => {
      console.log(`  Page ${i + 1}:`)
      console.log(`    Text: ${page.text ? '✓' : '✗'}`)
      console.log(`    Image: ${page.imageUrl ? '✓' : '✗ MISSING'}`)
      console.log(`    Audio: ${page.audioUrl ? '✓' : '✗ MISSING'}`)
    })
  }
  console.log()

  // Check generation logs
  const logsSnapshot = await db
    .collection('story_generation_logs')
    .where('draftId', '==', draftId)
    .get()

  if (!logsSnapshot.empty) {
    console.log('Generation Logs:')
    logsSnapshot.forEach(logDoc => {
      const log = logDoc.data()
      console.log('  Type:', log.type)
      console.log('  Success:', log.success)
      console.log('  Error:', log.error || 'none')
      console.log('  Duration:', log.duration ? `${Math.floor(log.duration / 1000)}s` : 'N/A')
      console.log()
    })
  }

  // Determine what failed
  console.log('═'.repeat(80))
  console.log('FAILURE ANALYSIS')
  console.log('═'.repeat(80))
  console.log()

  const lastStep = data.checkpoint?.lastCompletedStep
  console.log('Generation stopped at:', lastStep)
  console.log()

  if (lastStep === 'audio') {
    console.log('❌ PROBLEM: Generation completed through audio step')
    console.log('   But model sheet and story audio are missing')
    console.log('   This suggests:')
    console.log('   - Model sheet generation may have failed')
    console.log('   - Story audio generation may have failed')
    console.log('   - Or the function timed out before completing')
  }

  process.exit(0)
}

debugDraft().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
