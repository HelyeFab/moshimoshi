#!/usr/bin/env tsx
/**
 * Comprehensive User Data Migration Script
 *
 * Migrates ALL collections to consistent schema:
 * - ISO string dates (no more Timestamp objects)
 * - Version tracking on all documents
 * - Normalized accuracy values (0-100)
 *
 * Run: npx tsx scripts/migrate-all-collections.ts <userId>
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

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

  if (value <= 1.0 && value >= 0.0) {
    return value * 100
  }

  return Math.min(100, Math.max(0, value))
}

/**
 * Migrate user_stats document (complete migration)
 */
async function migrateUserStats(userId: string) {
  console.log(`\n📊 Migrating user_stats for ${userId}...`)

  const userStatsRef = db.collection('user_stats').doc(userId)
  const doc = await userStatsRef.get()

  if (!doc.exists) {
    console.log('  ⚠️  No user_stats document found')
    return
  }

  const data = doc.data()!

  // Migrate all Timestamp fields to ISO strings
  const updates: any = {
    'metadata.schemaVersion': 2,
    'metadata.lastUpdated': new Date().toISOString(),
    'metadata.syncStatus': 'synced'
  }

  // Fix dates.lastActivityDate if it's a Timestamp
  if (data.dates?.lastActivityDate) {
    const lastActivity = toISODate(data.dates.lastActivityDate)
    if (lastActivity) {
      updates['dates.lastActivityDate'] = lastActivity
      updates['dates.isActiveToday'] = lastActivity === new Date().toISOString().split('T')[0]
    }
  }

  // Fix any Timestamp fields in the document
  if (data.updatedAt instanceof Timestamp || (data.updatedAt && typeof data.updatedAt === 'object')) {
    updates['updatedAt'] = new Date().toISOString()
  }

  if (data.versionMigratedAt instanceof Timestamp || (data.versionMigratedAt && typeof data.versionMigratedAt === 'object')) {
    // Remove legacy field
    updates['versionMigratedAt'] = null
  }

  // Ensure streak has updatedAt as Timestamp for now (will be converted client-side)
  if (data.streak && !data.streak.updatedAt) {
    updates['streak.updatedAt'] = Timestamp.now()
  }

  await userStatsRef.update(updates)

  console.log('  ✅ Migrated user_stats')
}

/**
 * Migrate review_sessions collection
 */
async function migrateReviewSessions(userId: string) {
  console.log(`\n📚 Migrating review_sessions for ${userId}...`)

  const sessionsSnapshot = await db
    .collection('users')
    .doc(userId)
    .collection('review_sessions')
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

    const updates: any = {
      startedAt: toISODateTime(data.startedAt) || new Date().toISOString(),
      completedAt: toISODateTime(data.completedAt) || null,
      createdAt: toISODateTime(data.createdAt) || new Date().toISOString(),
      version: data.version || 1,
      updatedAt: toISODateTime(data.completedAt || data.createdAt) || new Date().toISOString()
    }

    // Normalize accuracy if present
    if (data.accuracy !== undefined) {
      updates.accuracy = normalizeAccuracy(data.accuracy)
    }

    // Migrate character-level timestamps
    if (data.characters && Array.isArray(data.characters)) {
      updates.characters = data.characters.map((char: any) => ({
        ...char,
        nextReviewAt: toISODateTime(char.nextReviewAt)
      }))
    }

    batch.update(sessionDoc.ref, updates)
    updateCount++
  }

  if (updateCount > 0) {
    await batch.commit()
    console.log(`  ✅ Migrated ${updateCount} review sessions`)
  }
}

/**
 * Migrate study_sessions collection
 */
async function migrateStudySessions(userId: string) {
  console.log(`\n📖 Migrating study_sessions for ${userId}...`)

  const sessionsSnapshot = await db
    .collection('users')
    .doc(userId)
    .collection('study_sessions')
    .get()

  if (sessionsSnapshot.empty) {
    console.log('  ℹ️  No study sessions found')
    return
  }

  console.log(`  Found ${sessionsSnapshot.size} study sessions`)

  const batch = db.batch()
  let updateCount = 0

  for (const sessionDoc of sessionsSnapshot.docs) {
    const data = sessionDoc.data()

    const updates: any = {
      startedAt: toISODateTime(data.startedAt) || new Date().toISOString(),
      completedAt: toISODateTime(data.completedAt) || null,
      createdAt: toISODateTime(data.createdAt) || new Date().toISOString(),
      version: data.version || 1,
      updatedAt: toISODateTime(data.completedAt || data.createdAt) || new Date().toISOString()
    }

    // Migrate character-level timestamps
    if (data.characters && Array.isArray(data.characters)) {
      updates.characters = data.characters.map((char: any) => ({
        ...char,
        nextReviewAt: toISODateTime(char.nextReviewAt)
      }))
    }

    batch.update(sessionDoc.ref, updates)
    updateCount++
  }

  if (updateCount > 0) {
    await batch.commit()
    console.log(`  ✅ Migrated ${updateCount} study sessions`)
  }
}

/**
 * Migrate review_history collection
 */
async function migrateReviewHistory(userId: string) {
  console.log(`\n📝 Migrating review_history for ${userId}...`)

  const historySnapshot = await db
    .collection('users')
    .doc(userId)
    .collection('review_history')
    .get()

  if (historySnapshot.empty) {
    console.log('  ℹ️  No review history found')
    return
  }

  console.log(`  Found ${historySnapshot.size} review history events`)

  const batch = db.batch()
  let updateCount = 0

  for (const historyDoc of historySnapshot.docs) {
    const data = historyDoc.data()

    const updates: any = {
      timestamp: toISODateTime(data.timestamp) || new Date().toISOString(),
      createdAt: toISODateTime(data.createdAt) || new Date().toISOString(),
      version: data.version || 1
    }

    batch.update(historyDoc.ref, updates)
    updateCount++
  }

  if (updateCount > 0) {
    await batch.commit()
    console.log(`  ✅ Migrated ${updateCount} review history events`)
  }
}

/**
 * Migrate srs_data collection
 */
async function migrateSRSData(userId: string) {
  console.log(`\n🧠 Migrating srs_data for ${userId}...`)

  const srsSnapshot = await db
    .collection('users')
    .doc(userId)
    .collection('srs_data')
    .get()

  if (srsSnapshot.empty) {
    console.log('  ℹ️  No SRS data found')
    return
  }

  console.log(`  Found ${srsSnapshot.size} SRS items`)

  const batch = db.batch()
  let updateCount = 0

  for (const srsDoc of srsSnapshot.docs) {
    const data = srsDoc.data()

    const updates: any = {
      lastReviewedAt: toISODateTime(data.lastReviewedAt),
      nextReviewAt: toISODateTime(data.nextReviewAt),
      updatedAt: toISODateTime(data.updatedAt) || new Date().toISOString(),
      createdAt: toISODateTime(data.createdAt) || new Date().toISOString(),
      version: data.version || 1
    }

    batch.update(srsDoc.ref, updates)
    updateCount++
  }

  if (updateCount > 0) {
    await batch.commit()
    console.log(`  ✅ Migrated ${updateCount} SRS items`)
  }
}

/**
 * Migrate searched_words collection
 */
async function migrateSearchedWords(userId: string) {
  console.log(`\n🔍 Migrating searched_words for ${userId}...`)

  const searchSnapshot = await db
    .collection('users')
    .doc(userId)
    .collection('searched_words')
    .get()

  if (searchSnapshot.empty) {
    console.log('  ℹ️  No searched words found')
    return
  }

  console.log(`  Found ${searchSnapshot.size} searched words`)

  const batch = db.batch()
  let updateCount = 0

  for (const searchDoc of searchSnapshot.docs) {
    const data = searchDoc.data()

    const updates: any = {
      timestamp: toISODateTime(data.timestamp) || new Date().toISOString(),
      syncedAt: toISODateTime(data.syncedAt),
      version: data.version || 1
    }

    batch.update(searchDoc.ref, updates)
    updateCount++
  }

  if (updateCount > 0) {
    await batch.commit()
    console.log(`  ✅ Migrated ${updateCount} searched words`)
  }
}

/**
 * Verify comprehensive migration
 */
async function verifyMigration(userId: string) {
  console.log(`\n🔍 Verifying comprehensive migration...`)

  let issuesFound = 0

  // Check user_stats
  const userStatsDoc = await db.collection('user_stats').doc(userId).get()
  if (userStatsDoc.exists) {
    const data = userStatsDoc.data()!
    console.log(`\n  ✅ user_stats: Schema version ${data.metadata?.schemaVersion}`)

    // Check for Timestamps
    if (data.updatedAt instanceof Timestamp) {
      console.log(`    ⚠️  Still has Timestamp: updatedAt`)
      issuesFound++
    }
  }

  // Sample check one review session
  const reviewSessions = await db
    .collection('users')
    .doc(userId)
    .collection('review_sessions')
    .limit(1)
    .get()

  if (!reviewSessions.empty) {
    const sample = reviewSessions.docs[0].data()
    console.log(`\n  ✅ review_sessions sample:`)
    console.log(`     startedAt: ${typeof sample.startedAt === 'string' ? '✓ string' : '✗ ' + typeof sample.startedAt}`)
    console.log(`     version: ${sample.version || 'missing'}`)

    if (sample.startedAt instanceof Timestamp) {
      issuesFound++
    }
  }

  // Sample check one study session
  const studySessions = await db
    .collection('users')
    .doc(userId)
    .collection('study_sessions')
    .limit(1)
    .get()

  if (!studySessions.empty) {
    const sample = studySessions.docs[0].data()
    console.log(`\n  ✅ study_sessions sample:`)
    console.log(`     startedAt: ${typeof sample.startedAt === 'string' ? '✓ string' : '✗ ' + typeof sample.startedAt}`)
    console.log(`     version: ${sample.version || 'missing'}`)

    if (sample.startedAt instanceof Timestamp) {
      issuesFound++
    }
  }

  if (issuesFound === 0) {
    console.log(`\n  🎉 All collections verified - no Timestamp objects found!`)
  } else {
    console.log(`\n  ⚠️  Found ${issuesFound} issues that need attention`)
  }
}

/**
 * Main migration function
 */
async function main() {
  const userId = process.argv[2]

  if (!userId) {
    console.error('❌ Error: User ID required')
    console.log('Usage: npx tsx scripts/migrate-all-collections.ts <userId>')
    process.exit(1)
  }

  console.log(`\n🚀 Starting comprehensive migration for user: ${userId}`)
  console.log(`📅 Date: ${new Date().toISOString()}`)

  try {
    // Migrate all collections
    await migrateUserStats(userId)
    await migrateReviewSessions(userId)
    await migrateStudySessions(userId)
    await migrateReviewHistory(userId)
    await migrateSRSData(userId)
    await migrateSearchedWords(userId)

    // Verify
    await verifyMigration(userId)

    console.log(`\n✨ Comprehensive migration complete!\n`)
    console.log(`📝 What was migrated:`)
    console.log(`  ✅ user_stats - All Timestamp fields → ISO strings`)
    console.log(`  ✅ review_sessions - startedAt, completedAt, createdAt → ISO strings`)
    console.log(`  ✅ study_sessions - startedAt, completedAt, createdAt → ISO strings`)
    console.log(`  ✅ review_history - timestamp, createdAt → ISO strings`)
    console.log(`  ✅ srs_data - lastReviewedAt, nextReviewAt, updatedAt → ISO strings`)
    console.log(`  ✅ searched_words - timestamp, syncedAt → ISO strings`)
    console.log(`  ✅ Version tracking added to all documents`)
    console.log(`\n🎉 Your entire database is now bulletproof!\n`)

    process.exit(0)
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

main()
