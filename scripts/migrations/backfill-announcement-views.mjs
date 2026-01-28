#!/usr/bin/env node

/**
 * Backfill Announcement Views Migration
 *
 * Purpose: Creates view records for all historical dismissals
 *
 * Context: View tracking was added after dismissal tracking.
 * Old announcements have dismissals but no corresponding views.
 * This creates a 1:1 mapping: if someone dismissed, they must have viewed.
 *
 * Safety: Idempotent - safe to run multiple times
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Initialize Firebase Admin
let adminInitialized = false
let db = null

async function initializeFirebaseAdmin() {
  if (adminInitialized) return

  try {
    // Load environment variables from .env.local
    const dotenv = await import('dotenv')
    const path = await import('path')
    const __dirname = dirname(import.meta.url.replace('file://', ''))

    dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

    // Check if we have the required environment variables
    if (!process.env.FIREBASE_ADMIN_PROJECT_ID) {
      console.error('❌ Firebase Admin SDK not configured. Missing FIREBASE_ADMIN_PROJECT_ID')
      console.error('   Please ensure .env.local has:')
      console.error('   - FIREBASE_ADMIN_PROJECT_ID')
      console.error('   - FIREBASE_ADMIN_CLIENT_EMAIL')
      console.error('   - FIREBASE_ADMIN_PRIVATE_KEY')
      process.exit(1)
    }

    // Initialize with service account credentials from env vars
    if (process.env.FIREBASE_ADMIN_PRIVATE_KEY && process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
      const serviceAccount = {
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }

      console.log('✅ Initializing Firebase Admin with service account')
      console.log('   Project ID:', process.env.FIREBASE_ADMIN_PROJECT_ID)

      initializeApp({
        credential: cert(serviceAccount)
      })

      db = getFirestore()
      adminInitialized = true
      console.log('✅ Firebase Admin initialized successfully')
    } else {
      console.error('❌ Missing Firebase Admin credentials in environment variables')
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

/**
 * Backfill views from dismissals
 */
async function backfillViews() {
  console.log('\n🔄 Starting announcement views backfill...\n')

  try {
    await initializeFirebaseAdmin()

    // Fetch all dismissal records
    console.log('📊 Fetching dismissal records...')
    const dismissalsSnapshot = await db.collection('announcement_dismissals').get()

    if (dismissalsSnapshot.empty) {
      console.log('ℹ️  No dismissal records found. Nothing to backfill.')
      return
    }

    console.log(`✅ Found ${dismissalsSnapshot.size} dismissal records\n`)

    let created = 0
    let skipped = 0
    let errors = 0

    // Process each dismissal
    for (const dismissalDoc of dismissalsSnapshot.docs) {
      const dismissalData = dismissalDoc.data()
      const {
        visitorId,
        visitorType,
        visitorValue,
        announcementId,
        dismissedAt
      } = dismissalData

      // Construct view document ID (same pattern as dismissal)
      const viewId = `${visitorValue}_${announcementId}`

      try {
        // Check if view already exists
        const viewRef = db.collection('announcement_views').doc(viewId)
        const existingView = await viewRef.get()

        if (existingView.exists) {
          skipped++
          process.stdout.write(`⏭️  Skipped (exists): ${viewId}\r`)
          continue
        }

        // Create view record
        // Set viewedAt to be slightly before dismissedAt (or same time if not available)
        let viewedAt
        if (dismissedAt && dismissedAt.toMillis) {
          // Set viewed 1 second before dismissed (logical order)
          viewedAt = Timestamp.fromMillis(dismissedAt.toMillis() - 1000)
        } else {
          // Fallback to dismissedAt if it's already a Timestamp
          viewedAt = dismissedAt || Timestamp.now()
        }

        await viewRef.set({
          visitorId: viewId,
          visitorType: visitorType || 'user',
          visitorValue: visitorValue,
          announcementId: announcementId,
          viewedAt: viewedAt,
          // Add metadata to identify backfilled records
          _backfilled: true,
          _backfilledAt: Timestamp.now()
        })

        created++
        process.stdout.write(`✅ Created view: ${viewId} (${created}/${dismissalsSnapshot.size})\r`)

      } catch (error) {
        errors++
        console.error(`\n❌ Error processing ${viewId}:`, error.message)
      }
    }

    // Final summary
    console.log('\n')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📊 BACKFILL COMPLETE')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`✅ Created:  ${created} view records`)
    console.log(`⏭️  Skipped:  ${skipped} (already existed)`)
    console.log(`❌ Errors:   ${errors}`)
    console.log(`📋 Total:    ${dismissalsSnapshot.size} dismissals processed`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    if (created > 0) {
      console.log('🎉 Success! Historical announcement views have been backfilled.')
      console.log('   Analytics should now show correct view counts.\n')
    }

    if (errors > 0) {
      console.log('⚠️  Some errors occurred. Check logs above for details.\n')
      process.exit(1)
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    console.error(error.stack)
    process.exit(1)
  }
}

/**
 * Verify the backfill results
 */
async function verifyBackfill() {
  console.log('🔍 Verifying backfill results...\n')

  try {
    await initializeFirebaseAdmin()

    const [viewsSnapshot, dismissalsSnapshot] = await Promise.all([
      db.collection('announcement_views').get(),
      db.collection('announcement_dismissals').get()
    ])

    const viewsCount = viewsSnapshot.size
    const dismissalsCount = dismissalsSnapshot.size

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📊 VERIFICATION RESULTS')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`👁️  Total views:      ${viewsCount}`)
    console.log(`✅ Total dismissals: ${dismissalsCount}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    if (viewsCount >= dismissalsCount) {
      console.log('✅ Verification passed! Views ≥ Dismissals')
      console.log('   Every dismissal has a corresponding view.\n')
    } else {
      console.log('⚠️  Warning: Views < Dismissals')
      console.log(`   Missing ${dismissalsCount - viewsCount} view records`)
      console.log('   Consider running the migration again.\n')
    }

    // Check for announcements with mismatched counts
    console.log('🔍 Checking individual announcements...\n')

    const announcementsSnapshot = await db.collection('announcements').get()
    let mismatches = 0

    for (const announcementDoc of announcementsSnapshot.docs) {
      const announcementId = announcementDoc.id
      const announcementData = announcementDoc.data()

      const [views, dismissals] = await Promise.all([
        db.collection('announcement_views')
          .where('announcementId', '==', announcementId)
          .get(),
        db.collection('announcement_dismissals')
          .where('announcementId', '==', announcementId)
          .get()
      ])

      const viewsCount = views.size
      const dismissalsCount = dismissals.size

      if (dismissalsCount > viewsCount) {
        mismatches++
        console.log(`⚠️  ${announcementData.title || announcementId}`)
        console.log(`   Views: ${viewsCount}, Dismissals: ${dismissalsCount}`)
        console.log(`   Missing ${dismissalsCount - viewsCount} views\n`)
      }
    }

    if (mismatches === 0) {
      console.log('✅ All announcements have correct view counts!\n')
    } else {
      console.log(`⚠️  Found ${mismatches} announcements with missing views\n`)
    }

  } catch (error) {
    console.error('❌ Verification failed:', error)
    process.exit(1)
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  console.log('╔════════════════════════════════════════════════╗')
  console.log('║   Announcement Views Backfill Migration       ║')
  console.log('╚════════════════════════════════════════════════╝')

  if (command === '--verify' || command === '-v') {
    await verifyBackfill()
  } else if (command === '--help' || command === '-h') {
    console.log('\nUsage:')
    console.log('  node backfill-announcement-views.mjs           Run migration')
    console.log('  node backfill-announcement-views.mjs --verify  Verify results')
    console.log('  node backfill-announcement-views.mjs --help    Show help\n')
  } else {
    await backfillViews()
    console.log('\n💡 Tip: Run with --verify flag to check results\n')
  }

  process.exit(0)
}

// Run
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
