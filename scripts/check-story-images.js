/**
 * Check a story's image status before repair
 */

const admin = require('firebase-admin')
const path = require('path')

const serviceAccountPath = path.join(__dirname, '..', 'moshimoshi-service-account.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
    projectId: 'moshimoshi-de237',
  })
}

const db = admin.firestore()

async function checkStory() {
  // Check one of the stories with missing images
  const storyId = process.argv[2] || 'story_1765152027413_scheduler-system'

  console.log('=== Checking Story Image Status ===')
  console.log('Story ID:', storyId)

  const storyDoc = await db.collection('stories').doc(storyId).get()
  if (!storyDoc.exists) {
    console.log('Story not found!')
    process.exit(1)
  }

  const data = storyDoc.data()
  console.log('\n--- Story Data ---')
  console.log('Title:', data.title)
  console.log('Has characterSheet:', !!data.characterSheet)
  console.log('Has modelSheet:', !!data.modelSheet)
  console.log('Cover Image URL:', data.coverImageUrl || 'MISSING')
  console.log('Page Count:', data.pages ? data.pages.length : 0)

  if (data.characterSheet) {
    console.log('\n--- Character Sheet ---')
    const mainChar = data.characterSheet.mainCharacter
    console.log('Main Character Name:', mainChar ? mainChar.name : 'N/A')
    const visualDesc = mainChar ? mainChar.visualDescription : ''
    console.log('Visual Description:', visualDesc ? visualDesc.substring(0, 100) + '...' : 'N/A')
    console.log('Visual Style:', data.characterSheet.visualStyle || 'N/A')
  } else {
    console.log('\n--- NO CHARACTER SHEET - CANNOT REPAIR ---')
  }

  console.log('\n--- Pages ---')
  if (data.pages) {
    for (const page of data.pages) {
      const text = page.text || page.textJa || ''
      const hasImage = page.imageUrl ? 'YES' : 'MISSING'
      console.log(
        '  Page ' +
          page.pageNumber +
          ': imageUrl=' +
          hasImage +
          ', text=' +
          text.substring(0, 50) +
          '...'
      )
    }
  }

  // Summary
  const missingPages = data.pages
    ? data.pages.filter(function (p) {
        return !p.imageUrl
      }).length
    : 0
  const totalPages = data.pages ? data.pages.length : 0
  console.log('\n--- Summary ---')
  console.log('Total pages:', totalPages)
  console.log('Pages WITH images:', totalPages - missingPages)
  console.log('Pages MISSING images:', missingPages)
  console.log('Can repair:', !!data.characterSheet ? 'YES' : 'NO (no characterSheet)')

  process.exit(0)
}

checkStory().catch(function (err) {
  console.error('Error:', err)
  process.exit(1)
})
