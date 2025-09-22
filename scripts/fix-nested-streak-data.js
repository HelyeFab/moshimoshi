#!/usr/bin/env node

/**
 * Script to fix nested streak data structure in Firebase
 * This fixes the issue where currentStreak and bestStreak are nested inside dates object
 */

const admin = require('firebase-admin')
const serviceAccount = require('../moshimoshi-service-account.json')

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  })
}

const db = admin.firestore()

async function fixNestedStreakData(userId) {
  console.log(`\n=== Fixing Nested Streak Data for User: ${userId} ===\n`)

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
    console.log('\n📊 Current data structure:')
    console.log(JSON.stringify(data, null, 2))

    // Check if streak values are nested inside dates
    let needsFix = false
    let correctStreak = data.currentStreak || 0
    let correctBestStreak = data.bestStreak || 0
    let validDates = {}

    if (data.dates && typeof data.dates === 'object') {
      // Check for nested streak values
      if ('currentStreak' in data.dates || 'bestStreak' in data.dates) {
        console.log('\n⚠️  Found nested streak values inside dates object!')
        needsFix = true
        
        // Get the nested values if they exist and are better than root level
        if (data.dates.currentStreak > correctStreak) {
          correctStreak = data.dates.currentStreak
          console.log(`  - Using nested currentStreak: ${correctStreak}`)
        }
        if (data.dates.bestStreak > correctBestStreak) {
          correctBestStreak = data.dates.bestStreak
          console.log(`  - Using nested bestStreak: ${correctBestStreak}`)
        }
      }

      // Check for double-nested dates
      if (data.dates.dates && typeof data.dates.dates === 'object') {
        console.log('\n⚠️  Found double-nested dates structure!')
        needsFix = true
        
        // Extract dates from double-nested structure
        Object.entries(data.dates.dates).forEach(([key, value]) => {
          if (key.match(/^\d{4}-\d{2}-\d{2}$/)) {
            validDates[key] = value
          }
        })
      }

      // Also get dates from the first level
      Object.entries(data.dates).forEach(([key, value]) => {
        if (key.match(/^\d{4}-\d{2}-\d{2}$/)) {
          validDates[key] = value
        }
      })
    }

    // If no dates were found but streak exists, check for dates at root
    if (Object.keys(validDates).length === 0) {
      Object.entries(data).forEach(([key, value]) => {
        if (key.match(/^\d{4}-\d{2}-\d{2}$/)) {
          validDates[key] = value
          needsFix = true
        }
      })
    }

    const dateKeys = Object.keys(validDates)
    console.log(`\n📅 Found ${dateKeys.length} activity dates:`, dateKeys.sort())

    // Recalculate the correct streak based on dates
    if (dateKeys.length > 0) {
      const sortedDates = dateKeys.sort().reverse()
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      let calculatedStreak = 0
      let expectedDate = new Date(today)

      for (const dateStr of sortedDates) {
        const date = new Date(dateStr)
        date.setHours(0, 0, 0, 0)

        const daysDiff = Math.floor((expectedDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

        if (daysDiff === 0) {
          calculatedStreak++
          expectedDate.setDate(expectedDate.getDate() - 1)
        } else if (calculatedStreak === 0 && daysDiff === 1) {
          // Yesterday - streak is still active
          calculatedStreak++
          expectedDate.setDate(expectedDate.getDate() - 2)
        } else {
          break
        }
      }

      console.log(`\n🔥 Calculated streak from dates: ${calculatedStreak}`)
      
      // Use the calculated streak if it's different
      if (calculatedStreak !== correctStreak) {
        console.log(`  ⚠️ Streak mismatch! Stored: ${correctStreak}, Calculated: ${calculatedStreak}`)
        correctStreak = calculatedStreak
      }
    }

    // Build the correct data structure
    const correctData = {
      dates: validDates,
      currentStreak: correctStreak,
      bestStreak: Math.max(correctBestStreak, correctStreak),
      lastActivity: data.lastActivity || Date.now()
    }

    console.log('\n✅ Corrected data structure:')
    console.log(JSON.stringify(correctData, null, 2))

    if (!needsFix && data.currentStreak === correctData.currentStreak) {
      console.log('\n✅ Data structure is already correct!')
      return
    }

    // Ask for confirmation
    console.log('\n⚠️  This will update the Firebase document with the corrected data.')
    console.log('Press Enter to continue or Ctrl+C to cancel...')

    await new Promise(resolve => {
      process.stdin.once('data', resolve)
    })

    // Update Firebase with the correct structure
    await activitiesRef.set(correctData)

    console.log('\n🎉 Successfully fixed nested streak data!')
    console.log('Current streak:', correctData.currentStreak)
    console.log('Best streak:', correctData.bestStreak)
    console.log('Active dates:', Object.keys(correctData.dates).length)

  } catch (error) {
    console.error('\n❌ Error:', error)
  }
}

// Get user ID from command line or use default
const userId = process.argv[2] || 'r7r6at83BUPIjD69XatI4EGIECr1'

console.log('===========================================')
console.log('FIX NESTED STREAK DATA STRUCTURE')
console.log('===========================================')
console.log('\nUsage: node scripts/fix-nested-streak-data.js [userId]')
console.log('User ID:', userId)
console.log('===========================================')

fixNestedStreakData(userId).then(() => {
  process.exit(0)
}).catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})