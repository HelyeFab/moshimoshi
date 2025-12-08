/**
 * Test script for Content Integrity Checker
 * Triggers the manual integrity check function and displays results
 */

const admin = require('firebase-admin')
const path = require('path')

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'moshimoshi-service-account.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  })
}

const db = admin.firestore()

async function testIntegrityChecker() {
  console.log('=== Content Integrity Checker Test ===\n')

  // First, let's check what articles exist and their status
  console.log('1. Checking current article status...\n')

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const articlesSnapshot = await db
    .collection('news_articles')
    .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(sevenDaysAgo))
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get()

  console.log(`Found ${articlesSnapshot.size} articles in the last 7 days:\n`)

  const articleIds = []
  for (const doc of articlesSnapshot.docs) {
    const data = doc.data()
    articleIds.push(doc.id)
    console.log(`  - ${doc.id}`)
    console.log(`    Title: ${data.title?.substring(0, 50)}...`)
    console.log(
      `    Audio: ${data.generatedContentAudioUrl ? 'YES' : data.nhkAudioUrl ? 'NHK' : 'MISSING'}`
    )
    console.log(`    Audio Status: ${data.audioStatus || 'unknown'}`)
    console.log('')
  }

  // Check translations
  console.log('2. Checking translations...\n')

  if (articleIds.length > 0) {
    const translationsSnapshot = await db
      .collection('news_article_translations')
      .where(admin.firestore.FieldPath.documentId(), 'in', articleIds.slice(0, 10))
      .get()

    const translationIds = new Set(translationsSnapshot.docs.map(d => d.id))

    for (const id of articleIds) {
      console.log(
        `  - ${id}: ${translationIds.has(id) ? 'HAS translation' : 'MISSING translation'}`
      )
    }
    console.log('')
  }

  // Check word explanations
  console.log('3. Checking word explanations...\n')

  if (articleIds.length > 0) {
    const explanationsSnapshot = await db
      .collection('news_article_word_explanations')
      .where(admin.firestore.FieldPath.documentId(), 'in', articleIds.slice(0, 10))
      .get()

    const explanationIds = new Set(explanationsSnapshot.docs.map(d => d.id))

    for (const id of articleIds) {
      console.log(
        `  - ${id}: ${explanationIds.has(id) ? 'HAS word explanations' : 'MISSING word explanations'}`
      )
    }
    console.log('')
  }

  // Check stories
  console.log('4. Checking stories...\n')

  const storiesSnapshot = await db
    .collection('stories')
    .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(sevenDaysAgo))
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get()

  console.log(`Found ${storiesSnapshot.size} stories in the last 7 days:\n`)

  for (const doc of storiesSnapshot.docs) {
    const data = doc.data()
    const pages = data.pages || []
    const pagesWithImages = pages.filter(p => p.imageUrl).length
    const pagesWithAudio = pages.filter(p => p.audioUrl).length

    console.log(`  - ${doc.id}`)
    console.log(`    Title: ${data.title?.substring(0, 50)}...`)
    console.log(`    Full Audio: ${data.fullAudioUrl ? 'YES' : 'MISSING'}`)
    console.log(`    Audio Status: ${data.audioStatus || 'unknown'}`)
    console.log(`    Cover Image: ${data.coverImageUrl ? 'YES' : 'MISSING'}`)
    console.log(`    Page Images: ${pagesWithImages}/${pages.length}`)
    console.log(`    Page Audio: ${pagesWithAudio}/${pages.length}`)
    console.log('')
  }

  // Check recent integrity logs
  console.log('5. Checking recent integrity check logs...\n')

  const logsSnapshot = await db
    .collection('integrity_check_logs')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get()

  if (logsSnapshot.empty) {
    console.log('  No integrity check logs found yet.\n')
  } else {
    for (const doc of logsSnapshot.docs) {
      const data = doc.data()
      console.log(`  - ${doc.id}`)
      console.log(`    Type: ${data.type}`)
      console.log(`    Timestamp: ${data.timestamp || data.createdAt?.toDate()?.toISOString()}`)
      if (data.newsArticles) {
        console.log(
          `    News: ${data.newsArticles.checked} checked, ${data.newsArticles.repaired?.audio || 0} audio repaired`
        )
      }
      if (data.stories) {
        console.log(
          `    Stories: ${data.stories.checked} checked, ${data.stories.repaired?.audio || 0} audio repaired`
        )
      }
      console.log(`    Duration: ${data.duration}ms`)
      console.log('')
    }
  }

  console.log('=== Summary ===\n')
  console.log('To trigger the integrity checker manually, you can:')
  console.log('1. Call the Firebase function "manualIntegrityCheckerFunction" with adminKey')
  console.log('2. Wait for the scheduled run (every 6 hours)')
  console.log('3. Use the Firebase Console to test the function\n')

  process.exit(0)
}

testIntegrityChecker().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
