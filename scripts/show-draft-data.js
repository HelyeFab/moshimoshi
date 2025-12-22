/**
 * Show raw draft data
 */

const admin = require('firebase-admin')
const serviceAccount = require('../moshimoshi-service-account.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

async function showDraft() {
  const draftId = process.argv[2] || 'draft_1766399089965_scheduler-system'

  const doc = await db.collection('ai_story_drafts').doc(draftId).get()

  if (!doc.exists) {
    console.log('Draft not found')
    process.exit(1)
  }

  const data = doc.data()

  console.log('Draft:', draftId)
  console.log('Status:', data.status)
  console.log()
  console.log('Theme:', data.theme || 'MISSING')
  console.log('JLPT:', data.jlptLevel || 'MISSING')
  console.log()
  console.log('Character:', data.characterSheet?.mainCharacter?.name || 'MISSING')
  console.log()
  console.log('Pages:', data.pages?.length || 0)
  if (data.pages && data.pages.length > 0) {
    data.pages.forEach((page, i) => {
      console.log(`  Page ${i + 1}:`)
      console.log(`    text: ${page.text?.substring(0, 30) || 'MISSING'}...`)
      console.log(`    imageUrl: ${page.imageUrl ? 'SET' : 'MISSING'}`)
      console.log(`    audioUrl: ${page.audioUrl ? 'SET' : 'MISSING'}`)
    })
  }
  console.log()
  console.log('Model sheet:', data.modelSheet?.imageUrl || 'MISSING')
  console.log('Full audio:', data.fullAudioUrl || 'MISSING')

  process.exit(0)
}

showDraft()
