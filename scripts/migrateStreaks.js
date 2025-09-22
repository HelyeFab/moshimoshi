/**
 * Migration script to move streak data from old structure to new
 * Run this once to migrate existing user streak data
 *
 * Old structure: users/{uid}/achievements/activities
 * New structure: users/{uid}/progress/streak
 */

const admin = require('firebase-admin')
const serviceAccount = require('../moshimoshi-service-account.json')

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

const db = admin.firestore()

async function migrateAllUsers() {
  console.log('=== Starting Streak Migration ===\n')

  try {
    // Get all users
    const usersSnapshot = await db.collection('users').get()

    if (usersSnapshot.empty) {
      console.log('No users found in database')
      return
    }

    console.log(`Found ${usersSnapshot.size} user(s) to migrate\n`)

    let migrationCount = 0
    let skippedCount = 0

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data()
      const userId = userDoc.id

      console.log(`Processing user: ${userData.displayName || userData.email || userId}`)

      // Check if already migrated
      const newStreakDoc = await db
        .collection('users')
        .doc(userId)
        .collection('progress')
        .doc('streak')
        .get()

      if (newStreakDoc.exists) {
        console.log('  ✓ Already migrated, skipping\n')
        skippedCount++
        continue
      }

      // Try to get old data
      const oldActivitiesDoc = await db
        .collection('users')
        .doc(userId)
        .collection('achievements')
        .doc('activities')
        .get()

      if (!oldActivitiesDoc.exists) {
        console.log('  ✗ No old data to migrate\n')
        skippedCount++
        continue
      }

      const oldData = oldActivitiesDoc.data()
      console.log('  Found old data:', {
        dates: Object.keys(oldData.dates || {}).length + ' dates',
        currentStreak: oldData.currentStreak,
        bestStreak: oldData.bestStreak
      })

      // Extract and clean dates
      const dates = {}

      // Handle dates object
      if (oldData.dates) {
        Object.entries(oldData.dates).forEach(([key, value]) => {
          if (key.match(/^\d{4}-\d{2}-\d{2}$/) && value === true) {
            dates[key] = true
          }
        })
      }

      // Handle corrupted root-level dates (like "dates.2025-09-17")
      Object.entries(oldData).forEach(([key, value]) => {
        if (key.startsWith('dates.') && key.match(/dates\.\d{4}-\d{2}-\d{2}$/)) {
          const dateOnly = key.replace('dates.', '')
          dates[dateOnly] = true
          console.log(`  Fixed corrupted date: ${key} -> ${dateOnly}`)
        }
      })

      const sortedDates = Object.keys(dates).sort()

      // Calculate streak and lastActiveDay
      let currentStreak = 0
      let lastActiveDay = null

      if (sortedDates.length > 0) {
        lastActiveDay = sortedDates[sortedDates.length - 1]

        // Calculate current streak
        const today = new Date().toISOString().split('T')[0]
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

        // Check if streak is still active
        const daysSinceActive = Math.floor(
          (new Date(today).getTime() - new Date(lastActiveDay).getTime()) / (1000 * 60 * 60 * 24)
        )

        if (daysSinceActive <= 1) {
          // Streak is still active, count backwards
          let checkDate = lastActiveDay
          for (let i = sortedDates.length - 1; i >= 0; i--) {
            if (sortedDates[i] === checkDate) {
              currentStreak++
              const prevDate = new Date(checkDate)
              prevDate.setDate(prevDate.getDate() - 1)
              checkDate = prevDate.toISOString().split('T')[0]
            } else {
              break
            }
          }
        }
      }

      const longestStreak = Math.max(oldData.bestStreak || 0, currentStreak)

      // Create new streak document
      const newStreakData = {
        currentStreak,
        longestStreak,
        lastActiveDay,
        userId,
        migratedAt: admin.firestore.FieldValue.serverTimestamp(),
        migratedFrom: 'achievements/activities',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }

      await db
        .collection('users')
        .doc(userId)
        .collection('progress')
        .doc('streak')
        .set(newStreakData)

      console.log(`  ✓ Migrated successfully:`)
      console.log(`    Current streak: ${currentStreak} days`)
      console.log(`    Longest streak: ${longestStreak} days`)
      console.log(`    Last active: ${lastActiveDay}\n`)

      migrationCount++
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('\n=== Migration Complete ===')
    console.log(`✓ Migrated: ${migrationCount} user(s)`)
    console.log(`○ Skipped: ${skippedCount} user(s)`)
    console.log(`Total processed: ${usersSnapshot.size} user(s)\n`)

  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }

  process.exit(0)
}

// Run migration
migrateAllUsers()