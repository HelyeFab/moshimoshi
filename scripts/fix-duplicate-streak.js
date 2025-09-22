#!/usr/bin/env node

/**
 * Script to fix duplicate streak data in Firebase
 * Run this to clean up the conflicting streak values
 */

const admin = require('firebase-admin')
const serviceAccount = require('../config/firebase-admin-key.json')

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  })
}

const db = admin.firestore()

async function fixDuplicateStreak(userId) {
  console.log(`\n=== Fixing Duplicate Streak Data for User: ${userId} ===\n`)

  try {
    // Get the activities document
    const activitiesRef = db
      .collection('users')
      .doc(userId)
      .collection('achievements')
      .doc('activities')

    const doc = await activitiesRef.get()

    if (!doc.exists) {
      console.log('❌ No activities document found')
      return
    }

    const data = doc.data()
    console.log('Current data structure:', JSON.stringify(data, null, 2))

    // Check for nested/duplicate data
    if (data.dates && typeof data.dates === 'object') {
      // Count the dates
      const dateKeys = Object.keys(data.dates).filter(key => key.match(/^\d{4}-\d{2}-\d{2}$/))
      console.log(`\nFound ${dateKeys.length} activity dates:`, dateKeys)

      // Recalculate the correct streak
      const sortedDates = dateKeys.sort().reverse()
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      let streak = 0
      let expectedDate = new Date(today)

      for (const dateStr of sortedDates) {
        const date = new Date(dateStr)
        date.setHours(0, 0, 0, 0)

        const daysDiff = Math.floor((expectedDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

        if (daysDiff === 0) {
          streak++
          expectedDate.setDate(expectedDate.getDate() - 1)
        } else if (streak === 0 && daysDiff === 1) {
          // Yesterday - streak is still active
          streak++
          expectedDate.setDate(expectedDate.getDate() - 2)
        } else {
          break
        }
      }

      console.log(`\nCalculated streak: ${streak}`)

      // Build the correct data structure
      const correctData = {
        dates: {},
        currentStreak: streak,
        bestStreak: Math.max(data.bestStreak || 0, streak),
        lastActivity: Date.now()
      }

      // Add all valid dates
      dateKeys.forEach(date => {
        correctData.dates[date] = true
      })

      console.log('\nCorrected data structure:', JSON.stringify(correctData, null, 2))

      // Ask for confirmation
      console.log('\n⚠️  This will update the Firebase document with the corrected data.')
      console.log('Press Enter to continue or Ctrl+C to cancel...')

      await new Promise(resolve => {
        process.stdin.once('data', resolve)
      })

      // Update Firebase with the correct structure
      await activitiesRef.set(correctData)

      console.log('\n✅ Successfully fixed duplicate streak data!')
      console.log('Current streak:', correctData.currentStreak)
      console.log('Best streak:', correctData.bestStreak)

    } else {
      console.log('✅ Data structure looks correct')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

// Get user ID from command line or use default
const userId = process.argv[2] || 'r7r6at83BUPIjD69XatI4EGIECr1'

console.log('===========================================')
console.log('FIX DUPLICATE STREAK DATA')
console.log('===========================================')
console.log('\nUsage: node scripts/fix-duplicate-streak.js [userId]')
console.log('Default userId:', userId)
console.log('===========================================')

fixDuplicateStreak(userId).then(() => {
  process.exit(0)
}).catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})