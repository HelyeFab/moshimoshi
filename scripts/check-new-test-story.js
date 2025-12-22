/**
 * Check the new test story
 */

const admin = require('firebase-admin')
const serviceAccount = require('../moshimoshi-service-account.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

async function checkStory() {
  const draftId = 'draft_1766399089965_scheduler-system'
  const storyId = 'story_1766399089965_scheduler-system'

  console.log('🔍 Checking New Test Story')
  console.log('═'.repeat(80))
  console.log()

  console.log('DRAFT DATA:')
  const draftDoc = await db.collection('ai_story_drafts').doc(draftId).get()
  if (draftDoc.exists) {
    const draft = draftDoc.data()
    console.log('  Status:', draft.status)
    console.log('  Theme:', draft.theme)
    console.log('  JLPT:', draft.jlptLevel)
    console.log('  Character:', draft.characterSheet?.mainCharacter?.name)
    console.log('  Model sheet URL:', draft.modelSheet?.imageUrl ? '✓' : '✗')
    console.log('  Full audio URL:', draft.fullAudioUrl ? '✓' : '✗')
    console.log('  Pages:', draft.pages?.length || 0)
    if (draft.pages && draft.pages.length > 0) {
      console.log('  Page[0] audio:', draft.pages[0].audioUrl ? '✓' : '✗')
      console.log('  Page[0] image:', draft.pages[0].imageUrl ? '✓' : '✗')
    }
  } else {
    console.log('  ❌ Draft not found (deleted after publish)')
  }

  console.log()
  console.log('PUBLISHED STORY DATA:')
  const storyDoc = await db.collection('stories').doc(storyId).get()
  if (storyDoc.exists) {
    const story = storyDoc.data()
    console.log('  Title:', story.titleJa || story.title)
    console.log('  JLPT:', story.jlptLevel)
    console.log('  Character:', story.characterSheet?.mainCharacter?.name, `(${story.characterSheet?.mainCharacter?.nameJa})`)
    console.log()
    console.log('  Assets:')
    console.log('    Model sheet:', story.modelSheetUrl ? '✓' : '✗')
    console.log('    Story audio:', story.audioUrl ? '✓' : '✗')
    console.log('    Cover image:', story.coverImageUrl ? '✓' : '✗')
    console.log('    Pages:', story.pages?.length || 0)
    if (story.pages && story.pages.length > 0) {
      const audioCount = story.pages.filter(p => p.audioUrl).length
      const imageCount = story.pages.filter(p => p.imageUrl).length
      console.log(`    Page audio: ${audioCount}/${story.pages.length}`)
      console.log(`    Page images: ${imageCount}/${story.pages.length}`)
    }
    console.log()
    console.log('  View at: https://moshimoshi.app/en/story/interactive/' + storyId)
  } else {
    console.log('  ❌ Story not published yet')
  }

  console.log()
  console.log('═'.repeat(80))
  console.log('VERIFICATION')
  console.log('═'.repeat(80))

  if (storyDoc.exists) {
    const story = storyDoc.data()
    const issues = []

    if (!story.modelSheetUrl) issues.push('Missing model sheet URL')
    if (!story.audioUrl) issues.push('Missing story audio URL')
    if (!story.coverImageUrl) issues.push('Missing cover image')

    const pages = story.pages || []
    const audioCount = pages.filter(p => p.audioUrl).length
    const imageCount = pages.filter(p => p.imageUrl).length

    if (audioCount < pages.length) issues.push(`${pages.length - audioCount} page(s) missing audio`)
    if (imageCount < pages.length) issues.push(`${pages.length - imageCount} page(s) missing images`)

    if (issues.length === 0) {
      console.log('✅ Story is COMPLETE - all assets present!')
    } else {
      console.log(`❌ Story has ${issues.length} issue(s):`)
      issues.forEach(issue => console.log(`   - ${issue}`))
    }
  }

  process.exit(0)
}

checkStory().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
