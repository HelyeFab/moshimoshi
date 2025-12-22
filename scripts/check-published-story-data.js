/**
 * Check the actual published story data
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
  const storyId = 'story_1766396144811_scheduler-system'

  console.log('📖 Checking Published Story Data')
  console.log('═'.repeat(80))
  console.log()
  console.log('Story ID:', storyId)
  console.log()

  const doc = await db.collection('stories').doc(storyId).get()

  if (!doc.exists) {
    console.log('❌ Story not found in stories collection')
    process.exit(1)
  }

  const data = doc.data()

  console.log('Full Story Data:')
  console.log(JSON.stringify(data, null, 2))

  process.exit(0)
}

checkStory().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
