#!/usr/bin/env node
/**
 * Script to recalculate achievement points for all users
 * Ensures totalPoints matches the sum of all unlocked achievements
 */

const admin = require('firebase-admin')
const path = require('path')

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '..', 'moshimoshi-service-account.json'))

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  })
}

const db = admin.firestore()

// Achievement definitions with their point values
const ACHIEVEMENTS = {
  'first-step': { points: 10, name: 'First Step' },
  'study-starter': { points: 25, name: 'Study Starter' },
  'sharpshooter': { points: 50, name: 'Sharpshooter' },
  'daily-devotee': { points: 30, name: 'Daily Devotee' },
  'quick-learner': { points: 30, name: 'Quick Learner' },
  'kanji-novice': { points: 20, name: 'Kanji Novice' },
  'vocab-builder': { points: 50, name: 'Vocab Builder' },
  'streak-starter': { points: 20, name: 'Streak Starter' },
  'speed-demon': { points: 50, name: 'Speed Demon' },
  'perfectionist': { points: 100, name: 'Perfectionist' },
  'consistent-performer': { points: 15, name: 'Consistent Performer' },
  'review-master': { points: 30, name: 'Review Master' },
  'week-warrior': { points: 35, name: 'Week Warrior' },
  'month-master': { points: 75, name: 'Month Master' },
  'accuracy-ace': { points: 40, name: 'Accuracy Ace' },
  'dedication-hero': { points: 60, name: 'Dedication Hero' },
  'master-reviewer': { points: 80, name: 'Master Reviewer' },
  'perfect-week': { points: 45, name: 'Perfect Week' },
  'unstoppable': { points: 90, name: 'Unstoppable' },
  'legendary-learner': { points: 150, name: 'Legendary Learner' }
}

async function recalculateAchievementPoints() {
  try {
    console.log('Starting achievement points recalculation...')

    // Get all users
    const usersSnapshot = await db.collection('users').get()
    console.log(`Found ${usersSnapshot.size} users`)

    let updatedCount = 0
    let errorCount = 0

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id
      const userData = userDoc.data()

      try {
        // Get user's achievement data
        const achievementDoc = await db.collection('users')
          .doc(userId)
          .collection('achievements')
          .doc('data')
          .get()

        if (!achievementDoc.exists) {
          console.log(`⚠️  No achievement data for user ${userData.displayName || userId}`)
          continue
        }

        const achievementData = achievementDoc.data()
        const unlockedAchievements = achievementData.unlocked || []

        // Calculate correct total points
        let calculatedPoints = 0
        const unlockedDetails = []

        // Handle both array and Set-like structures
        if (Array.isArray(unlockedAchievements)) {
          unlockedAchievements.forEach(achievementId => {
            const achievement = ACHIEVEMENTS[achievementId]
            if (achievement) {
              calculatedPoints += achievement.points
              unlockedDetails.push(`${achievementId} (${achievement.points}pts)`)
            } else {
              console.log(`  ⚠️ Unknown achievement: ${achievementId}`)
            }
          })
        } else if (typeof unlockedAchievements === 'object') {
          // Handle object/map structure
          Object.keys(unlockedAchievements).forEach(achievementId => {
            if (unlockedAchievements[achievementId]) {
              const achievement = ACHIEVEMENTS[achievementId]
              if (achievement) {
                calculatedPoints += achievement.points
                unlockedDetails.push(`${achievementId} (${achievement.points}pts)`)
              } else {
                console.log(`  ⚠️ Unknown achievement: ${achievementId}`)
              }
            }
          })
        }

        const currentPoints = achievementData.totalPoints || 0

        if (currentPoints !== calculatedPoints) {
          console.log(`\n📊 User: ${userData.displayName || userId}`)
          console.log(`  Current points: ${currentPoints}`)
          console.log(`  Calculated points: ${calculatedPoints}`)
          console.log(`  Unlocked: ${unlockedDetails.join(', ') || 'none'}`)
          console.log(`  ✅ Updating to ${calculatedPoints} points...`)

          // Update the achievement document with correct points
          await db.collection('users')
            .doc(userId)
            .collection('achievements')
            .doc('data')
            .update({
              totalPoints: calculatedPoints,
              lastRecalculated: admin.firestore.FieldValue.serverTimestamp()
            })

          updatedCount++
        } else {
          console.log(`✓ User ${userData.displayName || userId}: Points are correct (${currentPoints})`)
        }

      } catch (error) {
        console.error(`❌ Error processing user ${userId}:`, error.message)
        errorCount++
      }
    }

    console.log('\n=================================')
    console.log('Achievement Points Recalculation Complete!')
    console.log(`✅ Updated: ${updatedCount} users`)
    console.log(`❌ Errors: ${errorCount} users`)
    console.log('=================================')

  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

// Run the script
recalculateAchievementPoints()
  .then(() => {
    console.log('Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })