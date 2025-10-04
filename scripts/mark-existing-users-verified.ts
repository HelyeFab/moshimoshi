#!/usr/bin/env tsx
/**
 * Migration Script: Mark Existing Users as Email Verified
 *
 * This script marks all existing users in Firebase as email verified,
 * implementing the "grandfather clause" for users who signed up before
 * email verification was implemented.
 *
 * Usage:
 *   npx tsx scripts/mark-existing-users-verified.ts
 *
 * Or with a dry-run to see what would be updated:
 *   npx tsx scripts/mark-existing-users-verified.ts --dry-run
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { resolve } from 'path'
import { readFileSync } from 'fs'

// Load service account directly
const serviceAccountPath = resolve(__dirname, '../moshimoshi-service-account.json')
console.log('📁 Loading service account from:', serviceAccountPath)

let serviceAccount
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
  console.log('✅ Service account loaded')
  console.log('   Project ID:', serviceAccount.project_id)
  console.log()
} catch (error: any) {
  console.error('❌ Failed to load service account:', error.message)
  process.exit(1)
}

// Initialize Firebase Admin with service account
if (getApps().length === 0) {
  console.log('🔧 Initializing Firebase Admin...')
  initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id,
  })
  console.log('✅ Firebase Admin initialized')
  console.log()
}

const adminAuth = getAuth()
const adminFirestore = getFirestore()

const DRY_RUN = process.argv.includes('--dry-run')

async function markExistingUsersVerified() {
  console.log('🔧 Email Verification Migration Script')
  console.log('=' .repeat(50))
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE (will update users)'}`)
  console.log('=' .repeat(50))
  console.log()

  try {
    // Get all users from Firestore
    const usersSnapshot = await adminFirestore.collection('users').get()
    console.log(`📊 Found ${usersSnapshot.size} users in Firestore\n`)

    if (usersSnapshot.empty) {
      console.log('⚠️  No users found to migrate')
      return
    }

    let updated = 0
    let skipped = 0
    let failed = 0
    const errors: Array<{ email: string; error: string }> = []

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data()
      const userId = doc.id
      const email = userData.email || 'unknown'

      try {
        // Skip if already verified
        if (userData.emailVerified === true) {
          console.log(`⏭️  Skipping ${email} (already verified)`)
          skipped++
          continue
        }

        if (DRY_RUN) {
          console.log(`🔍 Would update: ${email}`)
          updated++
          continue
        }

        // Update Firebase Auth
        await adminAuth.updateUser(userId, { emailVerified: true })

        // Update Firestore
        await adminFirestore.collection('users').doc(userId).update({
          emailVerified: true,
          emailVerifiedAt: new Date(),
          updatedAt: new Date(),
        })

        console.log(`✅ Updated: ${email}`)
        updated++

      } catch (error: any) {
        console.error(`❌ Failed: ${email} - ${error.message}`)
        errors.push({ email, error: error.message })
        failed++
      }
    }

    // Summary
    console.log()
    console.log('=' .repeat(50))
    console.log('📊 Migration Summary')
    console.log('=' .repeat(50))
    console.log(`✅ Updated: ${updated}`)
    console.log(`⏭️  Skipped (already verified): ${skipped}`)
    console.log(`❌ Failed: ${failed}`)
    console.log()

    if (errors.length > 0) {
      console.log('⚠️  Errors encountered:')
      errors.forEach(({ email, error }) => {
        console.log(`   - ${email}: ${error}`)
      })
      console.log()
    }

    if (DRY_RUN) {
      console.log('🔍 This was a dry run. No changes were made.')
      console.log('   Run without --dry-run to apply changes.')
    } else {
      console.log('✅ Migration complete!')
    }

  } catch (error: any) {
    console.error('💥 Migration failed:', error.message)
    console.error(error)
    process.exit(1)
  }
}

// Run the migration
markExistingUsersVerified()
  .then(() => {
    console.log('\n👋 Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error)
    process.exit(1)
  })
