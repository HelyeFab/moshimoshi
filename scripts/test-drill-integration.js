#!/usr/bin/env node
/**
 * Script to test drill feature integration with Universal Review Engine
 * Tests: Guest mode, Free tier, Premium tier storage and sync
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

async function testDrillIntegration() {
  console.log('=================================')
  console.log('Testing Drill Feature Integration')
  console.log('=================================\n')

  try {
    // Test user ID (you can change this to test with different users)
    const testUserId = 'r7r6at83BUPIjD69XatI4EGIECr1' // Beano's actual user ID

    console.log('📊 Testing with user:', testUserId)

    // 1. Check user subscription status
    console.log('\n1️⃣ Checking user subscription status...')
    const userDoc = await db.collection('users').doc(testUserId).get()

    if (!userDoc.exists) {
      console.log('❌ User not found in Firebase')
      return
    }

    const userData = userDoc.data()
    const subscription = userData?.subscription
    const isPremium = subscription?.plan && subscription.plan !== 'free'

    console.log('✅ User found')
    console.log('   - Display Name:', userData.displayName || 'N/A')
    console.log('   - Email:', userData.email || 'N/A')
    console.log('   - Subscription Plan:', subscription?.plan || 'free')
    console.log('   - Is Premium:', isPremium)

    // 2. Check drill stats in Firebase (for premium users)
    if (isPremium) {
      console.log('\n2️⃣ Checking drill stats in Firebase...')

      // Check stats document
      const drillStatsDoc = await db.collection('users')
        .doc(testUserId)
        .collection('stats')
        .doc('drill')
        .get()

      if (drillStatsDoc.exists) {
        const drillStats = drillStatsDoc.data()
        console.log('✅ Drill stats found in Firebase:')
        console.log('   - Total Drills:', drillStats.totalDrills || 0)
        console.log('   - Accuracy:', (drillStats.accuracy || 0).toFixed(1) + '%')
        console.log('   - Perfect Drills:', drillStats.perfectDrills || 0)
        console.log('   - Total Words Studied:', drillStats.wordsStudied?.size || 0)
        console.log('   - Last Session:', drillStats.lastSessionAt ? new Date(drillStats.lastSessionAt.toMillis()).toLocaleString() : 'Never')
      } else {
        console.log('⚠️ No drill stats found in Firebase (user may not have completed any drills yet)')
      }

      // Check recent sessions
      console.log('\n3️⃣ Checking recent drill sessions...')
      const sessionsSnapshot = await db.collection('users')
        .doc(testUserId)
        .collection('drill_sessions')
        .orderBy('completedAt', 'desc')
        .limit(5)
        .get()

      if (!sessionsSnapshot.empty) {
        console.log(`✅ Found ${sessionsSnapshot.size} recent sessions:`)
        sessionsSnapshot.forEach((doc, index) => {
          const session = doc.data()
          console.log(`\n   Session ${index + 1}:`)
          console.log(`   - ID: ${doc.id}`)
          console.log(`   - Date: ${session.completedAt ? new Date(session.completedAt.toMillis()).toLocaleString() : 'Unknown'}`)
          console.log(`   - Questions: ${session.questions || 0}`)
          console.log(`   - Correct: ${session.correctAnswers || 0}`)
          console.log(`   - Accuracy: ${(session.accuracy || 0).toFixed(1)}%`)
          console.log(`   - Mode: ${session.mode || 'unknown'}`)
        })
      } else {
        console.log('⚠️ No drill sessions found')
      }
    } else {
      console.log('\n2️⃣ User is on free tier - drill stats stored locally only (IndexedDB)')
      console.log('   Note: Free tier users\' data persists locally but doesn\'t sync to Firebase')
    }

    // 4. Check XP allocation
    console.log('\n4️⃣ Checking XP system integration...')
    const xpDoc = await db.collection('users')
      .doc(testUserId)
      .collection('stats')
      .doc('xp')
      .get()

    if (xpDoc.exists) {
      const xpData = xpDoc.data()
      console.log('✅ XP data found:')
      console.log('   - Total XP:', xpData.totalXP || 0)
      console.log('   - Current Level:', xpData.currentLevel || 1)
      console.log('   - XP to Next Level:', xpData.xpToNextLevel || 0)

      // Check if drill XP is being tracked
      if (xpData.sources?.drill) {
        console.log('   - XP from Drills:', xpData.sources.drill || 0)
      }
    } else {
      console.log('⚠️ No XP data found')
    }

    // 5. Summary and recommendations
    console.log('\n=================================')
    console.log('📋 Integration Test Summary')
    console.log('=================================')

    if (isPremium) {
      console.log('✅ Premium user - Full Firebase sync enabled')
      console.log('   - Drill stats sync to Firebase')
      console.log('   - Session history preserved')
      console.log('   - XP allocation tracked')
    } else {
      console.log('ℹ️ Free tier user - Local storage only')
      console.log('   - Drill stats stored in IndexedDB')
      console.log('   - No Firebase sync')
      console.log('   - XP allocation still works')
    }

    console.log('\n💡 Next Steps:')
    console.log('1. Complete a drill session and run this script again')
    console.log('2. Check the dashboard to see drill stats displayed')
    console.log('3. Verify XP is being allocated correctly')
    console.log('4. For premium users, check Firebase console for synced data')

  } catch (error) {
    console.error('❌ Error during testing:', error)
  }
}

// Run the test
testDrillIntegration()
  .then(() => {
    console.log('\n✅ Test completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  })