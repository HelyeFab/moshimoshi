/**
 * Show raw story data
 */

const admin = require('firebase-admin')
const serviceAccount = require('../moshimoshi-service-account.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

async function showStory() {
  const storyId = process.argv[2] || 'story_1766396144811_scheduler-system'

  const doc = await db.collection('stories').doc(storyId).get()

  if (!doc.exists) {
    console.log('Story not found')
    process.exit(1)
  }

  const data = doc.data()

  console.log('Story:', data.titleJa || data.title)
  console.log()
  console.log('Audio fields:')
  console.log('  audioUrl:', data.audioUrl || 'MISSING')
  console.log('  fullAudioUrl:', data.fullAudioUrl || 'MISSING')
  console.log()
  console.log('Model sheet:')
  console.log('  modelSheetUrl:', data.modelSheetUrl || 'MISSING')
  console.log()
  console.log('Pages:')
  data.pages?.forEach((page, i) => {
    console.log(`  Page ${i + 1}:`)
    console.log(`    imageUrl: ${page.imageUrl || 'MISSING'}`)
    console.log(`    audioUrl: ${page.audioUrl || 'MISSING'}`)
  })

  process.exit(0)
}

showStory()
