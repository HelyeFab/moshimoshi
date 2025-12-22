/**
 * Check all assets for the test story
 */

const admin = require('firebase-admin')
const serviceAccount = require('../moshimoshi-service-account.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

async function checkAssets() {
  const storyId = 'story_1766396144811_scheduler-system'

  console.log('🔍 Complete Asset Check')
  console.log('═'.repeat(80))
  console.log()

  const doc = await db.collection('stories').doc(storyId).get()

  if (!doc.exists) {
    console.log('❌ Story not found')
    process.exit(1)
  }

  const data = doc.data()

  console.log('Story:', data.titleJa || data.title)
  console.log('JLPT:', data.jlptLevel)
  console.log('Character:', data.characterSheet?.mainCharacter?.name, `(${data.characterSheet?.mainCharacter?.nameJa})`)
  console.log()

  console.log('═'.repeat(80))
  console.log('STORY-LEVEL ASSETS')
  console.log('═'.repeat(80))
  console.log()
  console.log('Cover Image:', data.coverImageUrl ? '✓' : '✗ MISSING')
  if (data.coverImageUrl) {
    console.log('  URL:', data.coverImageUrl)
  }
  console.log()
  console.log('Story Audio (full narration):', data.audioUrl ? '✓' : '✗ MISSING')
  if (data.audioUrl) {
    console.log('  URL:', data.audioUrl)
  }
  console.log()
  console.log('Model Sheet (character ref):', data.modelSheetUrl ? '✓' : '✗ MISSING')
  if (data.modelSheetUrl) {
    console.log('  URL:', data.modelSheetUrl)
  }
  console.log()

  console.log('═'.repeat(80))
  console.log('PAGE-LEVEL ASSETS')
  console.log('═'.repeat(80))
  console.log()

  const pages = data.pages || []
  console.log('Total Pages:', pages.length)
  console.log()

  let missingPageImages = 0
  let missingPageAudio = 0

  pages.forEach((page, i) => {
    const pageNum = page.pageNumber || i + 1
    console.log(`Page ${pageNum}:`)
    console.log(`  Text: ${page.text ? `✓ (${page.text.length} chars)` : '✗ MISSING'}`)
    console.log(`  Image: ${page.imageUrl ? '✓' : '✗ MISSING'}`)
    console.log(`  Audio: ${page.audioUrl ? '✓' : '✗ MISSING'}`)

    if (!page.imageUrl) missingPageImages++
    if (!page.audioUrl) missingPageAudio++

    console.log()
  })

  console.log('═'.repeat(80))
  console.log('SUMMARY')
  console.log('═'.repeat(80))
  console.log()

  const issues = []

  if (!data.coverImageUrl) issues.push('Missing cover image')
  if (!data.audioUrl) issues.push('Missing story audio')
  if (!data.modelSheetUrl) issues.push('Missing model sheet')
  if (missingPageImages > 0) issues.push(`${missingPageImages} page(s) missing images`)
  if (missingPageAudio > 0) issues.push(`${missingPageAudio} page(s) missing audio`)

  if (issues.length === 0) {
    console.log('✅ Story is COMPLETE - all assets present')
  } else {
    console.log(`❌ Story is INCOMPLETE - ${issues.length} issue(s):`)
    issues.forEach(issue => console.log(`   - ${issue}`))
  }
  console.log()

  console.log('View story:')
  console.log('  https://moshimoshi.app/en/story/interactive/' + storyId)

  process.exit(0)
}

checkAssets().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
