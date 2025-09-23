#!/usr/bin/env node

/**
 * Script to fix UUID duplication in progress documents
 * This fixes the issue where userId is incorrectly used as contentType and script values
 */

const admin = require('firebase-admin')

// Try multiple possible locations for the service account key
let serviceAccount
try {
  serviceAccount = require('../moshimoshi-service-account.json')
} catch (e1) {
  try {
    serviceAccount = require('../config/firebase-admin-key.json')
  } catch (e2) {
    console.error('❌ Could not find service account key file')
    console.error('Please ensure you have one of these files:')
    console.error('  - moshimoshi-service-account.json')
    console.error('  - config/firebase-admin-key.json')
    process.exit(1)
  }
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  })
}

const db = admin.firestore()

async function findAndFixUUIDDuplication() {
  console.log('\n=== Finding and Fixing UUID Duplication in Progress Documents ===\n')

  try {
    // Get all users
    const usersSnapshot = await db.collection('users').get()
    console.log(`Found ${usersSnapshot.size} users to check\n`)

    let fixedCount = 0
    let errorCount = 0

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id

      // Check the progress subcollection
      const progressSnapshot = await db
        .collection('users')
        .doc(userId)
        .collection('progress')
        .get()

      for (const progressDoc of progressSnapshot.docs) {
        const docId = progressDoc.id
        const data = progressDoc.data()

        // Check if this document has the UUID duplication issue
        // The issue is when contentType or script equals the userId
        if (data.contentType === userId || data.script === userId) {
          console.log(`\n⚠️  Found problematic document: users/${userId}/progress/${docId}`)
          console.log('Current data:')
          console.log(`  - contentType: ${data.contentType} ${data.contentType === userId ? '❌ (equals userId)' : ''}`)
          console.log(`  - script: ${data.script} ${data.script === userId ? '❌ (equals userId)' : ''}`)
          console.log(`  - contentId: ${data.contentId}`)
          console.log(`  - userId: ${data.userId}`)

          // Determine the correct values based on contentId
          let correctContentType = data.contentType
          let correctScript = data.script

          // If contentId is 'hiragana' or 'katakana', use that for script
          if (data.contentId === 'hiragana' || data.contentId === 'katakana') {
            correctScript = data.contentId
            correctContentType = 'kana'
          }
          // If the document ID is 'hiragana' or 'katakana', use that
          else if (docId === 'hiragana' || docId === 'katakana') {
            correctScript = docId
            correctContentType = 'kana'
          }
          // Default fallback
          else if (data.contentType === userId) {
            correctContentType = 'kana' // Default assumption
          }

          if (data.script === userId) {
            // Try to infer from contentId or docId
            if (data.contentId === 'hiragana' || docId.includes('hiragana')) {
              correctScript = 'hiragana'
            } else if (data.contentId === 'katakana' || docId.includes('katakana')) {
              correctScript = 'katakana'
            } else {
              correctScript = 'hiragana' // Default to hiragana if we can't determine
            }
          }

          console.log('\nCorrected values:')
          console.log(`  - contentType: ${correctContentType} ✅`)
          console.log(`  - script: ${correctScript} ✅`)

          // Update the document with correct values
          try {
            await progressDoc.ref.update({
              contentType: correctContentType,
              script: correctScript,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            })
            console.log('✅ Document fixed successfully!')
            fixedCount++
          } catch (updateError) {
            console.error(`❌ Failed to update document: ${updateError.message}`)
            errorCount++
          }
        }
      }
    }

    console.log('\n===========================================')
    console.log('SUMMARY')
    console.log('===========================================')
    console.log(`✅ Fixed documents: ${fixedCount}`)
    console.log(`❌ Failed updates: ${errorCount}`)
    console.log(`📊 Total users checked: ${usersSnapshot.size}`)

    if (fixedCount === 0 && errorCount === 0) {
      console.log('\n✨ No problematic documents found! Your data looks clean.')
    }

  } catch (error) {
    console.error('\n❌ Error:', error)
  }
}

// Also check for any rogue documents at the root progress collection
async function checkRootProgressCollection() {
  console.log('\n=== Checking Root Progress Collection ===\n')

  try {
    const progressSnapshot = await db.collection('progress').limit(10).get()

    if (!progressSnapshot.empty) {
      console.log(`⚠️  Found ${progressSnapshot.size} documents in root 'progress' collection`)
      console.log('These might need to be moved to user subcollections')

      progressSnapshot.forEach(doc => {
        const data = doc.data()
        console.log(`\n  Document ID: ${doc.id}`)
        console.log(`  User ID: ${data.userId}`)
        console.log(`  Content Type: ${data.contentType}`)
      })
    } else {
      console.log('✅ No documents in root progress collection')
    }
  } catch (error) {
    console.log('ℹ️  No root progress collection exists (this is good)')
  }
}

console.log('===========================================')
console.log('FIX UUID DUPLICATION IN PROGRESS DOCUMENTS')
console.log('===========================================')
console.log('\nThis script will:')
console.log('1. Find progress documents where contentType or script equals userId')
console.log('2. Fix these fields with appropriate values')
console.log('3. Report on all changes made')
console.log('\n⚠️  This will modify your Firebase data!')
console.log('Press Enter to continue or Ctrl+C to cancel...')

// Wait for user confirmation
process.stdin.once('data', async () => {
  await findAndFixUUIDDuplication()
  await checkRootProgressCollection()

  console.log('\n✅ Script completed!')
  process.exit(0)
})