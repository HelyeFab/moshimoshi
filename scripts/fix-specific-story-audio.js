/**
 * Fix audio for a specific story by calling the generate-story-audio API
 */

require('dotenv').config({ path: '.env.local' })

const storyId = process.argv[2] || 'story_1766396144811_scheduler-system'
const adminKey = process.env.INTEGRITY_CHECKER_ADMIN_KEY || 'integrity-checker-2025'

async function fixStoryAudio() {
  console.log('🔧 Fixing Story Audio')
  console.log('═'.repeat(80))
  console.log()
  console.log('Story ID:', storyId)
  console.log()

  try {
    // Fetch story data
    const admin = require('firebase-admin')
    const serviceAccount = require('../moshimoshi-service-account.json')

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      })
    }

    const db = admin.firestore()
    const doc = await db.collection('stories').doc(storyId).get()

    if (!doc.exists) {
      console.log('❌ Story not found')
      process.exit(1)
    }

    const story = doc.data()
    console.log('Story:', story.titleJa || story.title)
    console.log('Pages:', story.pages?.length || 0)
    console.log()

    if (!story.pages || story.pages.length === 0) {
      console.log('❌ Story has no pages')
      process.exit(1)
    }

    console.log('Calling audio generation API...')
    console.log()

    const response = await fetch(
      'https://moshimoshi.app/api/admin/generate-story-audio',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey,
        },
        body: JSON.stringify({
          storyId: storyId,
          pages: story.pages.map((p, i) => ({
            pageNumber: p.pageNumber || i + 1,
            text: p.text,
          })),
          voice: '23',
          generateFullAudio: true,
          generatePageAudio: true,
        }),
      }
    )

    const result = await response.json()

    if (!response.ok) {
      console.log('❌ API Error:', result.error || 'Unknown error')
      console.log('Response:', JSON.stringify(result, null, 2))
      process.exit(1)
    }

    console.log('✅ Audio generation completed!')
    console.log()
    console.log('Full audio URL:', result.fullAudioUrl || 'N/A')
    console.log('Page audio count:', result.pageAudioCount || 0)
    console.log('Errors:', result.errors?.length || 0)

    if (result.errors && result.errors.length > 0) {
      console.log()
      console.log('Errors:')
      result.errors.forEach(err => console.log('  -', err))
    }

    console.log()
    console.log('Verify at: https://moshimoshi.app/en/story/interactive/' + storyId)

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

fixStoryAudio()
