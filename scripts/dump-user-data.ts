#!/usr/bin/env tsx

/**
 * Firebase User Data Dump Script
 * Shows complete user document structure
 *
 * Usage: tsx scripts/dump-user-data.ts [email]
 */

import * as admin from 'firebase-admin'
import * as path from 'path'

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../moshimoshi-service-account.json')
const emailToSearch = process.argv[2] || 'emmanuelfabiani23@gmail.com'

console.log('📦 User Data Dump')
console.log('━'.repeat(50))
console.log(`📧 User: ${emailToSearch}`)
console.log('━'.repeat(50))
console.log('')

async function dumpUserData() {
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

    // Get user document
    const userDoc = await firestore.collection('users').doc(uid).get()

    if (!userDoc.exists) {
      console.error(`❌ User document not found`)
      process.exit(1)
    }

    const userData = userDoc.data()!

    console.log('📄 COMPLETE USER DOCUMENT')
    console.log('━'.repeat(50))
    console.log(JSON.stringify(userData, null, 2))
    console.log('')

    // List all subcollections
    console.log('📁 SUBCOLLECTIONS')
    console.log('━'.repeat(50))

    const collections = await firestore.collection('users').doc(uid).listCollections()

    if (collections.length > 0) {
      for (const collection of collections) {
        const snapshot = await collection.limit(5).get()
        console.log(`📂 ${collection.id}: ${snapshot.size} documents`)

        if (snapshot.size > 0 && snapshot.size <= 5) {
          snapshot.docs.forEach(doc => {
            console.log(`   - ${doc.id}`)
          })
        } else if (snapshot.size > 5) {
          console.log(`   - (showing first 5 of ${snapshot.size})`)
          snapshot.docs.slice(0, 5).forEach(doc => {
            console.log(`   - ${doc.id}`)
          })
        }
      }
    } else {
      console.log('⚠️  No subcollections found')
    }

    console.log('')
    console.log('✅ Dump complete!')

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    await admin.app().delete()
    process.exit(0)
  }
}

dumpUserData()
