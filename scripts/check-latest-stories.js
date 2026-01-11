/**
 * Check the latest published stories
 */

const admin = require('firebase-admin')
const serviceAccount = require('../moshimoshi-service-account.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

async function checkLatestStories() {
  console.log('📖 Checking Latest Stories')
  console.log('═'.repeat(80))
  console.log()

  try {
    const snapshot = await db
      .collection('stories')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get()

    if (snapshot.empty) {
      console.log('❌ No stories found')
      process.exit(1)
    }

    console.log(`Found ${snapshot.size} recent stories:\n`)

    snapshot.forEach((doc, index) => {
      const data = doc.data()
      const createdAt = data.createdAt?.toDate() || data.createdAt
      const publishedAt = data.publishedAt?.toDate() || data.publishedAt

      console.log(`${index + 1}. ${doc.id}`)
      console.log(`   Title: ${data.title}`)
      console.log(`   Title (JA): ${data.titleJa || 'N/A'}`)
      console.log(`   JLPT Level: ${data.jlptLevel}`)
      console.log(`   Theme: ${data.theme || 'N/A'}`)
      console.log(`   Created: ${createdAt}`)
      console.log(`   Published: ${publishedAt || 'Not published'}`)
      console.log(`   Status: ${data.status}`)
      console.log(`   Pages: ${data.pages?.length || 0}`)
      console.log(`   Audio Status: ${data.audioStatus || 'N/A'}`)
      console.log(`   Moodboard ID: ${data.moodBoardId || 'N/A'}`)
      console.log()
    })

    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

checkLatestStories()
