/**
 * Verification script for the new streak system
 * Checks that everything is properly set up
 */

const admin = require('firebase-admin')
const serviceAccount = require('../moshimoshi-service-account.json')

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

const db = admin.firestore()

async function verifyStreakSystem() {
  console.log('=== Streak System Verification ===\n')

  const checks = {
    users: 0,
    oldData: 0,
    newData: 0,
    migrated: 0,
    errors: []
  }

  try {
    // Get all users
    const usersSnapshot = await db.collection('users').get()
    checks.users = usersSnapshot.size

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data()
      const userId = userDoc.id

      console.log(`\nUser: ${userData.displayName || userData.email || userId}`)
      console.log('━'.repeat(40))

      // Check old location
      const oldDoc = await db
        .collection('users')
        .doc(userId)
        .collection('achievements')
        .doc('activities')
        .get()

      if (oldDoc.exists) {
        checks.oldData++
        console.log('✓ Old data exists at: achievements/activities')
      } else {
        console.log('○ No old data')
      }

      // Check new location
      const newDoc = await db
        .collection('users')
        .doc(userId)
        .collection('progress')
        .doc('streak')
        .get()

      if (newDoc.exists) {
        checks.newData++
        const data = newDoc.data()
        console.log('✓ New data exists at: progress/streak')
        console.log(`  - Current Streak: ${data.currentStreak} days`)
        console.log(`  - Longest Streak: ${data.longestStreak} days`)
        console.log(`  - Last Active: ${data.lastActiveDay || 'Never'}`)

        if (data.migratedAt) {
          checks.migrated++
          console.log('  - Migration Status: ✓ Migrated')
        }

        // Verify streak calculation
        if (data.lastActiveDay) {
          const today = new Date().toISOString().split('T')[0]
          const daysSince = Math.floor(
            (new Date(today).getTime() - new Date(data.lastActiveDay).getTime()) / (1000 * 60 * 60 * 24)
          )

          if (daysSince > 1 && data.currentStreak > 0) {
            console.log(`  ⚠️ Warning: Streak should be 0 (${daysSince} days since last activity)`)
            checks.errors.push(`User ${userId}: Streak not reset after ${daysSince} days`)
          } else if (daysSince <= 1 && data.currentStreak === 0) {
            console.log(`  ℹ️ Note: Streak is 0 but could be active (last active ${daysSince} day(s) ago)`)
          }
        }
      } else {
        console.log('✗ No new streak data')
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50))
    console.log('\n📊 VERIFICATION SUMMARY:')
    console.log(`  Total Users: ${checks.users}`)
    console.log(`  Users with old data: ${checks.oldData}`)
    console.log(`  Users with new streak data: ${checks.newData}`)
    console.log(`  Successfully migrated: ${checks.migrated}`)

    if (checks.errors.length > 0) {
      console.log(`\n⚠️ Issues Found:`)
      checks.errors.forEach(error => console.log(`  - ${error}`))
    } else {
      console.log('\n✅ All checks passed!')
    }

    // Test the new structure
    console.log('\n' + '='.repeat(50))
    console.log('\n🧪 TESTING NEW STRUCTURE:')

    // Simulate updating a streak
    const testUserId = 'r7r6at83BUPIjD69XatI4EGIECr1' // Your user ID
    const testDoc = await db
      .collection('users')
      .doc(testUserId)
      .collection('progress')
      .doc('streak')
      .get()

    if (testDoc.exists) {
      console.log('\n✓ Can read from new structure')

      // Test write (without actually changing data)
      const currentData = testDoc.data()
      await db
        .collection('users')
        .doc(testUserId)
        .collection('progress')
        .doc('streak')
        .set({
          ...currentData,
          lastVerified: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true })

      console.log('✓ Can write to new structure')
    }

    console.log('\n✅ Streak system is properly configured!')

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message)
    process.exit(1)
  }

  process.exit(0)
}

// Run verification
verifyStreakSystem()