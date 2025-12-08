/**
 * Trigger the Content Integrity Checker manually
 * This calls the Firebase callable function directly
 */

const admin = require('firebase-admin')
const path = require('path')
const https = require('https')

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'moshimoshi-service-account.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
    projectId: 'moshimoshi-de237',
  })
}

const db = admin.firestore()

async function triggerIntegrityCheck() {
  console.log('=== Triggering Content Integrity Checker ===\n')
  console.log('Timestamp:', new Date().toISOString())
  console.log('')

  // The admin key for the integrity checker
  const adminKey = process.env.INTEGRITY_CHECKER_ADMIN_KEY || 'integrity-checker-2025'

  // Call the function via HTTPS
  const projectId = 'moshimoshi-de237'
  const functionName = 'manualIntegrityCheckerFunction'
  const region = 'us-central1'

  const url = `https://${region}-${projectId}.cloudfunctions.net/${functionName}`

  console.log('Calling:', url)
  console.log('')

  try {
    // Use fetch to call the callable function
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          adminKey: adminKey,
        },
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('Function returned error:', response.status)
      console.error(JSON.stringify(result, null, 2))

      // Check logs in Firestore
      console.log('\nChecking integrity_check_logs...')
      const logsSnapshot = await db
        .collection('integrity_check_logs')
        .orderBy('createdAt', 'desc')
        .limit(3)
        .get()

      if (!logsSnapshot.empty) {
        for (const doc of logsSnapshot.docs) {
          console.log('\nLog entry:', doc.id)
          console.log(JSON.stringify(doc.data(), null, 2))
        }
      }

      process.exit(1)
    }

    console.log('=== Integrity Check Result ===\n')
    console.log(JSON.stringify(result, null, 2))

    // Parse the result
    if (result.result) {
      const data = result.result

      console.log('\n=== Summary ===\n')

      if (data.newsArticles) {
        console.log('News Articles:')
        console.log(`  Checked: ${data.newsArticles.checked}`)
        console.log(`  Missing Audio: ${data.newsArticles.missingAudio?.length || 0}`)
        console.log(`  Missing Translations: ${data.newsArticles.missingTranslations?.length || 0}`)
        console.log(
          `  Missing Word Explanations: ${data.newsArticles.missingWordExplanations?.length || 0}`
        )
        console.log(`  Repaired Audio: ${data.newsArticles.repaired?.audio || 0}`)
        console.log(`  Repaired Translations: ${data.newsArticles.repaired?.translations || 0}`)
        console.log(
          `  Repaired Word Explanations: ${data.newsArticles.repaired?.wordExplanations || 0}`
        )
      }

      if (data.stories) {
        console.log('\nStories:')
        console.log(`  Checked: ${data.stories.checked}`)
        console.log(`  Missing Audio: ${data.stories.missingAudio?.length || 0}`)
        console.log(`  Missing Images: ${data.stories.missingImages?.length || 0}`)
        console.log(`  Stalled Drafts: ${data.stories.stalledDrafts?.length || 0}`)
        console.log(`  Repaired Audio: ${data.stories.repaired?.audio || 0}`)
      }

      console.log(`\nDuration: ${data.duration}ms`)
    }
  } catch (error) {
    console.error('Error calling function:', error.message)

    // Check logs in Firestore
    console.log('\nChecking integrity_check_logs for any results...')
    const logsSnapshot = await db
      .collection('integrity_check_logs')
      .orderBy('createdAt', 'desc')
      .limit(3)
      .get()

    if (!logsSnapshot.empty) {
      for (const doc of logsSnapshot.docs) {
        console.log('\nLog entry:', doc.id)
        const data = doc.data()
        console.log('Type:', data.type)
        console.log('Timestamp:', data.createdAt?.toDate()?.toISOString())
        if (data.newsArticles) {
          console.log('News checked:', data.newsArticles.checked)
          console.log('News repaired:', data.newsArticles.repaired)
        }
        if (data.stories) {
          console.log('Stories checked:', data.stories.checked)
          console.log('Stories repaired:', data.stories.repaired)
        }
        if (data.error) {
          console.log('Error:', data.error)
        }
      }
    }
  }

  process.exit(0)
}

triggerIntegrityCheck().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
