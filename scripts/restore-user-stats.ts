#!/usr/bin/env tsx
/**
 * User Stats Restoration Script
 *
 * Restores user_stats documents from backup files in firebase-user-data/
 *
 * Usage:
 *   npx tsx scripts/restore-user-stats.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { resolve } from 'path'
import { readFileSync, readdirSync } from 'fs'

// Load service account
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

// Initialize Firebase Admin
if (getApps().length === 0) {
  console.log('🔧 Initializing Firebase Admin...')
  initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id,
  })
  console.log('✅ Firebase Admin initialized')
  console.log()
}

const db = getFirestore()

/**
 * Convert backup timestamp objects to Firestore Timestamps
 */
function convertTimestamps(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj

  // Check if this is a timestamp object with _seconds
  if (obj._seconds !== undefined) {
    return Timestamp.fromMillis(obj._seconds * 1000 + (obj._nanoseconds || 0) / 1000000)
  }

  // Recursively convert nested objects
  if (Array.isArray(obj)) {
    return obj.map(convertTimestamps)
  }

  const converted: any = {}
  for (const [key, value] of Object.entries(obj)) {
    converted[key] = convertTimestamps(value)
  }
  return converted
}

/**
 * Restore user_stats for a single user
 */
async function restoreUserStats(userId: string, backupData: any): Promise<void> {
  try {
    // Convert timestamps
    const data = convertTimestamps(backupData)

    // Update lastUpdated to now
    data.metadata = data.metadata || {}
    data.metadata.lastUpdated = Timestamp.now()
    data.metadata.restoredAt = Timestamp.now()
    data.metadata.restoredFrom = 'firebase-user-data backup'

    // Write to Firestore
    await db.collection('user_stats').doc(userId).set(data, { merge: false })

    console.log(`✅ Restored user_stats for ${data.email || userId}`)
    console.log(`   User: ${data.displayName || 'Unknown'}`)
    console.log(`   XP: ${data.xp?.total || 0}`)
    console.log(`   Streak: ${data.streak?.current || 0}`)
    console.log(`   Achievements: ${data.achievements?.unlockedCount || 0}`)
    console.log()
  } catch (error: any) {
    console.error(`❌ Failed to restore ${userId}:`, error.message)
    throw error
  }
}

/**
 * Main restoration function
 */
async function restoreAllUserStats() {
  console.log('🔄 User Stats Restoration')
  console.log('=' .repeat(60))
  console.log()

  const backupDir = resolve(__dirname, '../firebase-user-data')
  console.log('📂 Backup directory:', backupDir)
  console.log()

  try {
    // Get all user directories
    const userDirs = readdirSync(backupDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)

    console.log(`Found ${userDirs.length} user backup(s)`)
    console.log()

    let restored = 0
    let failed = 0

    for (const userId of userDirs) {
      const userStatsFile = resolve(backupDir, userId, 'user_stats.json')

      try {
        // Check if user_stats backup exists
        const backupData = JSON.parse(readFileSync(userStatsFile, 'utf8'))

        // Restore to Firebase
        await restoreUserStats(userId, backupData)
        restored++
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          console.log(`⏭️  Skipping ${userId} (no user_stats.json)`)
        } else {
          console.error(`❌ Error restoring ${userId}:`, error.message)
          failed++
        }
      }
    }

    // Summary
    console.log()
    console.log('=' .repeat(60))
    console.log('📊 Restoration Summary')
    console.log('=' .repeat(60))
    console.log(`✅ Restored: ${restored}`)
    console.log(`❌ Failed: ${failed}`)
    console.log()

    if (restored > 0) {
      console.log('✅ User stats restoration complete!')
    } else {
      console.log('⚠️  No user stats were restored')
    }

  } catch (error: any) {
    console.error('💥 Restoration failed:', error.message)
    console.error(error)
    process.exit(1)
  }
}

// Run restoration
restoreAllUserStats()
  .then(() => {
    console.log('👋 Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error)
    process.exit(1)
  })
