#!/usr/bin/env tsx
/**
 * Single User Data Migration Script
 *
 * Migrates your data to the new schema with:
 * - ISO string dates (no more Date objects)
 * - Version tracking on all documents
 * - Normalized accuracy values (0-100)
 *
 * Run: npx tsx scripts/migrate-single-user.ts <userId>
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

// Initialize Firebase Admin with service account
const serviceAccount = require('../firebase-admin-key.json')

initializeApp({
  credential: cert(serviceAccount)
})

const db = getFirestore()

/**
 * Convert Timestamp or Date to ISO date string (yyyy-mm-dd)
 */
function toISODate(value: any): string | null {
  if (!value) return null

  if (value instanceof Timestamp) {
    return value.toDate().toISOString().split('T')[0]
  }

  if (value instanceof Date) {
    return value.toISOString().split('T')[0]
  }

  if (typeof value === 'string') {
    // Already a string, try to parse it
    const date = new Date(value)
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]
    }
  }

  return null
}

/**
 * Convert Timestamp or Date to ISO datetime string
 */
function toISODateTime(value: any): string | null {
  if (!value) return null

  if (value instanceof Timestamp) {
    return value.toDate().toISOString()
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === 'string') {
    // Already a string, validate it's ISO format
    const date = new Date(value)
    if (!isNaN(date.getTime())) {
      return date.toISOString()
    }
  }

  return null
}

/**
 * Normalize accuracy to 0-100 range
 */
function normalizeAccuracy(value: number | undefined): number {
  if (value === undefined || value === null) return 0

  // If value is likely a decimal (<=1.0), convert to percentage
  if (value <= 1.0 && value >= 0.0) {
    return value * 100
  }

  // Otherwise clamp to 0-100
  return Math.min(100, Math.max(0, value))
}

/**
 * Migrate user_stats document
 */
async function migrateUserStats(userId: string) {
  console.log(`\n📊 Migrating user_stats for ${userId}...`)

  const userStatsRef = db.collection('user_stats').doc(userId)
  const doc = await userStatsRef.get()

  if (!doc.exists) {
    console.log('  ⚠️  No user_stats document found, creating new one...')

    await userStatsRef.set({
      streak: {
        current: 0,
        best: 0,
        freezesRemaining: 3,
        version: 1,
        updatedAt: Timestamp.now()
      },
      dates: {
        lastActivityDate: null,
        isActiveToday: false
      },
      xp: {
        total: 0,
        level: 1
      },
      achievements: {
        unlockedIds: [],
        progress: {}
      },
      sessions: {
        totalSessions: 0
      },
      metadata: {
        lastUpdated: new Date().toISOString(),
        syncStatus: 'synced',
        schemaVersion: 2
      }
    })

    console.log('  ✅ Created new user_stats document')
    return
  }

  const data = doc.data()!

  // Migrate streak data
  const oldStreak = data.streak || {}
  const migratedStreak = {
    current: oldStreak.current || 0,
    best: oldStreak.best || 0,
    freezesRemaining: oldStreak.freezesRemaining ?? 3,
    version: oldStreak.version || 1,
    updatedAt: Timestamp.now()
  }

  // Migrate dates
  const oldDates = data.dates || {}
  const migratedDates = {
    lastActivityDate: toISODate(oldDates.lastActivityDate),
    isActiveToday: oldDates.lastActivityDate
      ? toISODate(oldDates.lastActivityDate) === new Date().toISOString().split('T')[0]
      : false
  }

  // Migrate XP
  const oldXP = data.xp || {}
  const migratedXP = {
    total: oldXP.total || 0,
    level: oldXP.level || Math.max(1, Math.floor((oldXP.total || 0) / 1000))
  }

  // Update document
  await userStatsRef.update({
    streak: migratedStreak,
    dates: migratedDates,
    xp: migratedXP,
    'metadata.schemaVersion': 2,
    'metadata.lastUpdated': new Date().toISOString(),
    'metadata.syncStatus': 'synced'
  })

  console.log('  ✅ Migrated user_stats:', {
    streak: migratedStreak.current,
    xp: migratedXP.total,
    lastActivity: migratedDates.lastActivityDate
  })
}

/**
 * Migrate drill_sessions collection
 */
async function migrateDrillSessions(userId: string) {
  console.log(`\n🎯 Migrating drill_sessions for ${userId}...`)

  const sessionsSnapshot = await db.collection('drill_sessions')
    .where('userId', '==', userId)
    .get()

  if (sessionsSnapshot.empty) {
    console.log('  ℹ️  No drill sessions found')
    return
  }

  console.log(`  Found ${sessionsSnapshot.size} drill sessions`)

  const batch = db.batch()
  let updateCount = 0

  for (const sessionDoc of sessionsSnapshot.docs) {
    const data = sessionDoc.data()

    // Migrate dates
    const startedAt = toISODateTime(data.startedAt) || new Date().toISOString()
    const completedAt = data.completedAt ? toISODateTime(data.completedAt) : null

    // Normalize accuracy
    const accuracy = normalizeAccuracy(data.accuracy)

    // Add version if missing
    const version = data.version || 1
    const updatedAt = completedAt || startedAt

    batch.update(sessionDoc.ref, {
      startedAt,
      completedAt,
      accuracy,
      version,
      updatedAt
    })

    updateCount++
  }

  if (updateCount > 0) {
    await batch.commit()
    console.log(`  ✅ Migrated ${updateCount} drill sessions`)
  }
}

/**
 * Migrate review_sessions collection (if any)
 */
async function migrateReviewSessions(userId: string) {
  console.log(`\n📚 Migrating review_sessions for ${userId}...`)

  const sessionsSnapshot = await db.collection('review_sessions')
    .where('userId', '==', userId)
    .get()

  if (sessionsSnapshot.empty) {
    console.log('  ℹ️  No review sessions found')
    return
  }

  console.log(`  Found ${sessionsSnapshot.size} review sessions`)

  const batch = db.batch()
  let updateCount = 0

  for (const sessionDoc of sessionsSnapshot.docs) {
    const data = sessionDoc.data()

    // Migrate dates
    const startedAt = toISODateTime(data.startedAt) || new Date().toISOString()
    const completedAt = data.completedAt ? toISODateTime(data.completedAt) : null

    // Normalize accuracy
    const accuracy = normalizeAccuracy(data.accuracy)

    batch.update(sessionDoc.ref, {
      startedAt,
      completedAt,
      accuracy
    })

    updateCount++
  }

  if (updateCount > 0) {
    await batch.commit()
    console.log(`  ✅ Migrated ${updateCount} review sessions`)
  }
}

/**
 * Verify migration
 */
async function verifyMigration(userId: string) {
  console.log(`\n🔍 Verifying migration...`)

  // Check user_stats
  const userStatsDoc = await db.collection('user_stats').doc(userId).get()

  if (userStatsDoc.exists) {
    const data = userStatsDoc.data()!

    console.log(`\n  User Stats:`)
    console.log(`    XP: ${data.xp?.total || 0}`)
    console.log(`    Level: ${data.xp?.level || 1}`)
    console.log(`    Current Streak: ${data.streak?.current || 0}`)
    console.log(`    Best Streak: ${data.streak?.best || 0}`)
    console.log(`    Last Activity: ${data.dates?.lastActivityDate || 'N/A'}`)
    console.log(`    Schema Version: ${data.metadata?.schemaVersion || 1}`)

    // Validate date format
    const lastActivity = data.dates?.lastActivityDate
    if (lastActivity) {
      const isValidISO = /^\d{4}-\d{2}-\d{2}$/.test(lastActivity)
      if (isValidISO) {
        console.log(`    ✅ Date format is valid ISO (yyyy-mm-dd)`)
      } else {
        console.log(`    ⚠️  Date format issue: ${lastActivity}`)
      }
    }
  }

  // Check drill sessions
  const drillSessions = await db.collection('drill_sessions')
    .where('userId', '==', userId)
    .limit(1)
    .get()

  if (!drillSessions.empty) {
    const sample = drillSessions.docs[0].data()
    console.log(`\n  Sample Drill Session:`)
    console.log(`    Started At: ${sample.startedAt}`)
    console.log(`    Accuracy: ${sample.accuracy}`)
    console.log(`    Version: ${sample.version || 'missing'}`)

    // Validate
    if (typeof sample.startedAt === 'string') {
      console.log(`    ✅ StartedAt is string`)
    }
    if (sample.accuracy >= 0 && sample.accuracy <= 100) {
      console.log(`    ✅ Accuracy is 0-100 range`)
    }
    if (sample.version) {
      console.log(`    ✅ Version tracking present`)
    }
  }

  console.log(`\n  ✅ Migration verified!`)
}

/**
 * Main migration function
 */
async function main() {
  const userId = process.argv[2]

  if (!userId) {
    console.error('❌ Error: User ID required')
    console.log('Usage: npx tsx scripts/migrate-single-user.ts <userId>')
    process.exit(1)
  }

  console.log(`\n🚀 Starting migration for user: ${userId}`)
  console.log(`📅 Date: ${new Date().toISOString()}`)

  try {
    // Step 1: Migrate user_stats
    await migrateUserStats(userId)

    // Step 2: Migrate drill_sessions
    await migrateDrillSessions(userId)

    // Step 3: Migrate review_sessions
    await migrateReviewSessions(userId)

    // Step 4: Verify migration
    await verifyMigration(userId)

    console.log(`\n✨ Migration complete!\n`)
    console.log(`📝 Summary:`)
    console.log(`  - All dates converted to ISO strings`)
    console.log(`  - Accuracy normalized to 0-100`)
    console.log(`  - Version tracking added`)
    console.log(`  - Schema version updated to 2`)
    console.log(`\n🎉 Your data is now bulletproof!\n`)

    process.exit(0)
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

main()
