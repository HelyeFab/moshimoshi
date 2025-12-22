/**
 * Check for recent story drafts
 */

const admin = require('firebase-admin')
const serviceAccount = require('../moshimoshi-service-account.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

async function checkRecentDrafts() {
  console.log('🔍 Checking Recent Story Drafts')
  console.log('═'.repeat(80))
  console.log()

  try {
    // Get drafts from last 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)

    const snapshot = await db
      .collection('ai_story_drafts')
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(tenMinutesAgo))
      .orderBy('createdAt', 'desc')
      .get()

    if (snapshot.empty) {
      console.log('No recent drafts found (last 10 minutes)')
      console.log()

      // Try getting the most recent draft
      const latestSnapshot = await db
        .collection('ai_story_drafts')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get()

      if (!latestSnapshot.empty) {
        const latestDoc = latestSnapshot.docs[0]
        const data = latestDoc.data()
        const createdAt = data.createdAt?.toDate()
        const minutesAgo = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60))

        console.log(`Most recent draft was created ${minutesAgo} minutes ago:`)
        console.log('  Draft ID:', latestDoc.id)
        console.log('  Status:', data.status)
        console.log('  Theme:', data.theme)
        console.log('  JLPT:', data.jlptLevel)
      }
    } else {
      console.log(`Found ${snapshot.size} recent draft(s):`)
      console.log()

      snapshot.forEach(doc => {
        const data = doc.data()
        const createdAt = data.createdAt?.toDate()
        const secondsAgo = Math.floor((Date.now() - createdAt.getTime()) / 1000)

        console.log('Draft ID:', doc.id)
        console.log('  Created:', `${secondsAgo}s ago (${createdAt.toISOString()})`)
        console.log('  Status:', data.status)
        console.log('  Theme:', data.theme)
        console.log('  JLPT Level:', data.jlptLevel)
        console.log('  Source:', data.source || 'unknown')

        if (data.characterSheet) {
          console.log('  Main Character:', data.characterSheet.mainCharacter?.name || 'N/A')
          console.log('  Character Name (JP):', data.characterSheet.mainCharacter?.nameJa || 'N/A')
        }

        if (data.checkpoint) {
          console.log('  Last Step:', data.checkpoint.lastCompletedStep)
          if (data.checkpoint.lastCompletedIndex !== undefined) {
            console.log('  Last Index:', data.checkpoint.lastCompletedIndex)
          }
          console.log('  Failed Attempts:', data.checkpoint.failedAttempts)
        }

        console.log()
      })
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }

  process.exit(0)
}

checkRecentDrafts()
