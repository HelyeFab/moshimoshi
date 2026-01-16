#!/usr/bin/env tsx

/**
 * Check user_stats Collection
 * Checks the user_stats top-level collection for gamification data
 *
 * Usage: tsx scripts/check-user-stats.ts [email]
 */

import * as admin from 'firebase-admin'
import * as path from 'path'

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../moshimoshi-service-account.json')
const emailToSearch = process.argv[2] || 'emmanuelfabiani23@gmail.com'

console.log('📊 User Stats Check')
console.log('━'.repeat(50))
console.log(`📧 User: ${emailToSearch}`)
console.log('━'.repeat(50))
console.log('')

async function checkUserStats() {
  try {
    const serviceAccount = require(SERVICE_ACCOUNT_PATH)

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    })

    const auth = admin.auth()
    const firestore = admin.firestore()

    // Get user UID
    const userRecord = await auth.getUserByEmail(emailToSearch)
    const uid = userRecord.uid

    console.log(`✅ User: ${userRecord.displayName || 'N/A'}`)
    console.log(`   UID: ${uid}`)
    console.log('')

    // Check user_stats collection
    console.log('📊 USER_STATS COLLECTION')
    console.log('━'.repeat(50))

    const userStatsDoc = await firestore.collection('user_stats').doc(uid).get()

    if (!userStatsDoc.exists) {
      console.log(`❌ No user_stats document found for UID: ${uid}`)
    } else {
      const data = userStatsDoc.data()!
      console.log('✅ Found user_stats document!')
      console.log('')
      console.log(JSON.stringify(data, null, 2))
    }

    console.log('')
    console.log('✅ Check complete!')

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    await admin.app().delete()
    process.exit(0)
  }
}

checkUserStats()
