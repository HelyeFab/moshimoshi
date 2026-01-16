#!/usr/bin/env tsx

/**
 * Firebase Streak & XP Check Script
 * Checks user streak and XP data from Firestore
 *
 * Usage: tsx scripts/check-streak-xp.ts [email]
 * Example: tsx scripts/check-streak-xp.ts emmanuelfabiani23@gmail.com
 */

import * as admin from 'firebase-admin'
import * as path from 'path'

// Service account path
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../moshimoshi-service-account.json')

// Get email from command line or use default
const emailToSearch = process.argv[2] || 'emmanuelfabiani23@gmail.com'

console.log('🔥 Streak & XP Check Script')
console.log('━'.repeat(50))
console.log(`📧 User: ${emailToSearch}`)
console.log('━'.repeat(50))
console.log('')

async function checkStreakAndXP() {
  try {
    // Initialize Firebase Admin
    const serviceAccount = require(SERVICE_ACCOUNT_PATH)

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    })

    const auth = admin.auth()
    const firestore = admin.firestore()

    // Get user UID from email
    let uid: string
    try {
      const userRecord = await auth.getUserByEmail(emailToSearch)
      uid = userRecord.uid
      console.log(`✅ Found user: ${userRecord.displayName || 'N/A'}`)
      console.log(`   UID: ${uid}`)
      console.log('')
    } catch (error: any) {
      console.error(`❌ User not found: ${emailToSearch}`)
      process.exit(1)
    }

    // Get user document
    const userDoc = await firestore.collection('users').doc(uid).get()

    if (!userDoc.exists) {
      console.error(`❌ User document not found in Firestore`)
      process.exit(1)
    }

    const userData = userDoc.data()!

    // Display Streak Information
    console.log('🔥 STREAK INFORMATION')
    console.log('━'.repeat(50))

    if (userData.streak) {
      console.log(`Current Streak: ${userData.streak.current || 0} days`)
      console.log(`Longest Streak: ${userData.streak.longest || 0} days`)
      console.log(`Last Activity: ${userData.streak.lastActivityDate?.toDate?.() || 'Never'}`)

      if (userData.streak.freezes !== undefined) {
        console.log(`Streak Freezes Available: ${userData.streak.freezes}`)
      }

      if (userData.streak.startDate) {
        console.log(`Streak Started: ${userData.streak.startDate.toDate()}`)
      }
    } else {
      console.log('⚠️  No streak data found')
    }

    console.log('')

    // Display XP Information
    console.log('⭐ XP & LEVEL INFORMATION')
    console.log('━'.repeat(50))

    if (userData.gamification) {
      const gam = userData.gamification
      console.log(`Total XP: ${gam.totalXP || 0}`)
      console.log(`Current Level: ${gam.level || 1}`)
      console.log(`XP to Next Level: ${gam.xpToNextLevel || 'N/A'}`)
      console.log(`Current Level XP: ${gam.currentLevelXP || 0}`)

      if (gam.rank) {
        console.log(`Rank: ${gam.rank}`)
      }
    } else {
      console.log('⚠️  No gamification data found')
    }

    console.log('')

    // Display Activity Stats
    console.log('📊 ACTIVITY STATS')
    console.log('━'.repeat(50))

    if (userData.stats) {
      const stats = userData.stats
      console.log(`Total Study Time: ${stats.totalStudyTime || 0} minutes`)
      console.log(`Words Learned: ${stats.wordsLearned || 0}`)
      console.log(`Lessons Completed: ${stats.lessonsCompleted || 0}`)
      console.log(`Flashcards Reviewed: ${stats.flashcardsReviewed || 0}`)
      console.log(`Perfect Sessions: ${stats.perfectSessions || 0}`)
    } else {
      console.log('⚠️  No stats data found')
    }

    console.log('')

    // Check for leaderboard data
    console.log('🏆 LEADERBOARD DATA')
    console.log('━'.repeat(50))

    const leaderboardDoc = await firestore
      .collection('leaderboard')
      .doc(uid)
      .get()

    if (leaderboardDoc.exists) {
      const leaderboardData = leaderboardDoc.data()!
      console.log(`Weekly XP: ${leaderboardData.weeklyXP || 0}`)
      console.log(`Monthly XP: ${leaderboardData.monthlyXP || 0}`)
      console.log(`All-Time XP: ${leaderboardData.allTimeXP || 0}`)

      if (leaderboardData.weeklyRank) {
        console.log(`Weekly Rank: #${leaderboardData.weeklyRank}`)
      }
      if (leaderboardData.monthlyRank) {
        console.log(`Monthly Rank: #${leaderboardData.monthlyRank}`)
      }
      if (leaderboardData.allTimeRank) {
        console.log(`All-Time Rank: #${leaderboardData.allTimeRank}`)
      }
    } else {
      console.log('⚠️  No leaderboard data found')
    }

    console.log('')

    // Check for achievements
    console.log('🏅 ACHIEVEMENTS')
    console.log('━'.repeat(50))

    const achievementsSnapshot = await firestore
      .collection('users')
      .doc(uid)
      .collection('achievements')
      .get()

    if (!achievementsSnapshot.empty) {
      console.log(`Total Achievements: ${achievementsSnapshot.size}`)

      const unlockedAchievements = achievementsSnapshot.docs.filter(
        doc => doc.data().unlocked === true
      )

      console.log(`Unlocked: ${unlockedAchievements.length}`)
      console.log(`Locked: ${achievementsSnapshot.size - unlockedAchievements.length}`)

      if (unlockedAchievements.length > 0) {
        console.log('')
        console.log('Recent Unlocked:')
        unlockedAchievements
          .slice(0, 5)
          .forEach(doc => {
            const data = doc.data()
            console.log(`   🏅 ${data.name || doc.id}`)
            if (data.unlockedAt) {
              console.log(`      Unlocked: ${data.unlockedAt.toDate()}`)
            }
          })
      }
    } else {
      console.log('⚠️  No achievements data found')
    }

    console.log('')

    // Summary
    console.log('📈 SUMMARY')
    console.log('━'.repeat(50))

    const currentStreak = userData.streak?.current || 0
    const longestStreak = userData.streak?.longest || 0
    const totalXP = userData.gamification?.totalXP || 0
    const level = userData.gamification?.level || 1

    if (currentStreak > 0) {
      console.log(`🔥 You're on a ${currentStreak} day streak!`)
      if (currentStreak === longestStreak && currentStreak > 1) {
        console.log(`   🎉 This is your longest streak!`)
      }
    } else {
      console.log(`😴 No active streak. Start learning today!`)
    }

    console.log(`⭐ Level ${level} with ${totalXP} total XP`)

    if (userData.gamification?.xpToNextLevel) {
      console.log(`   ${userData.gamification.xpToNextLevel} XP until level ${level + 1}`)
    }

    console.log('')
    console.log('✅ Check complete!')

  } catch (error: any) {
    console.error('')
    console.error('❌ Error:', error.message)
    console.error('')
    if (error.stack) {
      console.error('Stack trace:')
      console.error(error.stack)
    }
    process.exit(1)
  } finally {
    // Cleanup
    await admin.app().delete()
    process.exit(0)
  }
}

// Run the script
checkStreakAndXP()
