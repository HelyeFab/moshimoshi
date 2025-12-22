/**
 * Check what fields are in published drafts
 */

const admin = require('firebase-admin')
const serviceAccount = require('../moshimoshi-service-account.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

async function checkDrafts() {
  const snapshot = await db
    .collection('ai_story_drafts')
    .where('status', '==', 'published')
    .get()

  // Sort in memory
  const sorted = snapshot.docs
    .map(doc => ({ doc, createdAt: doc.data().createdAt?.toDate() || new Date(0) }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5)

  console.log(`Found ${sorted.length} recent published drafts`)
  console.log()

  sorted.forEach(({ doc, createdAt }) => {
    const data = doc.data()
    const daysAgo = createdAt ? Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 'N/A'

    console.log(`Draft: ${doc.id} (${daysAgo} days ago)`)
    console.log(`  Theme: ${data.theme}`)
    console.log(`  Character: ${data.characterSheet?.mainCharacter?.name || 'N/A'}`)
    console.log()
    console.log('  Fields:')
    console.log(`    modelSheet: ${data.modelSheet ? '✓' : '✗'}`)
    console.log(`    modelSheet.imageUrl: ${data.modelSheet?.imageUrl ? '✓' : '✗'}`)
    console.log(`    fullAudioUrl: ${data.fullAudioUrl ? '✓' : '✗'}`)
    console.log(`    audioUrl: ${data.audioUrl ? '✓' : '✗'}`)
    console.log(`    pages: ${data.pages?.length || 0}`)
    console.log(`    pages[0].audioUrl: ${data.pages?.[0]?.audioUrl ? '✓' : '✗'}`)
    console.log()
  })

  process.exit(0)
}

checkDrafts().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
