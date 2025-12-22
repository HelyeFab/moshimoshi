/**
 * Manually fix the Yui story that was published before the bug fix
 */

const admin = require('firebase-admin')
const serviceAccount = require('../moshimoshi-service-account.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()
const storyId = 'story_1766396144811_scheduler-system'

async function fixStory() {
  console.log('🔧 Manually Fixing Yui Story')
  console.log('═'.repeat(80))
  console.log()

  const doc = await db.collection('stories').doc(storyId).get()
  if (!doc.exists) {
    console.log('❌ Story not found')
    process.exit(1)
  }

  const story = doc.data()
  console.log('Story:', story.titleJa || story.title)
  console.log()

  const updates = {}

  // Fix 1: Copy fullAudioUrl to audioUrl
  if (story.fullAudioUrl && !story.audioUrl) {
    updates.audioUrl = story.fullAudioUrl
    console.log('✓ Will copy fullAudioUrl to audioUrl')
    console.log('  ', story.fullAudioUrl)
  }

  // Fix 2: Update page imageUrls (they should point to draft folder)
  const pages = story.pages || []
  const fixedPages = pages.map((page, i) => {
    const pageNum = i + 1
    if (!page.imageUrl) {
      const draftImageUrl = `https://storage.googleapis.com/moshimoshi-de237.firebasestorage.app/ai-stories/draft_1766396144811_scheduler-system/page-${pageNum}.png`
      return {
        ...page,
        imageUrl: draftImageUrl
      }
    }
    return page
  })

  const hasImageFixes = fixedPages.some((p, i) => p.imageUrl !== pages[i]?.imageUrl)
  if (hasImageFixes) {
    updates.pages = fixedPages
    console.log('✓ Will update page image URLs')
  }

  if (Object.keys(updates).length === 0) {
    console.log('✅ No fixes needed')
    process.exit(0)
  }

  console.log()
  console.log('Applying updates...')
  await db.collection('stories').doc(storyId).update(updates)

  console.log('✅ Story fixed!')
  console.log()
  console.log('Verify at: https://moshimoshi.app/en/story/interactive/' + storyId)

  process.exit(0)
}

fixStory().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
