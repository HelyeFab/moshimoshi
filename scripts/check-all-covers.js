/**
 * Check all stories for model sheet being used as cover
 */

const admin = require('firebase-admin')
const serviceAccount = require('../moshimoshi-service-account.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

async function checkAllCovers() {
  console.log('🔍 Checking All Story Covers\n')

  try {
    const snapshot = await db.collection('stories').where('status', '==', 'published').get()

    console.log(`Found ${snapshot.size} published stories\n`)

    const usingModelSheet = []
    const missingCover = []
    const correct = []

    snapshot.forEach(doc => {
      const data = doc.data()
      const storyId = doc.id
      const title = data.titleJa || data.title || 'Untitled'
      const coverUrl = data.coverImageUrl
      const pages = data.pages || []
      const firstPageUrl = pages.length > 0 ? pages[0].imageUrl : null

      if (!coverUrl) {
        missingCover.push({ id: storyId, title })
      } else if (coverUrl.includes('model-sheet')) {
        usingModelSheet.push({ id: storyId, title, coverUrl, firstPageUrl })
      } else if (coverUrl === firstPageUrl) {
        correct.push({ id: storyId, title })
      } else {
        // Cover is set but using different image (might be intentional)
        correct.push({ id: storyId, title, note: 'using custom cover' })
      }
    })

    console.log('═'.repeat(80))
    console.log('📊 COVER IMAGE REPORT')
    console.log('═'.repeat(80))
    console.log()

    console.log(`✅ Correct: ${correct.length}`)
    console.log(`🔴 Using Model Sheet: ${usingModelSheet.length}`)
    console.log(`⚠️  Missing Cover: ${missingCover.length}`)
    console.log()

    if (usingModelSheet.length > 0) {
      console.log('═'.repeat(80))
      console.log('🔴 STORIES USING MODEL SHEET AS COVER')
      console.log('═'.repeat(80))
      console.log()

      usingModelSheet.forEach((story, index) => {
        console.log(`${index + 1}. ${story.title}`)
        console.log(`   ID: ${story.id}`)
        console.log(`   Cover: ${story.coverUrl}`)
        if (story.firstPageUrl) {
          console.log(`   Should use: ${story.firstPageUrl}`)
        } else {
          console.log(`   ⚠️  First page has no image!`)
        }
        console.log()
      })

      console.log('To fix all at once, run:')
      console.log()
      usingModelSheet.forEach(story => {
        if (story.firstPageUrl) {
          console.log(`node scripts/fix-story-cover.js ${story.id}`)
        }
      })
      console.log()
    }

    if (missingCover.length > 0) {
      console.log('═'.repeat(80))
      console.log('⚠️  STORIES MISSING COVER')
      console.log('═'.repeat(80))
      console.log()

      missingCover.forEach((story, index) => {
        console.log(`${index + 1}. ${story.title}`)
        console.log(`   ID: ${story.id}`)
        console.log()
      })
    }

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }

  process.exit(0)
}

checkAllCovers()
