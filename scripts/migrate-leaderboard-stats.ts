/**
 * Migration Script: Populate leaderboard_stats collection
 *
 * This script migrates existing user data from various Firebase collections
 * to the new lightweight leaderboard_stats collection.
 *
 * Usage:
 * npx ts-node scripts/migrate-leaderboard-stats.ts
 *
 * Options:
 * --dry-run    : Preview changes without writing to Firebase
 * --batch-size : Number of users to process at once (default: 10)
 * --limit      : Maximum number of users to migrate (default: all)
 */

import * as admin from 'firebase-admin'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Parse command line arguments
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='))
const limitArg = args.find(arg => arg.startsWith('--limit='))
const BATCH_SIZE = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 10
const USER_LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : Infinity

console.log('🚀 Leaderboard Stats Migration Script')
console.log('=====================================')
console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE MIGRATION'}`)
console.log(`Batch Size: ${BATCH_SIZE}`)
console.log(`User Limit: ${USER_LIMIT === Infinity ? 'All users' : USER_LIMIT}`)
console.log('')

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

interface MigrationStats {
  total: number
  migrated: number
  skipped: number
  failed: number
  errors: string[]
}

interface LeaderboardStatsData {
  userId: string
  displayName: string
  photoURL?: string
  totalXP: number
  currentStreak: number
  bestStreak: number
  level: number
  achievementPoints: number
  weeklyXP?: number
  monthlyXP?: number
  lastActivityDate: admin.firestore.Timestamp
  updatedAt: admin.firestore.Timestamp
  migratedAt: admin.firestore.Timestamp
}

async function migrateUser(userId: string): Promise<'migrated' | 'skipped' | 'failed'> {
  try {
    // Check if already migrated
    const existingStats = await db.collection('leaderboard_stats').doc(userId).get()
    if (existingStats.exists && !existingStats.data()?.needsUpdate) {
      console.log(`⏭️  Skipping ${userId} - already migrated`)
      return 'skipped'
    }

    // Fetch user data from various collections
    const [
      userDoc,
      xpDoc,
      activitiesDoc,
      achievementsDoc
    ] = await Promise.all([
      db.collection('users').doc(userId).get(),
      db.collection('users').doc(userId).collection('stats').doc('xp').get(),
      db.collection('users').doc(userId).collection('achievements').doc('activities').get(),
      db.collection('users').doc(userId).collection('achievements').doc('data').get()
    ])

    if (!userDoc.exists) {
      console.log(`⚠️  Skipping ${userId} - user not found`)
      return 'skipped'
    }

    const userData = userDoc.data() || {}
    const xpData = xpDoc.data() || {}
    const activitiesData = activitiesDoc.data() || {}
    const achievementsData = achievementsDoc.data() || {}

    // Build leaderboard stats (filter out undefined values)
    const stats: any = {
      userId,
      displayName: userData.displayName || userData.name || 'Anonymous',
      totalXP: xpData.totalXP || userData.totalXP || 0,
      currentStreak: activitiesData.currentStreak || userData.streakDays || 0,
      bestStreak: activitiesData.bestStreak || activitiesData.longestStreak || 0,
      level: xpData.currentLevel || userData.level || 1,
      achievementPoints: achievementsData.totalPoints || 0,
      weeklyXP: xpData.weeklyXP || 0,
      monthlyXP: xpData.monthlyXP || 0,
      lastActivityDate: activitiesData.lastActivity
        ? admin.firestore.Timestamp.fromMillis(activitiesData.lastActivity)
        : admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      migratedAt: admin.firestore.Timestamp.now()
    }

    // Only add photoURL if it exists
    const photoURL = userData.photoURL || userData.avatar
    if (photoURL) {
      stats.photoURL = photoURL
    }

    // Log what we're migrating
    console.log(`📊 Migrating ${userId}:`)
    console.log(`   Name: ${stats.displayName}`)
    console.log(`   XP: ${stats.totalXP} (Level ${stats.level})`)
    console.log(`   Streak: ${stats.currentStreak} days (best: ${stats.bestStreak})`)
    console.log(`   Achievement Points: ${stats.achievementPoints}`)

    if (!isDryRun) {
      // Write to leaderboard_stats collection
      await db.collection('leaderboard_stats').doc(userId).set(stats, { merge: true })
      console.log(`✅ Successfully migrated ${userId}`)
    } else {
      console.log(`🔍 [DRY RUN] Would migrate ${userId}`)
    }

    return 'migrated'

  } catch (error) {
    console.error(`❌ Failed to migrate ${userId}:`, error)
    return 'failed'
  }
}

async function runMigration() {
  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: []
  }

  try {
    console.log('\n📥 Fetching users...')

    // Get all users (or limited number)
    let query = db.collection('users')
    if (USER_LIMIT !== Infinity) {
      query = query.limit(USER_LIMIT)
    }
    const usersSnapshot = await query.get()

    const userIds = usersSnapshot.docs.map(doc => doc.id)
    stats.total = userIds.length

    console.log(`📋 Found ${stats.total} users to process\n`)

    // Process in batches
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE)
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(userIds.length / BATCH_SIZE)

      console.log(`\n🔄 Processing batch ${batchNumber}/${totalBatches} (${batch.length} users)`)
      console.log('─'.repeat(50))

      // Process batch in parallel
      const results = await Promise.all(
        batch.map(userId => migrateUser(userId))
      )

      // Update stats
      results.forEach(result => {
        if (result === 'migrated') stats.migrated++
        else if (result === 'skipped') stats.skipped++
        else if (result === 'failed') stats.failed++
      })

      // Add delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < userIds.length) {
        console.log('\n⏳ Waiting 2 seconds before next batch...')
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 MIGRATION SUMMARY')
    console.log('='.repeat(60))
    console.log(`Total Users:     ${stats.total}`)
    console.log(`✅ Migrated:     ${stats.migrated}`)
    console.log(`⏭️  Skipped:      ${stats.skipped}`)
    console.log(`❌ Failed:       ${stats.failed}`)
    console.log(`Success Rate:    ${((stats.migrated / stats.total) * 100).toFixed(1)}%`)

    if (isDryRun) {
      console.log('\n⚠️  This was a DRY RUN - no data was actually written to Firebase')
      console.log('Remove --dry-run flag to perform actual migration')
    } else {
      console.log('\n✨ Migration completed successfully!')
    }

    // Verify migration if not dry run
    if (!isDryRun && stats.migrated > 0) {
      console.log('\n🔍 Verifying migration...')
      const leaderboardStats = await db.collection('leaderboard_stats').get()
      console.log(`📊 leaderboard_stats collection now has ${leaderboardStats.size} documents`)

      // Show sample of migrated data
      const sample = await db.collection('leaderboard_stats')
        .orderBy('totalXP', 'desc')
        .limit(5)
        .get()

      if (!sample.empty) {
        console.log('\n🏆 Top 5 users by XP:')
        sample.docs.forEach((doc, index) => {
          const data = doc.data()
          console.log(`${index + 1}. ${data.displayName}: ${data.totalXP} XP (Level ${data.level})`)
        })
      }
    }

  } catch (error) {
    console.error('\n❌ Migration failed with error:', error)
    process.exit(1)
  }
}

// Run the migration
console.log('\n🏁 Starting migration...\n')
runMigration()
  .then(() => {
    console.log('\n✅ Script completed')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })