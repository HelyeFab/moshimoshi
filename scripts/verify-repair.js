/**
 * Verify the integrity check repairs
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

async function verifyRepair() {
  console.log('=== Verifying Repairs ===\n')

  // Check the article that was repaired
  const articleId = '607d81de0139a081ebe1d06ceec92cbd'
  console.log('1. Checking repaired article:', articleId)

  const articleDoc = await db.collection('news_articles').doc(articleId).get()
  if (articleDoc.exists) {
    const data = articleDoc.data()
    console.log('   Title:', data.title?.substring(0, 50) + '...')
    console.log('   Audio Status:', data.audioStatus)
    console.log('   Generated Title Audio:', data.generatedTitleAudioUrl ? 'YES' : 'NO')
    console.log('   Generated Summary Audio:', data.generatedSummaryAudioUrl ? 'YES' : 'NO')
    console.log('   Generated Content Audio:', data.generatedContentAudioUrl ? 'YES' : 'NO')
    console.log('   NHK Audio:', data.nhkAudioUrl ? 'YES' : 'NO')
    console.log('   Audio Generated At:', data.audioGeneratedAt?.toDate()?.toISOString())
  }

  // Check the story that wasn't repaired
  const storyId = 'story_1765105695292_8onZzlQg3tQxkw8pinSF9ow4Q6j2'
  console.log('\n2. Checking story that needs repair:', storyId)

  const storyDoc = await db.collection('stories').doc(storyId).get()
  if (storyDoc.exists) {
    const data = storyDoc.data()
    console.log('   Title:', data.title?.substring(0, 50) + '...')
    console.log('   Audio Status:', data.audioStatus)
    console.log('   Full Audio URL:', data.fullAudioUrl ? 'YES' : 'NO')
    const pages = data.pages || []
    console.log('   Pages with Audio:', pages.filter(p => p.audioUrl).length + '/' + pages.length)
  }

  // Check integrity logs
  console.log('\n3. Recent integrity check logs:')

  const logsSnapshot = await db
    .collection('integrity_check_logs')
    .orderBy('createdAt', 'desc')
    .limit(3)
    .get()

  for (const doc of logsSnapshot.docs) {
    const data = doc.data()
    console.log('\n   Log:', doc.id)
    console.log('   Type:', data.type)
    console.log('   Time:', data.createdAt?.toDate()?.toISOString())
    console.log('   Duration:', data.duration + 'ms')
    if (data.newsArticles) {
      console.log('   News - Checked:', data.newsArticles.checked)
      console.log('   News - Repaired Audio:', data.newsArticles.repaired?.audio)
      console.log('   News - Failed Audio:', data.newsArticles.failedAudio?.length)
    }
    if (data.stories) {
      console.log('   Stories - Checked:', data.stories.checked)
      console.log('   Stories - Missing Audio:', data.stories.missingAudio?.length)
      console.log('   Stories - Repaired Audio:', data.stories.repaired?.audio)
    }
  }

  // Check Cloud Functions logs (via recent scraping logs as proxy)
  console.log('\n4. Function executed successfully - checking if audio was actually generated...')

  // Re-check the article after repair
  const articleDocAfter = await db.collection('news_articles').doc(articleId).get()
  if (articleDocAfter.exists) {
    const data = articleDocAfter.data()
    const audioGeneratedAt = data.audioGeneratedAt?.toDate()
    const now = new Date()
    const minutesAgo = audioGeneratedAt ? Math.round((now - audioGeneratedAt) / 60000) : null

    console.log('   Article audio was generated', minutesAgo, 'minutes ago')

    if (minutesAgo !== null && minutesAgo < 5) {
      console.log('\n   ✅ AUDIO WAS JUST REGENERATED! Repair successful.')
    } else {
      console.log('\n   ⚠️ Audio generation time is older - may have been pre-existing.')
    }
  }

  process.exit(0)
}

verifyRepair().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
