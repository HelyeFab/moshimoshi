/**
 * Repair Script: Clean up duplicate streak fields in user_stats
 *
 * Problem: Some user_stats documents have duplicate streak fields:
 * - streak.current (CORRECT)
 * - streak.currentStreak (DUPLICATE - should be removed)
 * - streak.dates (nested twice)
 *
 * This script removes the duplicate fields and keeps only the correct structure.
 */

import * as admin from 'firebase-admin'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Initialize Firebase Admin
const serviceAccountPath = resolve(__dirname, '../moshimoshi-service-account.json')
console.log(`📁 Loading service account from: ${serviceAccountPath}`)

try {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
    })
  }
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin:', error)
  console.error('Make sure moshimoshi-service-account.json exists in the project root')
  process.exit(1)
}

const db = admin.firestore()

interface StreakData {
  current: number
  best: number
  dates: Record<string, boolean>
  lastActivityDate: string
  lastActivityTimestamp?: number
  isActiveToday?: boolean
  streakAtRisk?: boolean
  hoursRemainingToday?: number
  lastActivity?: number
}

async function repairStreakData(userId: string, dryRun = false): Promise<boolean> {
  try {
    console.log(`\n🔧 Repairing streak data for user: ${userId}`)

    const userStatsRef = db.collection('user_stats').doc(userId)
    const doc = await userStatsRef.get()

    if (!doc.exists) {
      console.log(`❌ No user_stats document found for ${userId}`)
      return false
    }

    const data = doc.data()!
    const streakData = data.streak as any

    if (!streakData) {
      console.log(`⚠️  No streak data found for ${userId}`)
      return false
    }

    console.log('📊 Current streak data:', JSON.stringify(streakData, null, 2))

    // Check for corrupt dates object
    const datesObj = streakData.dates || {}
    const hasCorruptDates =
      'currentStreak' in datesObj ||
      'bestStreak' in datesObj ||
      'lastActivityDate' in datesObj ||
      'dates' in datesObj ||
      'lastActivity' in datesObj ||
      'isActiveToday' in datesObj

    // Check for duplicate fields at root level
    const hasDuplicates =
      'currentStreak' in streakData ||
      'bestStreak' in streakData

    if (!hasDuplicates && !hasCorruptDates) {
      console.log(`✅ Streak data is already clean for ${userId}`)
      return true
    }

    console.log(`🔍 Found corruption:`)
    if (hasDuplicates) console.log('   - Duplicate fields at root level')
    if (hasCorruptDates) console.log('   - Corrupt dates object with metadata fields')

    // Clean the dates object - keep only date strings (YYYY-MM-DD format)
    const cleanDates: Record<string, boolean> = {}
    if (datesObj) {
      for (const key in datesObj) {
        // Only keep keys that match date format (YYYY-MM-DD)
        if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
          cleanDates[key] = true
        }
      }
    }

    // Build clean streak object
    const cleanStreak: StreakData = {
      current: streakData.current || streakData.currentStreak || 0,
      best: streakData.best || streakData.bestStreak || 0,
      dates: cleanDates,
      lastActivityDate: streakData.lastActivityDate || datesObj.lastActivityDate || '',
      lastActivityTimestamp: streakData.lastActivityTimestamp || datesObj.lastActivity || Date.now(),
      isActiveToday: streakData.isActiveToday !== undefined ? streakData.isActiveToday : (datesObj.isActiveToday || false),
      streakAtRisk: streakData.streakAtRisk || false,
      hoursRemainingToday: streakData.hoursRemainingToday || 24
    }

    console.log('🧹 Clean streak data:', JSON.stringify(cleanStreak, null, 2))

    if (dryRun) {
      console.log('🔍 DRY RUN - No changes made')
      return true
    }

    // Update with clean data
    await userStatsRef.update({
      'streak': cleanStreak
    })

    console.log(`✅ Successfully repaired streak data for ${userId}`)
    return true

  } catch (error) {
    console.error(`❌ Error repairing streak data for ${userId}:`, error)
    return false
  }
}

async function repairAllUsers(dryRun = false) {
  try {
    console.log('🚀 Starting streak data repair...')
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)

    const snapshot = await db.collection('user_stats').get()
    console.log(`Found ${snapshot.size} users`)

    let repaired = 0
    let failed = 0
    let skipped = 0

    for (const doc of snapshot.docs) {
      const success = await repairStreakData(doc.id, dryRun)
      if (success) {
        const data = doc.data()
        const hasIssue = data.streak && ('currentStreak' in data.streak || 'bestStreak' in data.streak)
        if (hasIssue) {
          repaired++
        } else {
          skipped++
        }
      } else {
        failed++
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('📊 SUMMARY')
    console.log('='.repeat(50))
    console.log(`Total users: ${snapshot.size}`)
    console.log(`Repaired: ${repaired}`)
    console.log(`Skipped (clean): ${skipped}`)
    console.log(`Failed: ${failed}`)
    console.log('='.repeat(50))

  } catch (error) {
    console.error('❌ Error during bulk repair:', error)
  } finally {
    await admin.app().delete()
  }
}

// Command line arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const userId = args.find(arg => !arg.startsWith('--'))

if (userId) {
  // Repair single user
  repairStreakData(userId, dryRun).then(() => {
    admin.app().delete()
  })
} else {
  // Repair all users
  repairAllUsers(dryRun)
}
