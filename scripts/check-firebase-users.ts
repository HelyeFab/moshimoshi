#!/usr/bin/env tsx

/**
 * Firebase User Check Script
 * Counts users with a specific email in Firebase Auth and Firestore
 *
 * Usage: tsx scripts/check-firebase-users.ts [email]
 * Example: tsx scripts/check-firebase-users.ts emmanuelfabiani23@gmail.com
 */

import * as admin from 'firebase-admin'
import * as path from 'path'

// Service account path
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../moshimoshi-service-account.json')

// Get email from command line or use default
const emailToSearch = process.argv[2] || 'emmanuelfabiani23@gmail.com'

console.log('🔍 Firebase User Check Script')
console.log('━'.repeat(50))
console.log(`📧 Searching for: ${emailToSearch}`)
console.log(`🔑 Service Account: ${SERVICE_ACCOUNT_PATH}`)
console.log('━'.repeat(50))
console.log('')

async function checkFirebaseUsers() {
  try {
    // Initialize Firebase Admin
    console.log('⚙️  Initializing Firebase Admin...')
    const serviceAccount = require(SERVICE_ACCOUNT_PATH)

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    })

    const auth = admin.auth()
    const firestore = admin.firestore()

    console.log('✅ Firebase Admin initialized')
    console.log(`📦 Project ID: ${serviceAccount.project_id}`)
    console.log('')

    // Check Firebase Authentication
    console.log('1️⃣  Checking Firebase Authentication...')
    console.log('━'.repeat(50))

    let authUsers: admin.auth.UserRecord[] = []

    try {
      // Try to get user by email directly
      const userRecord = await auth.getUserByEmail(emailToSearch)
      authUsers.push(userRecord)

      console.log(`✅ Found user in Auth:`)
      console.log(`   UID: ${userRecord.uid}`)
      console.log(`   Email: ${userRecord.email}`)
      console.log(`   Email Verified: ${userRecord.emailVerified}`)
      console.log(`   Display Name: ${userRecord.displayName || 'N/A'}`)
      console.log(`   Created: ${userRecord.metadata.creationTime}`)
      console.log(`   Last Sign In: ${userRecord.metadata.lastSignInTime || 'Never'}`)
      console.log(`   Provider: ${userRecord.providerData.map(p => p.providerId).join(', ')}`)
      console.log(`   Disabled: ${userRecord.disabled}`)

      // Check custom claims
      if (userRecord.customClaims) {
        console.log(`   Custom Claims:`, userRecord.customClaims)
      }
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        console.log(`❌ No user found in Auth with email: ${emailToSearch}`)
      } else {
        console.error(`⚠️  Error querying Auth:`, error.message)
      }
    }

    console.log('')

    // Check Firestore
    console.log('2️⃣  Checking Firestore Database...')
    console.log('━'.repeat(50))

    const usersSnapshot = await firestore
      .collection('users')
      .where('email', '==', emailToSearch)
      .get()

    if (usersSnapshot.empty) {
      console.log(`❌ No users found in Firestore with email: ${emailToSearch}`)
    } else {
      console.log(`✅ Found ${usersSnapshot.size} user(s) in Firestore:`)
      console.log('')

      usersSnapshot.forEach((doc, index) => {
        const data = doc.data()
        console.log(`   User ${index + 1}:`)
        console.log(`   UID: ${doc.id}`)
        console.log(`   Email: ${data.email || 'N/A'}`)
        console.log(`   Display Name: ${data.displayName || 'N/A'}`)
        console.log(`   Email Verified: ${data.emailVerified || false}`)
        console.log(`   Auth Provider: ${data.authProvider || 'N/A'}`)
        console.log(`   Admin: ${data.isAdmin === true ? 'Yes' : 'No'}`)
        console.log(`   Created: ${data.createdAt?.toDate?.() || 'N/A'}`)
        console.log(`   Last Login: ${data.lastLoginAt?.toDate?.() || data.lastLoginAt || 'N/A'}`)

        // Subscription info
        if (data.subscription) {
          console.log(`   Subscription:`)
          console.log(`     - Status: ${data.subscription.status || 'N/A'}`)
          console.log(`     - Tier: ${data.subscription.tier || 'N/A'}`)
          console.log(`     - Current Period End: ${data.subscription.currentPeriodEnd?.toDate?.() || 'N/A'}`)
        } else {
          console.log(`   Subscription: None`)
        }

        console.log('')
      })
    }

    // Summary
    console.log('')
    console.log('📊 Summary')
    console.log('━'.repeat(50))
    console.log(`Firebase Auth: ${authUsers.length} user(s)`)
    console.log(`Firestore: ${usersSnapshot.size} user(s)`)
    console.log('')

    // Data consistency check
    if (authUsers.length > 0 && usersSnapshot.size > 0) {
      const authUID = authUsers[0].uid
      const firestoreUIDs = usersSnapshot.docs.map(doc => doc.id)

      if (firestoreUIDs.includes(authUID)) {
        console.log('✅ Data Consistency: Auth and Firestore UIDs match')
      } else {
        console.log('⚠️  Data Consistency: Auth UID not found in Firestore!')
        console.log(`   Auth UID: ${authUID}`)
        console.log(`   Firestore UIDs: ${firestoreUIDs.join(', ')}`)
      }
    } else if (authUsers.length > 0 && usersSnapshot.size === 0) {
      console.log('⚠️  Warning: User exists in Auth but not in Firestore')
    } else if (authUsers.length === 0 && usersSnapshot.size > 0) {
      console.log('⚠️  Warning: User exists in Firestore but not in Auth')
    }

    console.log('')
    console.log('✅ Check complete!')

  } catch (error: any) {
    console.error('')
    console.error('❌ Error:', error.message)
    console.error('')
    console.error('Stack trace:')
    console.error(error.stack)
    process.exit(1)
  } finally {
    // Cleanup
    await admin.app().delete()
    process.exit(0)
  }
}

// Run the script
checkFirebaseUsers()
