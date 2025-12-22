/**
 * Check assets for recent stories to see if timeout is a pre-existing issue
 */

const admin = require('firebase-admin')
const serviceAccount = require('../moshimoshi-service-account.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

async function checkRecentStories() {
  console.log('🔍 Checking Recent Stories for Asset Completeness')
  console.log('═'.repeat(80))
  console.log()

  const snapshot = await db
    .collection('stories')
    .where('status', '==', 'published')
    .get()

  const stories = snapshot.docs
    .map(doc => ({
      doc,
      data: doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(0)
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5) // Last 5 stories

  console.log(`Checking last ${stories.length} published stories:`)
  console.log()

  stories.forEach(({ doc, data, createdAt }) => {
    const daysAgo = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))

    console.log(`Story: ${data.titleJa || data.title}`)
    console.log(`  Created: ${daysAgo} days ago`)
    console.log(`  JLPT: ${data.jlptLevel}`)
    console.log(`  Character: ${data.characterSheet?.mainCharacter?.name || 'N/A'}`)
    console.log()
    console.log(`  Cover Image: ${data.coverImageUrl ? '✓' : '✗'}`)
    console.log(`  Story Audio: ${data.audioUrl ? '✓' : '✗'}`)
    console.log(`  Model Sheet: ${data.modelSheetUrl ? '✓' : '✗'}`)

    const pages = data.pages || []
    const pagesWithImage = pages.filter(p => p.imageUrl).length
    const pagesWithAudio = pages.filter(p => p.audioUrl).length

    console.log(`  Page Images: ${pagesWithImage}/${pages.length}`)
    console.log(`  Page Audio: ${pagesWithAudio}/${pages.length}`)

    const isComplete = data.coverImageUrl && data.audioUrl && data.modelSheetUrl &&
      pagesWithImage === pages.length && pagesWithAudio === pages.length

    console.log(`  Status: ${isComplete ? '✅ COMPLETE' : '❌ INCOMPLETE'}`)
    console.log()
  })

  process.exit(0)
}

checkRecentStories().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
