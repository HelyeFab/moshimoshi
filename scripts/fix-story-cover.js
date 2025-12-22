/**
 * Fix story cover to use first page image instead of model sheet
 */

const admin = require('firebase-admin')
const serviceAccount = require('../moshimoshi-service-account.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

async function fixStoryCover() {
  const storyId = process.argv[2]

  if (!storyId) {
    console.log('Usage: node scripts/fix-story-cover.js <storyId>')
    process.exit(1)
  }

  console.log('🔧 Fixing Story Cover Image\n')
  console.log('Story ID:', storyId)
  console.log('═'.repeat(80))
  console.log()

  try {
    const doc = await db.collection('stories').doc(storyId).get()

    if (!doc.exists) {
      console.log('❌ Story not found')
      process.exit(1)
    }

    const data = doc.data()
    const pages = data.pages || []

    console.log('Story:', data.titleJa || data.title)
    console.log()

    if (pages.length === 0) {
      console.log('❌ Story has no pages')
      process.exit(1)
    }

    const firstPageImageUrl = pages[0].imageUrl

    if (!firstPageImageUrl) {
      console.log('❌ First page has no image')
      console.log('   Story needs image generation first')
      process.exit(1)
    }

    const currentCoverUrl = data.coverImageUrl
    console.log('Current Cover URL:')
    console.log(currentCoverUrl || '  (not set)')
    console.log()

    console.log('First Page Image URL:')
    console.log(firstPageImageUrl)
    console.log()

    // Check if it's a model sheet
    const isModelSheet = currentCoverUrl && currentCoverUrl.includes('model-sheet')

    if (currentCoverUrl === firstPageImageUrl) {
      console.log('✅ Cover is already using first page image')
      console.log('   No update needed')
      process.exit(0)
    }

    if (isModelSheet) {
      console.log('🔴 Detected: Cover is using MODEL SHEET')
      console.log('   This shows the character reference (3-pose turnaround) instead of story content')
      console.log()
    }

    console.log('⏳ Updating cover to use first page image...')
    console.log()

    await db.collection('stories').doc(storyId).update({
      coverImageUrl: firstPageImageUrl,
      updatedAt: new Date(),
    })

    console.log('✅ Cover updated successfully!')
    console.log()
    console.log('Before:', currentCoverUrl || '(not set)')
    console.log('After:', firstPageImageUrl)
    console.log()

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }

  process.exit(0)
}

fixStoryCover()
